// 由 KBEngine C# SDK 结构迁移

import { Method } from "./Method";
import { Property } from "./Property";

// 脚本模块描述结构
export class ScriptModule {
  name: string = '';
  usePropertyDescrAlias: boolean = true;
  useMethodDescrAlias: boolean = true;
  idmethods: { [key: number]: Method } = {};
  idbaseMethods: { [key: number]: Method } = {};
  idcellMethods: { [key: number]: Method } = {};
  idpropertys: { [key: number]: Property } = {};
  propertys: { [key: string]: Property } = {};
  methods: { [key: string]: any } = {};
  baseMethods: { [key: string]: Method } = {};
  cellMethods: { [key: string]: Method } = {};
  script?: any;

  constructor(name: string) {
    this.name = name;
  }

  // getScriptSetMethod?(name: string): Function | undefined { return undefined; }
  // getScriptMethod?(name: string): Function | undefined { return undefined; }
} 