// Copyright 2008-2018 Yolo Technologies, Inc. All Rights Reserved. https://www.comblockengine.com
// Copyright 2008-2018 Yolo Technologies, Inc. All Rights Reserved.
// NavigateHandler 基于 NavMesh 动态寻路，不再依赖固定点数组

#include "cellapp.h"
#include "entity.h"
#include "navigate_handler.h"	

#include "controller.h"
#include "move_controller.h"
#include "navigation/navigation.h"
#include "navigation/navigation_mesh_handle.h"

namespace KBEngine {

    // MoveToPointHandler(KBEShared_ptr<Controller>& pController, int layer, const Position3D& destPos, float velocity, float distance, bool faceMovement,
    //     bool moveVertically, PyObject* userarg);
    NavigateHandler::NavigateHandler(KBEShared_ptr<Controller>& pController,
        const Position3D& destPos,
        float distance,
        float velocity,
        int8 layer,
        float moveVertically,
        bool faceMovement,
        PyObject* userarg)
        :MoveToPointHandler(pController, layer, destPos, velocity, distance, faceMovement, moveVertically, userarg),
        navHandle_(nullptr)
    {
        updatableName = "NavigateHandler";
        Py_INCREF(userarg);
        // 获取实体所在的导航网格
        if (pController_ && pController_->pEntity())
        {
            SpaceMemory* pSpace = SpaceMemorys::findSpace(pController_->pEntity()->spaceID());
            if (pSpace == NULL || !pSpace->isGood())
            {
                ERROR_MSG(fmt::format("NavigateHandler::NavigateHandler: not found space({}), entityID({})!\n",
                    pController_->pEntity()->spaceID(), pController_->pEntity()->id()));

                return ;
            }

            navHandle_ = pSpace->pNavHandle();

            if (!navHandle_)
            {
                WARNING_MSG(fmt::format("NavigateHandler::NavigateHandler: space({}), entityID({}), not found navhandle!\n",
                    pController_->pEntity()->spaceID(), pController_->pEntity()->id()));

                return ;
            }

        }


    }

    // 默认构造函数
    NavigateHandler::NavigateHandler()
        : MoveToPointHandler(),navHandle_(nullptr)
        
    {
        updatableName = "NavigateHandler";
    }

    // 析构函数
    NavigateHandler::~NavigateHandler()
    {
        if (pyuserarg_ != nullptr)
            Py_DECREF(pyuserarg_);
    }

    // 到达终点回调
    bool NavigateHandler::requestMoveOver(const Position3D& oldPos)
    {

        if (pController_)
        {
            if (pController_->pEntity())
                pController_->pEntity()->onMoveOver(pController_->id(), layer_, oldPos, pyuserarg_);

            // 如果在onMoveOver中调用cancelController（id）会导致MoveController析构导致pController_为NULL
            pController_->destroy();
        }

        return true;
    }

    // 序列化
    void NavigateHandler::addToStream(KBEngine::MemoryStream& s)
    {
        s << destPos_.x << destPos_.y << destPos_.z;
        s << velocity_ << distance_ << faceMovement_;
        s.appendBlob(script::Pickler::pickle(pyuserarg_));
    }

    // 反序列化
    void NavigateHandler::createFromStream(KBEngine::MemoryStream& s)
    {
        s >> destPos_.x >> destPos_.y >> destPos_.z;
        s >> velocity_ >> distance_ >> faceMovement_;
        std::string val;
        s.readBlob(val);
        pyuserarg_ = script::Pickler::unpickle(val);
    }

    // 核心更新函数：基于 NavMesh 动态移动
    bool NavigateHandler::update()
    {
        if (isDestroyed_ || !pController_ || !pController_->pEntity() || !navHandle_)
        {
            delete this;
            return false;
        }

        Entity* pEntity = pController_->pEntity();
        Py_INCREF(pEntity);

        Position3D currPos = pEntity->position();
        Position3D currPosBackup = currPos;
        Position3D nextPos;

        // 1. 当前 polyRef 无效，先找最近的 poly
        if (!polyRef_)
        {
            polyRef_ = navHandle_->findNearestPoly(layer_, currPos, nullptr);
            if (!polyRef_)
            {
                currPos.y = navHandle_->getPolyHeight(layer_, polyRef_, currPos);
                polyRef_ = navHandle_->findNearestPoly(layer_, currPos, nullptr);
            }

            if (!polyRef_)
            {
                ERROR_MSG(fmt::format("NavigateHandler::update: entity not on navmesh! entityID={}, pos=({}, {}, {})",
                    pController_->id(), currPos.x, currPos.y, currPos.z));
                Py_DECREF(pEntity);
                delete this;
                return false;
            }
        }

        // 2. 检查是否到达目标点
        float sqrDist = (destPos_ - currPos).squaredLength();
        if (sqrDist <= distance_ * distance_)
        {
            // 到达目的地，触发回调并停止
            requestMoveOver(currPosBackup);
            // isDestroyed_ = true;
            Py_DECREF(pEntity);
            delete this;
            return false;
        }

        // 3. 计算每帧移动
        Vector3 moveDir = destPos_ - currPos;
        float dist = moveDir.length();
        Vector3 stepVec = moveDir;
        if (dist > velocity_)
        {
            KBEVec3Normalize(&stepVec, &stepVec);
            stepVec *= velocity_;
        }
        Position3D stepPos = currPos + stepVec;

        // 4. 沿 NavMesh 移动
        bool moved = navHandle_->moveAlongSurface(layer_, polyRef_, currPos, stepPos, nextPos);
        if (!moved)
        {
            ERROR_MSG(fmt::format("NavigateHandler::update: moveAlongSurface failed! entityID={}", pController_->id()));
            requestMoveOver(currPosBackup);
            Py_DECREF(pEntity);
            delete this;
            return false;
        }

        // 5. 高度修正
        nextPos.y = navHandle_->getPolyHeight(layer_, polyRef_, nextPos);

        // 6. 更新方向
        Direction3D dir = pEntity->direction();
        if (faceMovement_ && (stepVec.x != 0.f || stepVec.z != 0.f))
            dir.yaw(stepVec.yaw());

        if (!isDestroyed_)
        {
            // 7. 设置实体位置
            pEntity->setPositionAndDirection(nextPos, dir);
            pEntity->isOnGround(true);
            pEntity->onMove(pController_->id(), layer_, currPosBackup, pyuserarg_);
        }

        DEBUG_MSG(fmt::format("NavigateHandler::update: entityID={},isDis={} pos=({}, {}, {}, desc=({},{},{}))",
            pController_->pEntity()->id(), isDestroyed_, nextPos.x, nextPos.y, nextPos.z, destPos_.x, destPos_.y, destPos_.z));

        if (isDestroyed_)
        { 
            requestMoveOver(currPosBackup);
            Py_DECREF(pEntity);
            delete this;
            return false;
        }


        Py_DECREF(pEntity);
        return true;
    }





} // namespace KBEngine
