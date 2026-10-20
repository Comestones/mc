# mc_sync · Day 15～18 页面、在线感知与数据库协同

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
- WebSocket 连接建立与房间初始同步分开判断；状态指示只表示传输通道就绪。**Day 16 已绑定页面标题与正文，Day 18 已接入数据库行列与单元格**；数据库标题旁显示其独立的连接状态。绑定就绪后显示“协同编辑已连接”。
- 文档只存在服务端内存；最后连接离开后可能卸载，服务重启丢失内存。测试中的重启补发依赖客户端 Y.Doc 仍存活，不代表已交付离线缓存。Day 19 持久化、Day 20 y-indexeddb 在后续实现。
- 默认单条 WebSocket 消息上限 1MiB；大文档传输限制应在后续容量测试中调整。
- SIGINT/SIGTERM 停服会关闭文档会话及升级的 TCP 连接。端口被占用时明确失败退出。

## 验证

```powershell
npm --prefix mc_web run verify:day15
npm --prefix mc_web run verify:day16
npm --prefix mc_web run verify:day17
npm --prefix mc_web run verify:day18
npm --prefix mc_web test
npm --prefix mc_web run build
```

专项入口同时运行 7 项 React 生命周期/状态测试、生产客户端的 6 项真实通道测试，以及 3 项服务端配置/HTTP/Origin/端口冲突测试。真实通道测试使用独立子进程服务与临时端口，不会连接外部服务；包括两客户端双向 Yjs 更新、房间隔离、断线重连、服务重启、服务迟到、心跳超时、重复 online/快速上下线竞态和销毁清理。

API 依据：[服务端配置](https://tiptap.dev/docs/hocuspocus/server/configuration)、[Provider 配置](https://tiptap.dev/docs/hocuspocus/provider/configuration)。


## Day 16 页面数据协议与验证

页面使用 page 根 Map：schema=1、seedSource、title(Y.Text)、nodes(Y.Map)、order(Y.Array)。每个节点包含 type、content(Y.Text)、properties(Y.Map) 和 children(Y.Array ID)。顺序与节点实体分离，重排不重建文本，投影去重；删除节点优先于对旧节点的并发写入。

首连完成后客户端发送 initialize-page stateless 请求。空房间只接受首个合法快照，已有房间忽略后续初始化提案；迟到客户端采用共享内容，握手期间本地修改按差异合并。标题/正文在本地 Store、Yjs 和 DOM 之间双向映射，远端反射不会形成回写循环；本人事务进入独立 Y.UndoManager，初始化和他人事务不进入本人历史。

verify:day16 包含 10 项组件测试、8 项独立进程/双客户端真实 Yjs 通信测试，并执行服务端测试（5 项，含 2 项新增初始化校验）。验收包括并发输入、结构变化、选择性撤销/重做、迟到快照、握手缓冲、页面隔离、Emoji、IME、选区、安全显示与自动保存恢复。

当前正文行内格式使用 HTML 字符串而非语义化 Yjs 格式标记，客户端渲染前清洗。页面树、图标、封面、数据库单元格尚未同步。未同步 CRDT 变更只在存活会话中缓存，切页销毁或关闭浏览器后恢复未同步变更仍需 Day 20 的 y-indexeddb；不要将普通 JSON 本地快照误当作完整 CRDT 历史。服务器内存数据仍可能在最后用户离开或重启时丢失，Day 19 将补齐快照持久化。


## Day 17 在线感知

启用上面的 VITE_COLLABORATION_URL 后，同一工作区、同一页面的成员会在顶栏显示头像及在线会话数。点击头像可修改访客昵称（最多 24 个 Unicode 字符），保存在当前浏览器中；已有其他标签页保持各自的当前昵称，新会话沿用最后保存值。每个 Provider 会话单独计数，无账户身份或访问权限含义。

正文 contenteditable、标题 input 与代码 textarea 的插入点/单块选区通过 Awareness 共享。颜色由随机会话 ID 映射为预设色，光标携带 Yjs 相对位置，文字插入后仍跟随目标。渲染为独立覆盖层，不改动本人的选区；切页/断线退出，重连后重新续报。失焦、IME 合成期间、跨块选择和无法安全对应的内容不发布光标；数据库单元格及行详情不在本日范围。

Awareness 不持久化、不写入 Y.Doc、不进入 UndoManager。Day 17 专项新增 12 项 UI/DOM 测试和 5 项真实双客户端测试，覆盖加入/改名/退出/重连、相对范围移动、房间隔离、异常状态、删除目标和监听清理；同时执行已有服务端 5 项回归。


## Day 18 数据库协同

同样设置 VITE_COLLABORATION_URL 即可启用，无需新增依赖。数据库连接使用 mc/db/v1/<workspaceId>/<databaseId> 独立命名空间，与页面房间 mc/v1/<workspaceId>/<pageId> 隔离。当前页面（含行详情正文）引用同一数据库多次时只连接一次，并阻断循环引用；同库 ID 可以被不同页面引用。工作区/页面绑定成功后再开启数据库会话，切页/换空间或引用移除时清理。

元信息、字段、选项、行和单元格分别映射 Y.Map，顺序映射 Y.Array。服务端对 initialize-database 请求校验房间 ID、结构、类型、顺序及容量，再一次性初始化；后续旧快照不覆盖共享库。不同单元格并发可同时保留，同一单元格（多选数组也视为一个值）由 Yjs 确定性裁决并最终收敛。字段迁移使用类型版本，旧版本写入不污染新类型；删除行列或数据库后，旧编辑不能复活它们。不存在分区下的线性强一致性保证。

远端更新写回 Store，并沿用 500ms IndexedDB 自动保存。视图、筛选、排序和画廊设置是本地偏好，不广播给其他人；结构变化后仍清理失效配置。单元格编辑保留本地草稿，字段和行的身份均与位置分离，类型变更/删除会退出失效编辑器。数据库房间不启用 Awareness，页面成员列表不受其影响。

行详情正文 blocks 目前按整段数组原子同步，没有逐字合并或数据库级协同撤销。服务端仍仅使用内存；删除墓碑和文档数据的持久化将在 Day 19/20 接入。已有本地 JSON 快照不是完整 CRDT 历史，最后客户端关闭后不能据此保证重放全部离线冲突。

verify:day18 包含 9 项组件、10 项真实双客户端和当前 7 项服务端测试。真实测试覆盖并发单元格、行列新增/重排、删除与旧编辑、字段类型迁移、选项删除、整库墓碑、迟到/缺失快照、握手缓冲、空间隔离及独立行正文和元信息；使用独立服务子进程与临时端口。
