// Copyright 2008-2018 Yolo Technologies, Inc. All Rights Reserved.
// NavigateHandler.h
// 基于 NavMesh 的动态导航寻路处理器

#ifndef KBE_NAVIGATE_HANDLER_H
#define KBE_NAVIGATE_HANDLER_H

#include "moveto_point_handler.h"
#include "updatable.h"
#include "math/math.h"
#include "pyscript/scriptobject.h"
#include "navigation/navigation.h"
#include "navigation/navigation_mesh_handle.h"

namespace KBEngine {

    class Controller;
    class Entity;

    /**
     * NavigateHandler
     * 动态寻路控制器，基于 NavMesh 移动实体到目标位置。
     * 支持面向移动方向、最大移动距离限制，以及到达终点回调。
     */
    class NavigateHandler : public MoveToPointHandler
    {
    public:
        /**
         * 构造函数
         * @param pController 控制器指针
         * @param destPos 目标位置
         * @param velocity 移动速度
         * @param moveVertically 每帧最大移动距离
         * @param faceMovement 是否面向移动方向
         * @param userarg 脚本用户参数
         */
        NavigateHandler(KBEShared_ptr<Controller>& pController,
            const Position3D& destPos,
            float distance,
            float velocity,
            int8 layer,
            float moveVertically,
            bool faceMovement,
            PyObject* userarg);

        /**
         * 默认构造函数（用于反序列化）
         */
        NavigateHandler();

        /**
         * 析构函数
         */
        virtual ~NavigateHandler();

        /**
         * 序列化
         */
        void addToStream(KBEngine::MemoryStream& s);

        /**
         * 反序列化
         */
        void createFromStream(KBEngine::MemoryStream& s);

        /**
         * 更新函数，每帧调用
         * @return 是否继续更新
         */
        virtual bool update() override;


        void destroy() { isDestroyed_ = true; }

        float velocity() const {
            return velocity_;
        }

        void velocity(float v) {
            velocity_ = v;
        }

        virtual MoveType type() const { return MOVE_TYPE_NAV; }

        virtual bool isOnGround() { return false; }

        /**
         * 到达目标位置回调
         * @param oldPos 上一帧位置
         * @return 是否移动完成
         */
        virtual bool requestMoveOver(const Position3D& oldPos);

        virtual const Position3D& destPos() { return destPos_; }


    private:
  //       KBEShared_ptr<Controller> pController_;       ///< 控制器指针
		NavigationHandlePtr navHandle_;               ///< 当前导航网格句柄
  //       float distance_;                              // 距离目标小于该值停止移动，如果该值为0则移动到目标位置
  //       int layer_;                                   ///< 实体所在层
		// Position3D destPos_;                          ///< 目标位置
		// float velocity_;                              ///< 移动速度
		// float maxMoveDistance_;                       ///< 每帧最大移动距离
		// bool faceMovement_;                           ///< 是否面向移动方向
		// PyObject* pyuserarg_;                         ///< 用户自定义参数
  //       bool isDestroyed_;                            ///< 是否已销毁
        dtPolyRef polyRef_ = NavMeshHandle::INVALID_NAVMESH_POLYREF;
    };

} // namespace KBEngine

#endif // KBE_NAVIGATE_HANDLER_H
