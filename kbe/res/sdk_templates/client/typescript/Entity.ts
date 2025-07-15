// Learn TypeScript:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/typescript.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/life-cycle-callbacks.html

import * as KBEMath from "./KBEMath";
import {KBEngineApp} from "./KBEngine";
import KBEDebug from "./KBEDebug";
import EntityDef from "./EntityDef";
import { EntityCall } from "./EntityCall";
import KBEEvent from "./Event";
import MemoryStream from "./MemoryStream";
import { EntityComponent } from "./EntityComponent";
import { Method } from "./Method";

export default class Entity
{
    id: number;
    className: string;

    position: KBEMath.Vector3 = new KBEMath.Vector3(0, 0, 0);
    direction: KBEMath.Vector3 = new KBEMath.Vector3(0, 0, 0);
    entityLastLocalPos = new KBEMath.Vector3(0.0, 0.0, 0.0);
    entityLastLocalDir = new KBEMath.Vector3(0.0, 0.0, 0.0);

    inWorld: boolean = false;
    inited: boolean = false;
    isControlled: boolean = false;
    isOnGround: boolean = false;

    // cell: EntityCall;
    // base: EntityCall;

    __init__()
    {
    }

    CallPropertysSetMethods()
    {
        // 动态生成
        // KBEDebug.DEBUG_MSG("Entity::CallPropertysSetMethods------------------->>>id:%s.", this.id);
        // let module: EntityDef.ScriptModule = EntityDef.MODULE_DEFS[this.className];

        // for(let name in module.propertys)
        // {
        //     let property: EntityDef.Property = module.propertys[name];
        //     KBEDebug.DEBUG_MSG("Entity::CallPropertysSetMethods------------------->>>id:%s.name(%s), property(%s)", this.id, name, this[name]);
        //     let setmethod = module.GetScriptSetMethod(name);

        //     if(setmethod !== undefined)
        //     {
        //         if(property.IsBase())
        //         {
        //             if(this.inited && !this.inWorld)
        //             {
        //                 let oldval = this[name];
        //                 setmethod.call(this, oldval)
        //             }
        //         }
        //         else
        //         {
        //             if(this.inWorld)
        //             {
        //                 if(property.IsOwnerOnly() || !this.IsPlayer())
        //                     continue;

        //                 let oldval = this[name];
        //                 setmethod.call(this, oldval)
        //             }
        //         }
        //     }
        // }
    }

    GetPropertyValue(name: string)
    {
        let value = this[name];
        if(value == undefined)
        {
            KBEDebug.INFO_MSG("Entity::GetPropertyValue: property(%s) not found(undefined).", name);
        }

        return value;
    }

    SetPropertyValue(name: string, value: any)
    {
        this[name] = value;
    }

    OnDestroy()
    {
    }

    OnControlled(isControlled: boolean)
    {
        KBEDebug.DEBUG_MSG("Entity::OnControlled:entity(%id) controlled state(%s) change.", this.id, isControlled);
    }

    IsPlayer(): boolean
    {
        return KBEngineApp.app!.entity_id === this.id;
    }

    BaseCall(methodName: string, ...args: any[])
    {
        if(KBEngineApp.app!.currserver == "loginapp"){
            KBEDebug.ERROR_MSG("%s::baseCall(%s),currserver is loginapp.", this.className, methodName);
            return;
        }

        // if(this.base === undefined)
        // {
        //     KBEDebug.ERROR_MSG("Entity::BaseCall: entity(%d) base is undefined.", this.id);
        // }

        let method: Method = EntityDef.moduledefs[this.className].baseMethods[methodName];
        if(method === undefined)
        {
            KBEDebug.ERROR_MSG("Entity::BaseCall: entity(%d) method(%s) not found.", this.id, methodName);
        }

        if(args.length !== method.args.length)
        {
            KBEDebug.ERROR_MSG("Entity::BaseCall: args(%d != %d) size is error!", args.length, method.args.length);  
			return;
        }


        let baseEntityCall = this.getBaseEntityCall();

        if (!baseEntityCall) {
            KBEDebug.ERROR_MSG(this.className + "::baseCall(%s),baseEntityCall is null.", methodName);
            return;
        }

        baseEntityCall.NewCall();
        baseEntityCall.bundle!.WriteUint16(0);
        baseEntityCall.bundle!.WriteUint16(method.methodUtype);

        try
        {
            for(let i = 0; i < method.args.length; i++)
            {
                if(method.args[i].IsSameType(args[i]))
                {
                    method.args[i].AddToStream(baseEntityCall.bundle, args[i])
                }
                else
                {
                    throw(new Error("KBEngine.Entity::baseCall: arg[" + i + "] is error!"));
                }
            }
        }
        catch(e)
        {
            KBEDebug.ERROR_MSG(e.toString());
            KBEDebug.ERROR_MSG("KBEngine.Entity::baseCall: args is error!");
            baseEntityCall.bundle = undefined;
            return;
        }

        baseEntityCall.SendCall();
    }

    CellCall(methodName: string, ...args: any[])
    {
        if(KBEngineApp.app!.currserver == "loginapp"){
            KBEDebug.ERROR_MSG("%s::cellCall(%s),currserver is loginapp.", this.className, methodName);
            return;
        }


        let method: Method = EntityDef.moduledefs[this.className].cellMethods[methodName];
        if(method === undefined)
        {
            KBEDebug.ERROR_MSG("Entity::CellCall: entity(%d) method(%s) not found.", this.id, methodName);
        }

        if(args.length !== method.args.length)
        {
            KBEDebug.ERROR_MSG("Entity::CellCall: args(%d != %d) size is error!", args.length, method.args.length);  
			return;
        }

        let cellEntityCall = this.getCellEntityCall();

        if (cellEntityCall == null) {
            KBEDebug.ERROR_MSG(this.className + "::cellCall(%s),cellEntityCall is null.", methodName);
            return;
        }

        cellEntityCall.NewCall();
        cellEntityCall.bundle!.WriteUint16(0);
        cellEntityCall.bundle!.WriteUint16(method.methodUtype);

        try
        {
            for(let i = 0; i < method.args.length; i++)
            {
                if(method.args[i].IsSameType(args[i]))
                {
                    method.args[i].AddToStream(cellEntityCall.bundle, args[i])
                }
                else
                {
                    throw(new Error("KBEngine.Entity::baseCall: arg[" + i + "] is error!"));
                }
            }
        }
        catch(e)
        {
            KBEDebug.ERROR_MSG(e.tostring());
            KBEDebug.ERROR_MSG("KBEngine.Entity::baseCall: args is error!");
            cellEntityCall.bundle = undefined;
            return;
        }

        cellEntityCall.SendCall();
    }

    EnterWorld()
    {
        KBEDebug.DEBUG_MSG(this.className + "::EnterWorld------------------->>>id:%s.", this.id);
        this.inWorld = true;
       
        try{
            this.OnEnterWorld();
            this.onComponentsEnterworld();
        }catch(e){
            KBEDebug.ERROR_MSG(this.className + "::EnterWorld: error(%s).", e.toString());
        }

        KBEEvent.Fire("onEnterWorld", this);
    }

    OnEnterWorld()
    {
        KBEDebug.DEBUG_MSG(this.className + "::OnEnterWorld------------------->>>id:%s.", this.id);
    }

    LeaveWorld()
    {
        try{
            this.OnLeaveWorld();
            this.onComponentsLeaveworld();
        }catch(e){
            KBEDebug.ERROR_MSG(this.className + "::LeaveWorld: error(%s).", e.toString());
        }

        KBEEvent.Fire("onLeaveWorld", this);
    }

    OnLeaveWorld()
    {
        KBEDebug.DEBUG_MSG(this.className + "::OnLeaveWorld------------------->>>id:%s.", this.id);
    }

    EnterSpace()
    {
        this.inWorld = true;
        try{
            this.OnEnterSpace();
        }catch(e){
            KBEDebug.ERROR_MSG(this.className + "::EnterSpace: error(%s).", e.toString());
        }

        KBEEvent.Fire("onEnterSpace", this);

        // 要立即刷新表现层对象的位置
        KBEEvent.Fire("set_position", this);
        KBEEvent.Fire("set_direction", this);
    }

    OnEnterSpace()
    {
        KBEDebug.DEBUG_MSG(this.className + "::OnEnterSpace------------------->>>id:%s.", this.id);
    }

    LeaveSpace()
    {
        this.inWorld = false;
        try{
            this.OnLeaveSpace();
        }catch(e){
            KBEDebug.ERROR_MSG(this.className + "::LeaveSpace: error(%s).", e.toString());
        }

        KBEEvent.Fire("onLeaveSpace", this);
    }

    OnLeaveSpace()
    {
        KBEDebug.DEBUG_MSG(this.className + "::OnLeaveSpace------------------->>>id:%s.", this.id);
    }

    OnUpdateVolatileData()
    {
    }

    // set_position(oldVal: KBEMath.Vector3)
    // {
	// 	if(this.IsPlayer())
	// 	{
	// 		KBEngineApp.app!.entityServerPos.x = this.position.x;
	// 		KBEngineApp.app!.entityServerPos.y = this.position.y;
    //         KBEngineApp.app!.entityServerPos.z = this.position.z;
	// 	}

    //     if(this.inWorld)
    //        KBEEvent.Fire("set_position", this);
    // }

    // set_direction(oldVal: KBEMath.Vector3)
    // {
    //     if(this.inWorld)
    //        KBEEvent.Fire("set_direction", this);
    // }

    SetPositionFromServer(postion: KBEMath.Vector3)
    {
    }

    SetDirectionFromServer(direction: KBEMath.Vector3)
    {
    }

    Destroy()
    {
        this.OnDestroy();
        this.detachComponents();
    }


    
    attachComponents()
    {
        // 动态生成
    }

    detachComponents()
    {
        // 动态生成
    }

    callPropertysSetMethods()
    {
        // 动态生成
    }

     getBaseEntityCall() : EntityCall | null
    {
        // 动态生成
        return null;
    }

     getCellEntityCall() : EntityCall | null
    {
        // 动态生成
        return null;
    }


    onRemoteMethodCall(stream:MemoryStream )
    {
        // 动态生成
    }

    onUpdatePropertys(stream:MemoryStream)
    {
        // 动态生成
    }

    onGetBase()
    {
        // 动态生成
    }

    onGetCell()
    {
        // 动态生成
    }

    onLoseCell()
    {
        // 动态生成
    }

    onComponentsEnterworld()
    {
        // 动态生成， 通知组件onEnterworld
    }

    onComponentsLeaveworld()
    {
        // 动态生成， 通知组件onLeaveworld
    }

    onPositionChanged(oldVal: KBEMath.Vector3){
        if(this.IsPlayer()){
            KBEngineApp.app!.entityServerPos = this.position;
        }

        if(this.inWorld){
            KBEEvent.Fire("set_position", this);
        }
    }


    onDirectionChanged(oldVal: KBEMath.Vector3){
        if(this.inWorld){
            // this.direction.x
            KBEEvent.Fire("set_direction", this);
        }else{
            this.direction = oldVal;
        }
    }

    getComponents(componentName:string, all :boolean){
        // 动态生成
        return [] as EntityComponent[];
    }
}

