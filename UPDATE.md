
# 更新日志

## 2.6.4
- [feat] 原生c++ sdk [Issue #60](https://github.com/KBEngineLab/KBEngine-Nex/issues/60)
- [feat] 原生cxx ue5 demo+原生cxx demo [Issue #67](https://github.com/KBEngineLab/KBEngine-Nex/issues/67)
- [feat] 文档完善 docker使用教程，云服务器部署教程，kbex docker教程 [Issue #64](https://github.com/KBEngineLab/KBEngine-Nex/issues/64)
- [feat] WebConsole 全新重构 [Issue #44](https://github.com/KBEngineLab/KBEngine-Nex/issues/44)
- [feat] csharp sdk ，websocket 端口和域名映射支持 [Issue #50](https://github.com/KBEngineLab/KBEngine-Nex/issues/50)
- [feat] ts sdk ，websocket 端口和域名映射支持 [Issue #51](https://github.com/KBEngineLab/KBEngine-Nex/issues/51)
- [feat] webconsole 新增用户时配置权限 [Issue #62](https://github.com/KBEngineLab/KBEngine-Nex/issues/62)
- [feat] kbex 添加日志直连功能，用于外部启动引擎时连接日志 [Issue #61](https://github.com/KBEngineLab/KBEngine-Nex/issues/61)
- [feat] kbex 插件更优的docker支持 [Issue #55](https://github.com/KBEngineLab/KBEngine-Nex/issues/55)
- [feat] dockerfile 以及基础镜像 [Issue #56](https://github.com/KBEngineLab/KBEngine-Nex/issues/56)
- [bug] webconsole 创建用户时，设置用户扩展数据报错 [Issue #53](https://github.com/KBEngineLab/KBEngine-Nex/issues/53)
- [bug] webconsole py控制台无法多行输入的bug [Issue #52](https://github.com/KBEngineLab/KBEngine-Nex/issues/52)
- [bug] kbex 调试模式异常输出的bug [Issue #63](https://github.com/KBEngineLab/KBEngine-Nex/issues/63)

## v2.6.3
- [feat] 系统回调支持asyncio [Issue #1](https://github.com/KBEngineLab/KBEngine-Nex/issues/1)
- [feat] 新增 ts sdk  [Issue #6](https://github.com/KBEngineLab/KBEngine-Nex/issues/6)
- [feat] 添加原生C# SDK，支持unity和GODOT [Issue #15](https://github.com/KBEngineLab/KBEngine-Nex/issues/15) [Issue #6](https://github.com/KBEngineLab/KBEngine-Nex/issues/6)
- [feat] 原生C# SDK支持unity websocket [Issue #29](https://github.com/KBEngineLab/KBEngine-Nex/issues/29)
- [feat] vcpkg 支持，为未来支持arm处理器编译做准备 [Issue #34](https://github.com/KBEngineLab/KBEngine-Nex/issues/34)
- [feat] makefile迁移到cmake [Issue #13](https://github.com/KBEngineLab/KBEngine-Nex/issues/13)
- [feat] 升级三方依赖（ "fmt",log4cxx","zlib","hiredis","expat","apr","apr-util", "curl"） [Issue #32](https://github.com/KBEngineLab/KBEngine-Nex/issues/32)
- [feat] ubuntu-24.x /25.x支持 [Issue #33](https://github.com/KBEngineLab/KBEngine-Nex/issues/33)
- [feat] Linux/windows 一键编译脚本支持 [Issue #25](https://github.com/KBEngineLab/KBEngine-Nex/issues/25)
- [feat] 数据库创建table时，给字段添加上注释 [Issue #23](https://github.com/KBEngineLab/KBEngine-Nex/issues/23)
- [feat] linux arm支持 [Issue #38](https://github.com/KBEngineLab/KBEngine-Nex/issues/38)
- [feat] linux下cmake编译，Hybrid默认启用ASan，Release、Evaluation默认启用FORTIFY_SOURCE，可根据实际情况开关
- [feat] base、cell、interfaces asyncioRepeatOffset配置支持
- [fix] 添加mysqlclient缺失的2个dll
- [fix] 修复sync_item_to_db时， utf8mb4 中每次启动都重复同步一次UNICODE字段的BUG


## v2.6.2

- [feat] 添加dockerfile
- [feat] python 3.7.x升级 -> 3.13.5 [Issue #2](https://github.com/KBEngineLab/KBEngine-Nex/issues/2)
- [feat] 引擎支持python venv虚拟环境
- [feat] ssl / rsa / caching_sha2_password 支持 [Issue #4](https://github.com/KBEngineLab/KBEngine-Nex/issues/4)
- [feat] linux 并行构建支持 [Issue #8](https://github.com/KBEngineLab/KBEngine-Nex/issues/8)
- [feat] UE5 SDK支持 [Issue #6](https://github.com/KBEngineLab/KBEngine-Nex/issues/6)
- [feat] 升级mysqlclient到8.x
- [fix] 调整server_assets文件结构
