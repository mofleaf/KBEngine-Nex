import KBEDebug from "./KBEDebug";
import KBEEvent from "./Event";
import NetworkInterface from "./NetworkInterface";
import Messages from "./Messages";
import Bundle from "./Bundle";
import MemoryStream from "./MemoryStream";
import { UTF8ArrayToString } from "./KBEEncoding";
import * as DataTypes from "./DataTypes";
import  EntityDef  from "./EntityDef";
import {INT64, UINT64} from "./DataTypes";

import Entity from "./Entity";
import * as KBEMath from "./KBEMath";
import { ScriptModule } from "./ScriptModule";
import { Property } from "./Property";
import { Method } from "./Method";
import { Vector2, Vector3 } from "./KBEMath";

export class KBEngineArgs {
    address: string = "127.0.0.1";
    port: number = 20013;
    updateTick: number = 100;
    clientType: number = 5;
    isOnInitCallPropertysSetMethods: boolean = true;
    useWss = false;
    wssBaseappPort = 443;
}


class ServerError {
    id: number = 0;
    name: string = "";
    description: string = "";
}

const KBE_FLT_MAX: number = 3.402823466e+38;

export class KBEngineApp {
    private args: KBEngineArgs;
    private idInterval: number;

    private userName: string = "test";
    private password: string = "123456";
    private clientDatas: Uint8Array = new Uint8Array(0);
    private encryptedKey: string = "";

    private serverdatas: Uint8Array | undefined;

    private loginappMessageImported = false;
    private baseappMessageImported = false;
    private serverErrorsDescrImported = false;
    private entitydefImported = false;

    private serverErrors: { [key: number]: ServerError } = {};

    // 登录loginapp的地址
    private serverAddress: string = "";
    private port = 0;

    // 服务端分配的baseapp地址
    private baseappAddress = "";
    private baseappPort = 0;
    private baseappUDPPort = 0;

    private useWss: boolean = false;
    private wssBaseappPort: number = 443;
    private protocol: string = "";

    public currserver = "loginapp";
    private currstate = "create";

    public networkInterface: NetworkInterface = new NetworkInterface();

    private serverVersion = "";
    private serverScriptVersion = "";
    private serverProtocolMD5 = "";
    private serverEntityDefMD5 = "";
    private clientVersion = "2.5.10";
    private clientScriptVersion = "0.1.0";

    private lastTickTime: number = 0;
    private lastTickCBTime: number = 0;

    entities: { [id: number]: Entity } = {};
    private bufferedCreateEntityMessage: { [id: number]: MemoryStream } = {};
    entity_id: number = 0;
    private entity_uuid: UINT64 | undefined;
    private entity_type: string = "";
    private controlledEntities: Array<Entity> = new Array<Entity>();
    private entityIDAliasIDList: Array<number> = new Array<number>();

    

    // 这个参数的选择必须与kbengine_defs.xml::cellapp/aliasEntityID的参数保持一致
    useAliasEntityID = true;

    isOnInitCallPropertysSetMethods = true;

    // 当前玩家最后一次同步到服务端的位置与朝向与服务端最后一次同步过来的位置
    entityServerPos = new KBEMath.Vector3(0.0, 0.0, 0.0);

    // space的数据，具体看API手册关于spaceData
    // https://github.com/kbengine/kbengine/tree/master/docs/api
    spacedata: { [key: string]: string } = {};

    // 玩家当前所在空间的id， 以及空间对应的资源
    spaceID = 0;
    spaceResPath = "";
    isLoadedGeometry = false;

    component: string = "client";

    private static _app: KBEngineApp | undefined = undefined;
    static get app() {
        return KBEngineApp._app;    // 如果外部使用者因为访问到undefined出错，表示需要先Create
    }

    static Create(args: KBEngineArgs): KBEngineApp {
        if (KBEngineApp._app != undefined) {
            throw Error("KBEngineApp must be singleton.");
        }
        new KBEngineApp(args);

        if (KBEngineApp._app === undefined) {
            throw Error("KBEngineApp is not created.");
        }

        return KBEngineApp._app;
    }

    static Destroy() {
        if (KBEngineApp.app === undefined) {
            return;
        }

        if(KBEngineApp.app.currserver == "baseapp")
            KBEngineApp.app.Logout();

        if (KBEngineApp.app.idInterval) {
            clearInterval(KBEngineApp.app.idInterval);
        }

        KBEngineApp.app.UninstallEvents();
        KBEngineApp.app.Reset();
        KBEngineApp._app = undefined;
    }

    private constructor(args: KBEngineArgs) {
        KBEDebug.ASSERT(KBEngineApp._app === undefined, "KBEngineApp::constructor:singleton KBEngineApp._app must be undefined.");
        KBEngineApp._app = this;

        this.args = args;
        this.serverAddress = args.address;
        this.port = args.port;
        this.useWss = args.useWss;
        this.wssBaseappPort = args.wssBaseappPort;
        this.protocol = args.useWss ? "wss://" : "ws://";


        EntityDef.init();

        this.InstallEvents();

        Messages.BindFixedMessage();
        // DataTypes.InitDatatypeMapping();

        let now = new Date().getTime();
        this.lastTickTime = now;
        this.lastTickCBTime = now;
        this.idInterval = setInterval(this.Update.bind(this), this.args.updateTick);
    }

    InstallEvents(): void {
        KBEDebug.DEBUG_MSG("KBEngineApp::InstallEvents");
        KBEEvent.Register("createAccount", this, this.CreateAccount);
        KBEEvent.Register("login", this, this.Login);
        KBEEvent.Register("logout", this, this.Logout);
        KBEEvent.Register("reloginBaseapp", this, this.ReloginBaseapp);
        KBEEvent.Register("resetPassword", this, this.Reset_password);
        KBEEvent.Register("bindAccountEmail", this, this.BindAccountEmail);
        KBEEvent.Register("newPassword", this, this.NewPassword);

        KBEEvent.Register("onDisconnected", this, this.OnDisconnected);
        KBEEvent.Register("onNetworkError", this, this.OnNetworkError);


    }

    OnDisconnected() {
        this.networkInterface.Close();
    }

    OnNetworkError(event: MessageEvent) {
        KBEDebug.ERROR_MSG("KBEngineApp::OnNetworkError:%s.", event.toString())
        this.networkInterface.Close();
    }

    UninstallEvents() {
        KBEEvent.DeregisterObject(this);
    }

    Update(): void {
        KBEngineApp.app!.SendTick();
    }

    private GetLoginappAddr(): string {
        let addr: string = "";
        if (this.useWss) {
            addr = this.protocol + this.serverAddress + ":" + this.port + "/loginapp";
        }
        else {
            addr = this.protocol + this.serverAddress + ":" + this.port;
        }

        return addr;
    }

    private GetBaseappAddr(): string {
        let addr: string = "";
        if (this.useWss) {
            addr = this.protocol + this.baseappAddress + ":" + this.wssBaseappPort + "/baseapp" + "?port=" + this.baseappPort;
        }
        else {
            addr = this.protocol + this.baseappAddress + ":" + this.baseappPort;
        }
        return addr;
    }

    /**
     * 登出baseapp
     */
    private Logout()
    {
        let bundle = new Bundle();
        bundle.NewMessage(Messages.messages["Baseapp_logoutBaseapp"]);
        bundle.WriteUint64(this.entity_uuid!);  
        bundle.WriteInt32(this.entity_id);
        bundle.Send(this.networkInterface);
    }

    /**
     * 通过错误id得到错误描述
     */
    private ServerErr(id: number)
    {
        // todo 这里要改，从生成的文件里获取
        return this.serverErrors[id].name + "[" + this.serverErrors[id].description + "]";
    }

    /**
     * 向服务端发送心跳以及同步角色信息到服务端
     */
    private SendTick() {
        if (!this.networkInterface.IsGood) {
            //KBEDebug.DEBUG_MSG("KBEngineApp::SendTick...this.networkInterface is not ready.");
            return;
        }

        let now = (new Date()).getTime();
        //KBEDebug.DEBUG_MSG("KBEngineApp::SendTick...now(%d), this.lastTickTime(%d), this.lastTickCBTime(%d).", now, this.lastTickTime, this.lastTickCBTime);
        if ((now - this.lastTickTime) / 1000 > 15) {
            if (this.lastTickCBTime < this.lastTickTime) {
                KBEDebug.ERROR_MSG("KBEngineApp::Update: Receive appTick timeout!");
                this.networkInterface.Close();
                return;
            }

            let bundle = new Bundle();

            if (this.currserver === "loginapp") {
                bundle.NewMessage(Messages.messages["Loginapp_onClientActiveTick"]);
            }
            else {
                bundle.NewMessage(Messages.messages["Baseapp_onClientActiveTick"]);
            }
            bundle.Send(this.networkInterface);

            this.lastTickTime = now;
        }

        this.UpdatePlayerToServer();
    }

    Reset(): void {
        KBEDebug.DEBUG_MSG("KBEngineApp::Reset");

        // todo 需要实现
        // KBEngine.Event.clearFiredEvents(); 

        this.clearEntities(true);

        this.networkInterface.Close();

        this.currserver = "loginapp";
        this.currstate = "create";

        // 扩展数据
        this.serverdatas = undefined;

        // 版本信息
        this.serverVersion = "";
        this.serverScriptVersion = "";
        this.serverProtocolMD5 = "";
        this.serverEntityDefMD5 = "";
        this.clientVersion = "2.2.9";
        this.clientScriptVersion = "0.1.0";

        // player的相关信息
        this.entity_uuid = undefined;
        this.entity_id = 0;
        this.entity_type = "";

        // 当前玩家最后一次同步到服务端的位置与朝向与服务端最后一次同步过来的位置
        this.entityServerPos = new KBEMath.Vector3(0.0, 0.0, 0.0);

        // 客户端所有的实体
        this.entityIDAliasIDList = [];

        // 空间的信息
        this.spacedata = {};
        this.spaceID = 0;
        this.spaceResPath = "";
        this.isLoadedGeometry = false;

        // 对象实例化时用即时时间初始化，否则update会不断执行，然而此时可能刚连接上服务器，但还未登陆，没导入协议，有可能导致出错
        // 如此初始化后会等待15s才会向服务器tick，时间已经足够服务器准备好
        var dateObject = new Date();
        this.lastTickTime = dateObject.getTime();
        this.lastTickCBTime = dateObject.getTime();

        // DataTypes.Reset();

        // 当前组件类别， 配套服务端体系
        this.component = "client";
    }



    clearEntities(isall: boolean) {
        this.controlledEntities = [];

        if (!isall) {
            let entity = this.Player();

            for (let key in this.entities) {
                if (key == entity.id.toString())
                    continue;

                if (this.entities[key].inWorld)
                    this.entities[key].LeaveWorld();

                this.entities[key].Destroy();
            }

            this.entities = {};
            this.entities[entity.id] = entity;
        }
        else {
            for (let key in this.entities) {
                if (this.entities[key].inWorld)
                    this.entities[key].LeaveWorld();

                this.entities[key].Destroy();
            }

            this.entities = {};
        }
    }

    FindEntity(entityID: number) {
        return this.entities[entityID];
    }

    Login(userName: string, password: string, datas): void {
        this.Reset();
        this.userName = userName;
        this.password = password;
        this.clientDatas = datas;

        this.Login_loginapp(true);
    }

    private Login_loginapp(noconnect: boolean): void {
        if (noconnect) {
            let addr: string = this.GetLoginappAddr();
            KBEDebug.INFO_MSG("KBEngineApp::Login_loginapp: start connect to " + addr + "!");

            this.networkInterface.ConnectTo(addr, (event: Event) => this.OnOpenLoginapp_login(event as MessageEvent));
        }
        else {
            let bundle = new Bundle();
            bundle.NewMessage(Messages.messages["Loginapp_login"]);
            bundle.WriteInt8(this.args.clientType);
            bundle.WriteBlob(this.clientDatas);
            bundle.WriteString(this.userName);
            bundle.WriteString(this.password);
            bundle.Send(this.networkInterface);
        }
    }

    private OnOpenLoginapp_login(event: MessageEvent) {
        KBEDebug.DEBUG_MSG("KBEngineApp::onOpenLoginapp_login:success to %s.", this.serverAddress);
        
        this.lastTickCBTime = (new Date()).getTime();

        if (!this.networkInterface.IsGood)   // 有可能在连接过程中被关闭
        {
            KBEDebug.WARNING_MSG("KBEngineApp::onOpenLoginapp_login:network has been closed in connecting!");
            return;
        }

        this.currserver = "loginapp";
        this.currstate = "login";

        KBEEvent.Fire("onConnectionState", true);

        KBEDebug.DEBUG_MSG(`KBEngine::login_loginapp(): connect ${this.serverAddress}:${this.port} success!`);

        this.Hello();
    }

    BindAccountEmail(emailAddress: string) {
        let bundle = new Bundle();
        bundle.NewMessage(Messages.messages["Baseapp_reqAccountBindEmail"])
        bundle.WriteInt32(this.entity_id);
        bundle.WriteString(this.password);
        bundle.WriteString(emailAddress);
        bundle.Send(this.networkInterface);
    }

    // 设置新密码，通过baseapp， 必须玩家登录在线操作所以是baseapp。
    NewPassword(old_password: string, new_password: string) {
        let bundle = new Bundle();
        bundle.NewMessage(Messages.messages["Baseapp_reqAccountNewPassword"]);
        bundle.WriteInt32(this.entity_id);
        bundle.WriteString(old_password);
        bundle.WriteString(new_password);
        bundle.Send(this.networkInterface);
    }

    Reset_password(userName: string) {
        this.Reset();
        this.userName = userName;
        this.Resetpassword_loginapp(true);
    }

    Resetpassword_loginapp(noconnect: boolean) {
        if (noconnect) {
            let addr = this.GetLoginappAddr();
            KBEDebug.INFO_MSG("KBEngineApp::Resetpassword_loginapp: start connect to %s!", addr);
            this.networkInterface.ConnectTo(addr, (event: Event) => this.OnOpenLoginapp_resetpassword(event as MessageEvent));
        }
        else {
            let bundle = new Bundle();
            bundle.NewMessage(Messages.messages["Loginapp_reqAccountResetPassword"]);
            bundle.WriteString(this.userName);
            bundle.Send(this.networkInterface);
        }
    }

    private OnOpenLoginapp_resetpassword(event: MessageEvent) {
        KBEDebug.INFO_MSG("KBEngineApp::onOpenLoginapp_resetpassword: successfully!");
        this.currserver = "loginapp";
        this.currstate = "resetpassword";

        this.Resetpassword_loginapp(false);
   
    }

    CreateAccount(userName: string, password: string, datas) {
        this.Reset();
        this.userName = userName;
        this.password = password;
        this.clientDatas = datas;

        this.CreateAccount_loginapp(true);
    }

    OnOpenLoginapp_createAccount(event: MessageEvent) {
        KBEEvent.Fire("onConnectionState", true);
        KBEDebug.INFO_MSG("KBEngineApp::OnOpenLoginapp_createAccount: successfully!");
        this.currserver = "loginapp";
        this.currstate = "createAccount";

        this.CreateAccount_loginapp(false);
    }

    CreateAccount_loginapp(noconnect: boolean) {
        if (noconnect) {
            let addr = this.GetLoginappAddr();
            KBEDebug.INFO_MSG("KBEngineApp::CreateAccount_loginapp: start connect to %s!", addr);
            this.networkInterface.ConnectTo(addr, (event: Event) => this.OnOpenLoginapp_createAccount(event as MessageEvent));
        }
        else {
            let bundle = new Bundle();
            bundle.NewMessage(Messages.messages["Loginapp_reqCreateAccount"]);
            bundle.WriteString(this.userName);
            bundle.WriteString(this.password);
            bundle.WriteBlob(this.clientDatas);

            bundle.Send(this.networkInterface);
        }
    }

    ReloginBaseapp() {
        this.lastTickTime = (new Date()).getTime();
        this.lastTickCBTime = (new Date()).getTime();

        if (this.networkInterface.IsGood)
            return;

        this.networkInterface.Close();
        KBEEvent.Fire("onReloginBaseapp");
        let addr = this.GetBaseappAddr();
        KBEDebug.INFO_MSG("KBEngineApp::reloginBaseapp: start connect to %s!", addr);
        this.networkInterface.ConnectTo(addr, (event: Event) => this.OnReOpenBaseapp(event as MessageEvent));
    }

    OnReOpenBaseapp(event: MessageEvent) {
        KBEDebug.INFO_MSG("KBEngineApp::onReOpenBaseapp: successfully!");
        this.currserver = "baseapp";

        let bundle = new Bundle();
        bundle.NewMessage(Messages.messages["Baseapp_reloginBaseapp"]);
        bundle.WriteString(this.userName);
        bundle.WriteString(this.password);
        bundle.WriteUint64(this.entity_uuid!);
        bundle.WriteUint32(this.entity_id);
        bundle.Send(this.networkInterface);

        this.lastTickCBTime = (new Date()).getTime();
    }

    Client_onImportClientMessages(stream: MemoryStream) {
        // 无需实现，已由插件生成静态代码
    }

    Client_onUpdateData_xyz_optimized(stream: MemoryStream) {
        // 这个消息是为了优化xyz的更新，减少网络传输
    }

    private OnImportClientMessages(stream: MemoryStream): void {
        // 无需实现，已由插件生成静态代码
    }

    private OnImportClientMessagesCompleted() {
        // 无需实现，已由插件生成静态代码
    }

    private OnImportEntityDefCompleted() {
        // 无需实现，已由插件生成静态代码
    }

    private IsClientMessage(name: string): boolean {
        return name.indexOf("Client_") >= 0;
    }

    private GetFunction(name: string): Function {
        let func: Function | undefined = this[name];
        if (!(func instanceof Function)) {
            func = undefined;
        }
        return func!;
    }

    /**
     *  与服务端握手，与任何一个进程连接之后应该第一时间进行握手
     */
    private Hello() {
        KBEDebug.INFO_MSG("KBEngine::Hello.........current server:%s.", this.currserver);
        let bundle: Bundle = new Bundle();
        if (this.currserver === "loginapp") {
            bundle.NewMessage(Messages.messages["Loginapp_hello"]);
        }
        else {
            bundle.NewMessage(Messages.messages["Baseapp_hello"]);
        }

        bundle.WriteString(this.clientVersion);
        bundle.WriteString(this.clientScriptVersion);
        bundle.WriteBlob(this.encryptedKey);
        bundle.Send(this.networkInterface);
    }

    /**
     * 服务端握手回调
     * @param stream 
     */
    Client_onHelloCB(stream: MemoryStream) {
        KBEDebug.INFO_MSG("KBEngine::Client_onHelloCB.........stream length:%d.", stream.Length());
        this.serverVersion = stream.ReadString();
        this.serverScriptVersion = stream.ReadString();
        this.serverProtocolMD5 = stream.ReadString();
        this.serverEntityDefMD5 = stream.ReadString();
        let ctype = stream.ReadInt32();

        KBEDebug.INFO_MSG("KBEngineApp::Client_onHelloCB: verInfo(" + this.serverVersion + "), scriptVerInfo(" +
            this.serverScriptVersion + "), serverProtocolMD5(" + this.serverProtocolMD5 + "), serverEntityDefMD5(" +
            this.serverEntityDefMD5 + "), ctype(" + ctype + ")!");

        this.lastTickCBTime = (new Date()).getTime();

        if(this.currserver == "baseapp")
        {
            this.Login_baseapp(false);
        }
        else
        {
            this.Login_loginapp(false);
        }

    }

    Client_onVersionNotMatch(stream: MemoryStream) {
        KBEDebug.DEBUG_MSG("KBEngine::Client_onVersionNotMatch.........stream length:%d.", stream.Length());
        this.serverVersion = stream.ReadString();
        KBEDebug.ERROR_MSG("Client_onVersionNotMatch: verInfo=" + this.clientVersion + " not match(server: " + this.serverVersion + ")");
        KBEEvent.Fire("onVersionNotMatch", this.clientVersion, this.serverVersion);
    }

    Client_onScriptVersionNotMatch(stream: MemoryStream) {
        this.serverScriptVersion = stream.ReadString();
        KBEDebug.ERROR_MSG("Client_onScriptVersionNotMatch: verInfo=" + this.clientScriptVersion + " not match(server: " + this.serverScriptVersion + ")");
        KBEEvent.Fire("onScriptVersionNotMatch", this.clientScriptVersion, this.serverScriptVersion);
    }

    /**
     * 服务器心跳回调
     */
    Client_onAppActiveTickCB() {
        let dateObject = new Date();
        this.lastTickCBTime = dateObject.getTime();
        KBEDebug.DEBUG_MSG("KBEngine::Client_onAppActiveTickCB.........lastTickCBTime:%d.", this.lastTickCBTime);
    }

    /**
     * 服务端错误描述导入
     * @param stream 
     */
    Client_onImportServerErrorsDescr(stream: MemoryStream) {
       // 无需实现，已由插件生成静态代码
    }



    private UpdatePlayerToServer() {
        let player = this.Player();
        if (player == undefined || player.inWorld == false || this.spaceID === 0 || player.isControlled)
            return;

        if (player.entityLastLocalPos.Distance(player.position) > 0.001 || player.entityLastLocalDir.Distance(player.direction) > 0.001) {
            // 记录玩家最后一次上报位置时自身当前的位置
            player.entityLastLocalPos.x = player.position.x;
            player.entityLastLocalPos.y = player.position.y;
            player.entityLastLocalPos.z = player.position.z;
            player.entityLastLocalDir.x = player.direction.x;
            player.entityLastLocalDir.y = player.direction.y;
            player.entityLastLocalDir.z = player.direction.z;

            let bundle = new Bundle();
            bundle.NewMessage(Messages.messages["Baseapp_onUpdateDataFromClient"]);
            bundle.WriteFloat(player.position.x);
            bundle.WriteFloat(player.position.y);
            bundle.WriteFloat(player.position.z);
            bundle.WriteFloat(player.direction.x);
            bundle.WriteFloat(player.direction.y);
            bundle.WriteFloat(player.direction.z);

            let isOnGound = player.isOnGround ? 1 : 0;
            bundle.WriteUint8(isOnGound);
            bundle.WriteUint32(this.spaceID);
            bundle.Send(this.networkInterface);
        }

        // 开始同步所有被控制了的entity的位置
        for (let entity of this.controlledEntities) {
            let position = entity.position;
            let direction = entity.direction;

            let posHasChanged = entity.entityLastLocalPos.Distance(position) > 0.001;
            let dirHasChanged = entity.entityLastLocalDir.Distance(direction) > 0.001;
            if (posHasChanged || dirHasChanged) {
                entity.entityLastLocalPos = position;
                entity.entityLastLocalDir = direction;

                let bundle = new Bundle();
                bundle.NewMessage(Messages.messages["Baseapp_onUpdateDataFromClientForControlledEntity"]);
                bundle.WriteInt32(entity.id);
                bundle.WriteFloat(position.x);
                bundle.WriteFloat(position.y);
                bundle.WriteFloat(position.z);

                bundle.WriteFloat(direction.x);
                bundle.WriteFloat(direction.y);
                bundle.WriteFloat(direction.z);

                let isOnGound = player.isOnGround ? 1 : 0;
                bundle.WriteUint8(isOnGound);
                bundle.WriteUint32(this.spaceID);
                bundle.Send(this.networkInterface);
            }
        }
    }

    Client_onLoginFailed(stream: MemoryStream) {
        var failedcode = stream.ReadUint16();
        this.serverdatas = stream.ReadBlob();
        KBEDebug.ERROR_MSG("KBEngineApp::Client_onLoginFailed: failedcode(" + this.serverErrors[failedcode].name + "), datas(" + this.serverdatas.length + ")!");
        KBEEvent.Fire("onLoginFailed", failedcode);
    }

    Client_onLoginSuccessfully(stream: MemoryStream) {
        KBEDebug.DEBUG_MSG("Client_onLoginSuccessfully------------------->>>");
        var accountName = stream.ReadString();
        this.userName = accountName;
        this.baseappAddress = stream.ReadString();
        this.baseappPort = stream.ReadUint16();
        this.baseappUDPPort = stream.ReadUint16();
        this.serverdatas = stream.ReadBlob();

        KBEDebug.INFO_MSG("KBEngineApp::Client_onLoginSuccessfully: accountName(" + accountName + "), addr(" +
            this.baseappAddress + ":" + this.baseappPort + "), datas(" + this.serverdatas.length + ")!");

        this.networkInterface.Close();
        this.Login_baseapp(true);
    }

    private Login_baseapp(noconnect: boolean) {
        if (noconnect) {
            let addr: string = this.GetBaseappAddr();
            KBEDebug.INFO_MSG("KBEngineApp::Login_baseapp: start connect to " + addr + "!");

            this.networkInterface.ConnectTo(addr, (event: Event) => this.OnOpenBaseapp(event as MessageEvent));
        }
        else {
            let bundle = new Bundle();
            bundle.NewMessage(Messages.messages["Baseapp_loginBaseapp"]);
            bundle.WriteString(this.userName);
            bundle.WriteString(this.password);
            bundle.Send(this.networkInterface);
        }
    }

    private OnOpenBaseapp(event: MessageEvent) {
        KBEDebug.INFO_MSG("KBEngineApp::onOpenBaseapp: successfully!");
        this.currserver = "baseapp";
        this.currstate = "";
        this.Hello();

        this.lastTickCBTime = (new Date()).getTime();
    }


    Client_onLoginBaseappFailed(failedcode) {
        KBEDebug.ERROR_MSG("KBEngineApp::Client_onLoginBaseappFailed: failedcode(" + this.serverErrors[failedcode].name + ")!");
        KBEEvent.Fire("onLoginBaseappFailed", failedcode);
    }

    Client_onReloginBaseappFailed(failedcode) {
        KBEDebug.ERROR_MSG("KBEngineApp::Client_onReloginBaseappFailed: failedcode(" + this.serverErrors[failedcode].name + ")!");
        KBEEvent.Fire("onReloginBaseappFailed", failedcode);
    }

    Client_onReloginBaseappSuccessfully(stream: MemoryStream) {
        this.entity_uuid = stream.ReadUint64();
        KBEDebug.DEBUG_MSG("KBEngineApp::Client_onReloginBaseappSuccessfully: " + this.userName);
        KBEEvent.Fire("onReloginBaseappSuccessfully");
    }

    Client_onImportClientEntityDef(stream: MemoryStream) {
        // 无需实现，已由插件生成静态代码
    }

    /**
     * 从服务端返回的二进制流导入客户端消息协议
     * @param stream 
     */
    OnImportClientEntityDef(stream: MemoryStream) {
        // 无需实现，已由插件生成静态代码
    }
    
    


    // 服务端使用优化的方式更新实体属性数据
    Client_onUpdatePropertysOptimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);
        this.OnUpdatePropertys(eid, stream);
    }

    Client_onUpdatePropertys(stream: MemoryStream) {
        let eid = stream.ReadInt32();
        //KBEDebug.DEBUG_MSG("Client_onUpdatePropertys------------------->>>eid:%s.", eid);
        this.OnUpdatePropertys(eid, stream);
    }

    OnUpdatePropertys(eid: number, stream: MemoryStream) {
        let entity = this.entities[eid];
        if (entity === undefined) {
            let entityStream = this.bufferedCreateEntityMessage[eid];
            if (entityStream !== undefined) {
                KBEDebug.ERROR_MSG("KBEngineApp::OnUpdatePropertys: entity(%i) not found.", eid);
                return;
            }

            let tempStream = new MemoryStream(stream.GetRawBuffer());
            tempStream.wpos = stream.wpos;
            tempStream.rpos = stream.rpos - 4;
            this.bufferedCreateEntityMessage[eid] = tempStream;
            return;
        }

        let module: ScriptModule = EntityDef.moduledefs[entity.className];
        while (stream.Length() > 0) {
            let utype = 0;
            if (module.usePropertyDescrAlias) {
                stream.ReadInt8()
                utype = stream.ReadUint8();
            }
            else {
                stream.ReadUint16()
                utype = stream.ReadUint16();
            }

            let propertyData: Property = module.propertys[utype];
            if (!propertyData || !propertyData.utype) {
                KBEDebug.WARNING_MSG("not found propertyData", utype)
                return
            }
            let val = propertyData.utype.CreateFromStream(stream);
            let oldval = entity.GetPropertyValue(propertyData.name);
            KBEDebug.DEBUG_MSG("KBEngineApp::OnUpdatePropertys: entity %s(id:%d, name:%s change oldval(%s) to val(%s), IsBase(%s),inited(%s).",
                entity.className, eid, propertyData.name, oldval, val, propertyData.isBase(), entity.inited);

            entity.SetPropertyValue(propertyData.name, val);

            // 触发set_*方法
            if (propertyData.setHandler !== undefined) {
                if (propertyData.isBase()) {
                    if (entity.inited)
                        propertyData.setHandler.call(entity, oldval);
                }
                else {
                    if (entity.inWorld)
                        propertyData.setHandler.call(entity, oldval);
                }
            }
        }
    }

    Client_onCreatedProxies(rndUUID: DataTypes.UINT64, eid: number, entityType: string) {
        KBEDebug.INFO_MSG("KBEngineApp::Client_onCreatedProxies: uuid:(%s) eid(%d), entityType(%s)!", rndUUID.toString(), eid, entityType);
        this.entity_uuid = rndUUID;
        this.entity_id = eid;
        this.entity_type = entityType;

        let entity = this.entities[eid];
        if (entity === undefined) {
            let scriptModule: ScriptModule = EntityDef.moduledefs[entityType];
            if (scriptModule === undefined) {
                KBEDebug.ERROR_MSG("KBEngineApp::Client_onCreatedProxies:script(%s) is undefined.", entityType);
                return;
            }

            let entity: Entity = new scriptModule.script();
            entity.id = eid;
            entity.className = entityType;
            entity.onGetBase();

            this.entities[eid] = entity;



            let entityStream = this.bufferedCreateEntityMessage[eid];
            if (entityStream !== undefined) {
                this.Client_onUpdatePropertys(entityStream);
                delete this.bufferedCreateEntityMessage[eid];
            }


            entity.__init__();
            entity.attachComponents();
            entity.inited = true;



            if (this.args.isOnInitCallPropertysSetMethods)
                entity.CallPropertysSetMethods();
        }
        else {
            let entityStream = this.bufferedCreateEntityMessage[eid];
            if (entityStream !== undefined) {
                this.Client_onUpdatePropertys(entityStream);
                delete this.bufferedCreateEntityMessage[eid];
            }
        }
    }

    OnRemoteMethodCall(eid: number, stream: MemoryStream) {
        let entity = this.entities[eid];
        if (entity === undefined) {
            KBEDebug.ERROR_MSG("KBEngineApp::Client_onRemoteMethodCall: entity(%d) not found!", eid);
            return;
        }

        let scriptModule: ScriptModule = EntityDef.moduledefs[entity.className];
        let methodUtype: number = 0;
        if (scriptModule.useMethodDescrAlias) {
            stream.ReadInt8()
            methodUtype = stream.ReadUint8();
        }
        else {
            stream.ReadUint16()
            methodUtype = stream.ReadUint16();
        }

        let defMethod: Method = scriptModule.methods[methodUtype];

        KBEDebug.ERROR_MSG("KBEngineApp::OnRemoteMethodCall: methodUtype(%d), methodName(%s), use alias(%s).",
            methodUtype, defMethod.name, scriptModule.useMethodDescrAlias);

        let args: any[] = [];
        for (let i = 0; i < defMethod.args.length; i++) {
            args.push(defMethod.args[i].CreateFromStream(stream));
        }

        if (entity[defMethod.name] !== undefined) {
            entity[defMethod.name].apply(entity, args);
        }
        else {
            KBEDebug.ERROR_MSG("KBEngineApp::Client_onRemoteMethodCall: entity(%d) not found method(%s)!", eid, defMethod.name);
        }
    }

    Client_onRemoteMethodCall(stream: MemoryStream) {
        let eid = stream.ReadUint32();
        this.OnRemoteMethodCall(eid, stream);
    }

    Client_onRemoteMethodCallOptimized(stream: MemoryStream) {
        //KBEDebug.DEBUG_MSG("Client_onRemoteMethodCallOptimized------------------->>>.");
        let eid = this.GetViewEntityIDFromStream(stream);
        this.OnRemoteMethodCall(eid, stream);
    }

    Client_onEntityEnterWorld(stream: MemoryStream) {
        //KBEDebug.DEBUG_MSG("Client_onEntityEnterWorld------------------->>>.");

        let eid = stream.ReadInt32();
        if (this.entity_id > 0 && this.entity_id !== eid)
            this.entityIDAliasIDList.push(eid);

        let entityType = 0;
        let useScriptModuleAlias: boolean = Object.keys(EntityDef.moduledefs).length > 255;
        if (useScriptModuleAlias)
            entityType = stream.ReadUint16();
        else
            entityType = stream.ReadUint8();

        let isOnGround: number = 1;
        if (stream.Length() > 0)
            isOnGround = stream.ReadInt8();

        let entity: Entity = this.entities[eid];
        if (entity === undefined) {
            let entityStream = this.bufferedCreateEntityMessage[eid];
            if (entityStream === undefined) {
                KBEDebug.ERROR_MSG("KBEngine::Client_onEntityEnterWorld: entity(%d) not found!", eid);
                return;
            }

            let module: ScriptModule = EntityDef.moduledefs[entityType]
            if (module === undefined) {
                KBEDebug.ERROR_MSG("KBEngine::Client_onEntityEnterWorld: not found module(" + entityType + ")!");
                return;
            }

            if (module.script === undefined)
                return;

            entity = new module.script();
            entity.id = eid;
            entity.className = module.name;

            entity.onGetCell();

            this.entities[eid] = entity;

            entity.isOnGround = isOnGround > 0;

            entity.__init__();
            entity.inWorld = true;
            entity.EnterWorld();

            if (this.args.isOnInitCallPropertysSetMethods)
                entity.CallPropertysSetMethods();

            this.Client_onUpdatePropertys(entityStream);
            delete this.bufferedCreateEntityMessage[eid];
        }
        else {
            if (!entity.inWorld) {
                // 安全起见， 这里清空一下
                // 如果服务端上使用giveClientTo切换控制权
                // 之前的实体已经进入世界，切换后的实体也进入世界，这里可能会残留之前那个实体进入世界的信息
                this.entityIDAliasIDList = [];
                this.entities = {}
                this.entities[entity.id] = entity

                entity.onGetCell();


                entity.onDirectionChanged(entity.direction);
                entity.onPositionChanged(entity.position);

                this.entityServerPos = entity.position;

                entity.isOnGround = isOnGround > 0;
                entity.inWorld = true;
                entity.EnterWorld();

                if (this.args.isOnInitCallPropertysSetMethods)
                    entity.CallPropertysSetMethods();
            }
        }
    }

    Client_onEntityLeaveWorldOptimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);
        this.Client_onEntityLeaveWorld(eid);
    }

    Client_onEntityLeaveWorld(eid: number) {
        let entity = this.entities[eid];
        if (entity === undefined) {
            KBEDebug.ERROR_MSG("KBEngineApp::Client_onEntityLeaveWorld: entity(" + eid + ") not found!");
            return;
        }

        if (entity.inWorld)
            entity.LeaveWorld();

        if (this.entity_id === eid) {
            this.ClearSpace(false);
            entity.onLoseCell();
        }
        else {
            let index = this.controlledEntities.indexOf(entity);
            if (index !== -1) {
                this.controlledEntities.splice(index, 1);
                KBEEvent.Fire("onLoseControlledEntity", entity);
            }

            index = this.entityIDAliasIDList.indexOf(eid);
            if (index != -1)
                this.entityIDAliasIDList.splice(index, 1);

            delete this.entities[eid];
            entity.Destroy();
        }
    }

    Client_initSpaceData(stream: MemoryStream) {
        this.ClearSpace(false);

        let spaceID = stream.ReadUint32();
        while (stream.Length() > 0) {
            let key = stream.ReadString();
            let value = stream.ReadString();
            this.Client_setSpaceData(spaceID, key, value);
        }

        KBEDebug.DEBUG_MSG("KBEngine::Client_initSpaceData: spaceID(" + spaceID + "), size(" + Object.keys(this.spacedata).length + ")!");
    }

    Client_setSpaceData(spaceID: number, key: string, value: string) {
        KBEDebug.DEBUG_MSG("KBEngine::Client_setSpaceData: spaceID(" + spaceID + "), key(" + key + "), value(" + value + ")!");

        this.spacedata[key] = value;

        if (key.indexOf("_mapping") != -1)
            this.AddSpaceGeometryMapping(spaceID, value);

        KBEEvent.Fire("onSetSpaceData", spaceID, key, value);
    }

    // 服务端删除客户端的spacedata， spacedata请参考API
    Client_delSpaceData(spaceID: number, key: string) {
        KBEDebug.DEBUG_MSG("KBEngine::Client_delSpaceData: spaceID(" + spaceID + "), key(" + key + ")");
        delete this.spacedata[key];
        KBEEvent.Fire("onDelSpaceData", spaceID, key);
    }

    Client_onEntityEnterSpace(stream: MemoryStream) {
        let eid = stream.ReadInt32();
        this.spaceID = stream.ReadUint32();

        let isOnGround = 1;
        if (stream.Length() > 0)
            isOnGround = stream.ReadInt8();

        let entity = this.entities[eid];
        if (entity === undefined) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onEntityEnterSpace: entity(" + eid + ") not found!");
            return;
        }

        this.entityServerPos.x = entity.position.x;
        this.entityServerPos.y = entity.position.y;
        this.entityServerPos.z = entity.position.z;
        entity.isOnGround = isOnGround > 0;
        entity.EnterSpace();
    }

    Client_onEntityLeaveSpace(eid: number) {
        let entity = this.entities[eid];
        if (entity === undefined) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onEntityLeaveSpace: entity(" + eid + ") not found!");
            return;
        }

        entity.LeaveSpace();
        this.ClearSpace(false);
    }

    Player(): Entity {
        return this.entities[this.entity_id];
    }

    ClearSpace(isAll: boolean) {
        this.entityIDAliasIDList = [];
        this.spacedata = {};
        this.ClearEntities(isAll);
        this.isLoadedGeometry = false;
        this.spaceID = 0;
    }

    ClearEntities(isAll: boolean) {
        this.controlledEntities = [];
        if (!isAll) {
            let entity: Entity = this.Player();

            for (let eid in this.entities) {
                let eid_number = Number(eid);
                if (eid_number == entity.id)
                    continue;

                if (this.entities[eid].inWorld) {
                    this.entities[eid].LeaveWorld();
                }

                this.entities[eid].Destroy();
            }

            this.entities = {}
            this.entities[entity.id] = entity;
        }
        else {
            for (let eid in this.entities) {
                if (this.entities[eid].inWorld) {
                    this.entities[eid].LeaveWorld();
                }

                this.entities[eid].Destroy();
            }

            this.entities = {}
        }
    }

    GetViewEntityIDFromStream(stream: MemoryStream) {
        let id = 0;
        if (this.entityIDAliasIDList.length > 255) {
            id = stream.ReadInt32();
        }
        else {
            var aliasID = stream.ReadUint8();

            // 如果为0且客户端上一步是重登陆或者重连操作并且服务端entity在断线期间一直处于在线状态
            // 则可以忽略这个错误, 因为cellapp可能一直在向baseapp发送同步消息， 当客户端重连上时未等
            // 服务端初始化步骤开始则收到同步信息, 此时这里就会出错。
            if (this.entityIDAliasIDList.length <= aliasID)
                return 0;

            id = this.entityIDAliasIDList[aliasID];
        }

        return id;
    }

    // 当前space添加了关于几何等信息的映射资源
    // 客户端可以通过这个资源信息来加载对应的场景
    AddSpaceGeometryMapping(spaceID: number, resPath: string) {
        KBEDebug.DEBUG_MSG("KBEngine::addSpaceGeometryMapping: spaceID(" + spaceID + "), resPath(" + resPath + ")!");

        this.isLoadedGeometry = true;
        this.spaceID = spaceID;
        this.spaceResPath = resPath;

        KBEEvent.Fire("addSpaceGeometryMapping", resPath);
    }

    Client_onKicked(failedcode: number) {
        KBEDebug.ERROR_MSG("KBEngineApp::Client_onKicked: failedcode(" + this.serverErrors[failedcode].name + ")!");
        KBEEvent.Fire("onKicked", failedcode);
    }

    Client_onCreateAccountResult(stream: MemoryStream) {
        let retcode = stream.ReadUint16();
        let datas = stream.ReadBlob();

        KBEEvent.Fire("onCreateAccountResult", retcode, datas);

        if (retcode != 0) {
            KBEDebug.ERROR_MSG("KBEngineApp::Client_onCreateAccountResult: " + this.userName + " create is failed! code=" + this.serverErrors[retcode].name + "!");
            return;
        }

        KBEDebug.INFO_MSG("KBEngineApp::Client_onCreateAccountResult: " + this.userName + " create is successfully!");
    }

    Client_onReqAccountResetPasswordCB(failcode: number) {
        KBEEvent.Fire("onResetPassword", failcode);
        
        if (failcode != 0) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onReqAccountResetPasswordCB: " + this.userName + " is failed! code=" + failcode + "!");
            return;
        }

        KBEDebug.DEBUG_MSG("KBEngine::Client_onReqAccountResetPasswordCB: " + this.userName + " is successfully!");
    }

    Client_onReqAccountBindEmailCB(failcode: number) {
        KBEEvent.Fire("onBindAccountEmail", failcode);

        if (failcode != 0) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onReqAccountBindEmailCB: " + this.userName + " is failed! code=" + failcode + "!");
            return;
        }

        KBEDebug.DEBUG_MSG("KBEngine::Client_onReqAccountBindEmailCB: " + this.userName + " is successfully!");
    }

    Client_onReqAccountNewPasswordCB(failcode: number) {
        KBEEvent.Fire("onNewPassword", failcode);
        
        if (failcode != 0) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onReqAccountNewPasswordCB: " + this.userName + " is failed! code=" + failcode + "!");
            return;
        }

        KBEDebug.DEBUG_MSG("KBEngine::Client_onReqAccountNewPasswordCB: " + this.userName + " is successfully!");
    }

    Client_onEntityDestroyed(eid: number) {
        KBEDebug.DEBUG_MSG("KBEngine::Client_onEntityDestroyed: entity(" + eid + ")");

        let entity = this.entities[eid];

        if (entity === undefined) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onEntityDestroyed: entity(" + eid + ") not found!");
            return;
        }

        if (entity.inWorld) {
            if (this.entity_id == eid)
                this.ClearSpace(false);

            entity.LeaveWorld();
        }

        let index = this.controlledEntities.indexOf(entity);
        if (index != -1) {
            this.controlledEntities.splice(index, 1);
            KBEEvent.Fire("onLoseControlledEntity", entity);
        }

        delete this.entities[eid];
        entity.Destroy();
    }

    // 服务端通知流数据下载开始
    // 请参考API手册关于onStreamDataStarted
    Client_onStreamDataStarted(id: number, datasize: number, descr: string) {
        KBEEvent.Fire("onStreamDataStarted", id, datasize, descr);
    }

    Client_onStreamDataRecv(stream: MemoryStream) {
        let resID = stream.ReadInt16();
        let datas = stream.ReadBlob();
        KBEEvent.Fire("onStreamDataRecv", resID, datas);
    }

    Client_onStreamDataCompleted(id: number) {
        KBEEvent.Fire("onStreamDataCompleted", id);
    }

    Client_onControlEntity(eid: number, isControlled: number) {
        let entity: Entity = this.entities[eid];

        if (entity == undefined) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onControlEntity: entity(%d) not found!", eid);
            return;
        }

        var isCont = isControlled !== 0;
        if (isCont) {
            // 如果被控制者是玩家自己，那表示玩家自己被其它人控制了
            // 所以玩家自己不应该进入这个被控制列表
            if (this.Player().id != entity.id) {
                this.controlledEntities.push(entity);
            }
        }
        else {
            let index = this.controlledEntities.indexOf(entity);
            if (index != -1)
                this.controlledEntities.splice(index, 1);
        }

        entity.isControlled = isCont;

        try {
            entity.OnControlled(isCont);
            KBEEvent.Fire("onControlled", entity, isCont);
        }
        catch (e) {
            KBEDebug.ERROR_MSG("KBEngine::Client_onControlEntity: entity id = %d, is controlled = %s, error = %s", eid, isCont, e.toString());
        }
    }

    UpdateVolatileData(entityID: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, isOnGround: number, isOptimized: boolean = false) {
        let entity = this.entities[entityID];
        if (entity === undefined) {
            // 如果为0且客户端上一步是重登陆或者重连操作并且服务端entity在断线期间一直处于在线状态
            // 则可以忽略这个错误, 因为cellapp可能一直在向baseapp发送同步消息， 当客户端重连上时未等
            // 服务端初始化步骤开始则收到同步信息, 此时这里就会出错。
            KBEDebug.ERROR_MSG("KBEngineApp::_updateVolatileData: entity(" + entityID + ") not found!");
            return;
        }

        // 小于0不设置
        if (isOnGround >= 0) {
            entity.isOnGround = (isOnGround > 0);
        }

        let changeDirection = false;

        if (roll != KBE_FLT_MAX) {
            changeDirection = true;
            entity.direction.x = isOptimized? KBEMath.Int8ToAngle(roll, false)  : roll;
        }

        if (pitch != KBE_FLT_MAX) {
            changeDirection = true;
            entity.direction.y = isOptimized? KBEMath.Int8ToAngle(pitch, false)  : pitch;
        }

        if (yaw != KBE_FLT_MAX) {
            changeDirection = true;
            entity.direction.z = isOptimized? KBEMath.Int8ToAngle(yaw, false)  : yaw;
        }

        let done = false;
        if (changeDirection == true) {
            KBEEvent.Fire("set_direction", entity);
            done = true;
        }

        let positionChanged = false;
        if (x != KBE_FLT_MAX || y != KBE_FLT_MAX || z != KBE_FLT_MAX)
            positionChanged = true;

        if (x == KBE_FLT_MAX) x = isOptimized ? 0.0 : entity.position.x;
        if (y == KBE_FLT_MAX) y = isOptimized ? 0.0 : entity.position.y;
        if (z == KBE_FLT_MAX) z = isOptimized ? 0.0 : entity.position.z;

        if (positionChanged) {
            let pos = isOptimized ? new Vector3(x + this.entityServerPos.x, y + this.entityServerPos.y, z + this.entityServerPos.z) : new Vector3(x, y, z);
            entity.position = pos;
            done = true;
            KBEEvent.Fire("updatePosition", entity);
        }

        if (done)
            entity.OnUpdateVolatileData();
    }

    Client_onUpdateBaseDir(stream: MemoryStream) {
        let yaw = stream.ReadFloat() * 360 / (Math.PI * 2);
        let pitch = stream.ReadFloat() * 360 / (Math.PI * 2);
        let roll = stream.ReadFloat() * 360 / (Math.PI * 2);

        let entity = this.Player();
        if (entity != null && entity.isControlled)
        {
            entity.direction.x = roll;
            entity.direction.y = pitch;
            entity.direction.z = yaw;
            KBEEvent.Fire("set_direction", entity);
            entity.OnUpdateVolatileData();
        }
    }

    Client_onUpdateBasePos(x, y, z) {
        //KBEDebug.WARNING_MSG("Client_onUpdateBasePos---------->>>:x(%s),z(%s)..entityServerPos:x(%s),y(%s),z(%s).", x,z,this.entityServerPos.x,this.entityServerPos.y,this.entityServerPos.z);

        this.entityServerPos.x = x;
        this.entityServerPos.y = y;
        this.entityServerPos.z = z;

        let entity = this.Player();
        if (entity != undefined && entity.isControlled) {
            entity.OnUpdateVolatileData();
        }
    }

    Client_onUpdateBasePosXZ(x, z) {
        //KBEDebug.WARNING_MSG("Client_onUpdateBasePosXZ---------->>>:x(%s),z(%s)..entityServerPos:x(%s),y(%s),z(%s).", x,z,this.entityServerPos.x,this.entityServerPos.y,this.entityServerPos.z);
        this.Client_onUpdateBasePos(x, this.entityServerPos.y, z);
    }

    Client_onUpdateData(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);
        let entity = this.entities[eid];
        if (entity == undefined) {
            KBEDebug.ERROR_MSG("KBEngineApp::Client_onUpdateData: entity(" + eid + ") not found!");
            return;
        }
    }

    Client_onSetEntityPosAndDir(stream: MemoryStream) {
        let eid = stream.ReadInt32();
        let entity = this.entities[eid];
        if (entity == undefined) {
            KBEDebug.ERROR_MSG("KBEngineApp::Client_onSetEntityPosAndDir: entity(" + eid + ") not found!");
            return;
        }

        let oldPos = new Vector3(entity.position.x, entity.position.y, entity.position.z);
        let oldDir = new Vector3(entity.direction.x, entity.direction.y, entity.direction.z);

        entity.position.x = stream.ReadFloat();
        entity.position.y = stream.ReadFloat();
        entity.position.z = stream.ReadFloat();
        entity.direction.x = stream.ReadFloat();
        entity.direction.y = stream.ReadFloat();
        entity.direction.z = stream.ReadFloat();

        // 记录玩家最后一次上报位置时自身当前的位置
        entity.entityLastLocalPos.x = entity.position.x;
        entity.entityLastLocalPos.y = entity.position.y;
        entity.entityLastLocalPos.z = entity.position.z;
        entity.entityLastLocalDir.x = entity.direction.x;
        entity.entityLastLocalDir.y = entity.direction.y;
        entity.entityLastLocalDir.z = entity.direction.z;


        entity.entityLastLocalDir = entity.direction;
        entity.entityLastLocalPos = entity.position;

        entity.onDirectionChanged(oldDir);
        entity.onPositionChanged(oldPos);



    }

    Client_onUpdateData_ypr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, p, r, -1);
    }

    Client_onUpdateData_yp(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, p, KBE_FLT_MAX, -1);
    }

    Client_onUpdateData_yr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, KBE_FLT_MAX, r, -1);
    }

    Client_onUpdateData_pr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, p, r, -1);
    }

    Client_onUpdateData_y(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, KBE_FLT_MAX, KBE_FLT_MAX, -1);
    }

    Client_onUpdateData_p(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, p, KBE_FLT_MAX, -1);
    }

    Client_onUpdateData_r(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, r, -1);
    }

    Client_onUpdateData_xz(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, 1);
    }

    Client_onUpdateData_xz_ypr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], y, p, r, 1);
    }

    Client_onUpdateData_xz_yp(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], y, p, KBE_FLT_MAX, 1);
    }

    Client_onUpdateData_xz_yr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let y = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], y, KBE_FLT_MAX, r, 1);
    }

    Client_onUpdateData_xz_pr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, p, r, 1);
    }

    Client_onUpdateData_xz_y(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let y = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], y, KBE_FLT_MAX, KBE_FLT_MAX, 1);
    }

    Client_onUpdateData_xz_p(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        var xz = stream.ReadPackXZ();

        var p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, p, KBE_FLT_MAX, 1);
    }

    Client_onUpdateData_xz_r(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        var xz = stream.ReadPackXZ();

        var r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, KBE_FLT_MAX, r, 1);
    }

    Client_onUpdateData_xyz(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        var xz = stream.ReadPackXZ();
        var y = stream.ReadPackY();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, 0);
    }

    Client_onUpdateData_xyz_ypr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();
        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, p, r, 0);
    }

    Client_onUpdateData_xyz_yp(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();
        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, p, KBE_FLT_MAX, 0);
    }

    Client_onUpdateData_xyz_yr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, KBE_FLT_MAX, r, 0);
    }

    Client_onUpdateData_xyz_pr(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], KBE_FLT_MAX, p, r, 0);
    }

    Client_onUpdateData_xyz_y(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, KBE_FLT_MAX, KBE_FLT_MAX, 0);
    }

    Client_onUpdateData_xyz_p(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], KBE_FLT_MAX, p, KBE_FLT_MAX, 0);
    }

    Client_onUpdateData_xyz_r(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], KBE_FLT_MAX, KBE_FLT_MAX, r, 0);
    }


    Client_onUpdateData_ypr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, p, r, -1, true);
    }

    Client_onUpdateData_yp_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, p, KBE_FLT_MAX, -1, true);
    }

    Client_onUpdateData_yr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, KBE_FLT_MAX, r, -1, true);
    }

    Client_onUpdateData_pr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, p, r, -1, true);
    }



    Client_onUpdateData_y_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let y = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, y, KBE_FLT_MAX, KBE_FLT_MAX, -1, true);
    }

    Client_onUpdateData_p_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, p, KBE_FLT_MAX, -1, true);
    }

    Client_onUpdateData_r_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, r, -1, true);
    }

    Client_onUpdateData_xz_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, KBE_FLT_MAX, KBE_FLT_MAX, 1, true);
    }

    Client_onUpdateData_xz_ypr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], y, p, r, 1, true);
    }

    Client_onUpdateData_xz_yp_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let y = stream.ReadInt8();
        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], y, p, KBE_FLT_MAX, 1, true);
    }

    Client_onUpdateData_xz_yr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let y = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], y, KBE_FLT_MAX, r, 1, true);
    }

    Client_onUpdateData_xz_pr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, p, r, 1, true);
    }

    Client_onUpdateData_xz_y_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);
        let xz = stream.ReadPackXZ();
        let yaw = stream.ReadInt8();
        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], yaw, KBE_FLT_MAX, KBE_FLT_MAX, 1, true);
    }

    Client_onUpdateData_xz_p_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, p, KBE_FLT_MAX, 1, true);
    }

    Client_onUpdateData_xz_r_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();

        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], KBE_FLT_MAX, xz[1], KBE_FLT_MAX, KBE_FLT_MAX, r, 1, true);
    }


    Client_onUpdateData_xyz_ypr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();
        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, p, r, 0, true);
    }

    Client_onUpdateData_xyz_yp_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();
        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, p, KBE_FLT_MAX, 0, true);
    }

    Client_onUpdateData_xyz_yr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, KBE_FLT_MAX, r, 0, true);
    }

    Client_onUpdateData_xyz_pr_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let p = stream.ReadInt8();
        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], KBE_FLT_MAX, p, r, 0, true);
    }

    Client_onUpdateData_xyz_y_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let yaw = stream.ReadInt8();
        this.UpdateVolatileData(eid, xz[0], y, xz[1], yaw, KBE_FLT_MAX, KBE_FLT_MAX, 0, true);
    }

    Client_onUpdateData_xyz_p_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let p = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], KBE_FLT_MAX, p, KBE_FLT_MAX, 0, true);
    }

    Client_onUpdateData_xyz_r_optimized(stream: MemoryStream) {
        let eid = this.GetViewEntityIDFromStream(stream);

        let xz = stream.ReadPackXZ();
        let y = stream.ReadPackY();

        let r = stream.ReadInt8();

        this.UpdateVolatileData(eid, xz[0], y, xz[1], KBE_FLT_MAX, KBE_FLT_MAX, r, 0, true);
    }

    Client_onImportClientSDK(stream: MemoryStream) {
        let remainingFiles = stream.ReadInt32();

        let fileName = stream.ReadString();

        let fileSize = stream.ReadInt32();

        let fileDatas = stream.ReadBlob();

        // this.Event.fireIn("onImportClientSDK", remainingFiles, fileName, fileSize, fileDatas);
    }


}