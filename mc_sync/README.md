# mc_sync · Day 15 协同通道

要求 Node.js >= 22。使用与前端配套的 Hocuspocus 4.7.1 / Yjs 13.6.33。

## 启动

```powershell
npm --prefix mc_sync ci
npm --prefix mc_sync start
```

默认监听 `127.0.0.1:1234`。健康检查：`GET http://127.0.0.1:1234/healthz`，返回 `storage: memory`。

前端安装依赖后启用连接（仅影响本次终端，不写入仓库）：

```powershell
npm --prefix mc_web ci
$env:VITE_COLLABORATION_URL = 'ws://127.0.0.1:1234'
npm --prefix mc_web run dev
```

也可将 mc_web/.env.example 复制为已忽略的 mc_web/.env.local；修改环境变量后重启 Vite。未配置 URL 时显示“本地编辑”，不加载 Provider、不连接服务。配置不合法时显示异常，继续保留本地编辑。

## 配置

| 环境变量 | 默认值 | 含义 |
| --- | --- | --- |
| MC_SYNC_HOST | 127.0.0.1 | 监听地址 |
| MC_SYNC_PORT | 1234 | 1～65535 的整数端口 |
| MC_SYNC_TIMEOUT_MS | 60000 | 服务端健康检测超时，1000～300000ms |
| MC_SYNC_ORIGINS | localhost/127.0.0.1 的 3000、4173 端口 | 逗号分隔的精确 HTTP(S) Origin 白名单 |
| VITE_COLLABORATION_URL | 未设置 | 前端 ws:// 或 wss:// 地址，不接受凭据、查询串、片段 |

当前服务为本机开发通道，未实现账户鉴权和服务端持久化。Origin 白名单是浏览器来源检查，不能代替鉴权；无 Origin 的 Node 诊断客户端可以连接。服务未配置通配 Origin。部署到其他主机前应在后续阶段完成账户授权、TLS 和数据持久化。

## 通道契约

- 房间名：`mc/v1/<encodeURIComponent(workspaceId)>/<encodeURIComponent(pageId)>`。服务端校验规范编码、长度及控制字符；不同工作区和页面隔离。
- 前端等待本地 hydration 完成且页面存在后连接。切页、换工作区、删当前页、卸载及 StrictMode 重挂载时清理 Provider、WebSocket、Y.Doc 和事件监听。
- Provider 每 15 秒主动同步以维持消息活动；45 秒无消息时重建连接。连接失败按 1～30 秒指数退避并加入随机抖动，无限重试；浏览器 offline 事件主动断开，online 恢复连接。
- WebSocket 连接建立与房间初始同步分开判断；状态指示只表示传输通道就绪。**当前编辑器和多维数据库内容依旧仅走本地 Store/IndexedDB，未绑定 Y.Doc**，分别由 Day 16 / Day 18 接入。状态提示不会宣称内容已同步。
- 文档只存在服务端内存；最后连接离开后可能卸载，服务重启丢失内存。测试中的重启补发依赖客户端 Y.Doc 仍存活，不代表已交付离线缓存。Day 19 持久化、Day 20 y-indexeddb 在后续实现。
- 默认单条 WebSocket 消息上限 1MiB；大文档传输限制应在后续容量测试中调整。
- SIGINT/SIGTERM 停服会关闭文档会话及升级的 TCP 连接。端口被占用时明确失败退出。

## 验证

```powershell
npm --prefix mc_web run verify:day15
npm --prefix mc_web test
npm --prefix mc_web run build
```

专项入口同时运行 7 项 React 生命周期/状态测试、生产客户端的 6 项真实通道测试，以及 3 项服务端配置/HTTP/Origin/端口冲突测试。真实通道测试使用独立子进程服务与临时端口，不会连接外部服务；包括两客户端双向 Yjs 更新、房间隔离、断线重连、服务重启、服务迟到、心跳超时、重复 online/快速上下线竞态和销毁清理。

API 依据：[服务端配置](https://tiptap.dev/docs/hocuspocus/server/configuration)、[Provider 配置](https://tiptap.dev/docs/hocuspocus/provider/configuration)。
