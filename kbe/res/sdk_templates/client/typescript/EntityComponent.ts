// 由 KBEngine C# SDK 结构迁移
// 实体组件基类结构（占位）
// 后续可根据实际需求扩展

import Entity from "./Entity";
import MemoryStream from "./MemoryStream";

export abstract class EntityComponent {
  public owner: any;
  public entityComponentPropertyID: number = 0;
  public name_: string = '';
  public ownerID: number = 0;
  public componentType: number = 0;

  public onEnterworld?(): void;
  public onLeaveworld?(): void;
  public onGetBase?(): void;
  public onGetCell?(): void;
  public onLoseCell?(): void;
  public onAttached?(entity: Entity): void;
  public onDetached?(entity: Entity): void;
  public getScriptModule?(): void;


  public onRemoteMethodCall(methodUtype: number, stream: MemoryStream) {
    // 动态生成
  }

  public onUpdatePropertys(propUtype: number, stream: MemoryStream, maxCount: number) {
    // 动态生成
  }

  public callPropertysSetMethods() {
    // 动态生成
  }



  public createFromStream(stream: MemoryStream)
		{
			this.componentType = stream.ReadInt32();
			this.ownerID = stream.ReadInt32();

			//UInt16 ComponentDescrsType;
			stream.ReadUint16();

			let count = stream.ReadUint16();

			if(count > 0)
				this.onUpdatePropertys(0, stream, count);
		}
} 