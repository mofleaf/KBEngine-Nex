import NetworkInterface from "./NetworkInterface";
import Bundle from "./Bundle";
import KBEDebug from "./KBEDebug";
import Messages from "./Messages";
import { KBEngineApp } from "./KBEngine";
import EntityDef from "./EntityDef";
import { Method } from "./Method";



export abstract class EntityCall
{
    bundle?: Bundle;
    id: number = 0;
    className: string = "";
    
    // 0: CellEntityCall, 1: BaseEntityCall
    entityCallType: number = 0;


    constructor(eid: number,ename:string)
    {
        this.id = eid;
        this.className = ename;
    }

    isBase(){
        return this.entityCallType == 1;
    }

    isCell(){
        return this.entityCallType == 0;
    }

    SendCall(bundle?: Bundle)
    {
        KBEDebug.ASSERT(this.bundle !== undefined);

        if(bundle === undefined)
            bundle = this.bundle;
        bundle!.Send(KBEngineApp.app!.networkInterface);
        
        if(bundle === this.bundle)
            this.bundle = undefined;
    }

    // protected abstract BuildBundle();

    NewCall()
    {
        if(this.bundle === undefined)
            this.bundle = new Bundle();
            
        // this.BuildBundle();

        if(this.isCell()){
            this.bundle.NewMessage(Messages.messages["Baseapp_onRemoteCallCellMethodFromClient"])
        }else{
            this.bundle.NewMessage(Messages.messages["Entity_onRemoteMethodCall"])
        }

        this.bundle.WriteUint32(this.id);

        return this.bundle;
    }

    

    NewCallToMethod(methodName:string, entitycomponentPropertyID:number = 0){
        if(KBEngineApp.app!.currserver == "loginapp"){
            KBEDebug.ERROR_MSG(this.className + "::newCall(" + methodName + "), currserver=!" + KBEngineApp.app!.currserver);  
            return null;
        }

        const module = EntityDef.moduledefs[this.className];
        if(!module){
            KBEDebug.ERROR_MSG(this.className + "::newCall: entity-module(" + this.className + ") error, can not find from EntityDef.moduledefs");
            return null;
        }

        let method: Method;
        if(this.isCell()){
            method = module.cellMethods[methodName];
        }else{
            method = module.baseMethods[methodName];
        }
        
        if(!method){
            KBEDebug.ERROR_MSG(this.className + "::newCall: entity-method(" + this.className + ") error, can not find from EntityDef.moduledefs");
        }


        this.NewCall();
        this.bundle!.WriteUint16(entitycomponentPropertyID);
        this.bundle!.WriteUint16(method.methodUtype);
        return this.bundle;
    }
}

// export class CellEntityCall extends EntityCall
// {

// }

// export class BaseEntityCall extends EntityCall
// {
//     BuildBundle()
//     {
//         KBEDebug.ASSERT(this.bundle !== undefined);
//         this.bundle.NewMessage(Message.messages["Entity_onRemoteMethodCall"])
//     }
// }
