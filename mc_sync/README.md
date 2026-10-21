# mc_sync · Day 15～19 协同与 PostgreSQL 快照

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
| MC_SYNC_DATABASE_URL | 未设置（内存模式） | PostgreSQL 连接 URL；显式配置但不可用时启动失败 |
| MC_SYNC_STORE_DEBOUNCE_MS | 500 | 写入防抖，0～60000ms |
| MC_SYNC_STORE_MAX_DEBOUNCE_MS | 5000 | 持续编辑时最长调度等待，1～300000ms；不含 SQL 执行时间 |
| VITE_COLLABORATION_URL | 未设置 | 前端 ws:// 或 wss:// 地址，不接受凭据、查询串、片段 |

当前服务为本机开发通道，支持可配置 PostgreSQL 持久化，账户鉴权尚未实现。Origin 白名单是浏览器来源检查，不能代替鉴权；无 Origin 的 Node 诊断客户端可以连接。服务未配置通配 Origin。部署到其他主机前应在后续阶段完成账户授权与 TLS，并配置持久化数据库及备份。

## 通道契约

- 房间名：`mc/v1/<encodeURIComponent(workspaceId)>/<encodeURIComponent(pageId)>`。服务端校验规范编码、长度及控制字符；不同工作区和页面隔离。
- 前端等待本地 hydration 完成且页面存在后连接。切页、换工作区、删当前页、卸载及 StrictMode 重挂载时清理 Provider、WebSocket、Y.Doc 和事件监听。
- Provider 每 15 秒主动同步以维持消息活动；45 秒无消息时重建连接。连接失败按 1～30 秒指数退避并加入随机抖动，无限重试；浏览器 offline 事件主动断开，online 恢复连接。
- WebSocket 连接建立与房间初始同步分开判断；状态指示只表示传输通道就绪。**Day 16 已绑定页面标题与正文，Day 18 已接入数据库行列与单元格**；数据库标题旁显示其独立的连接状态。绑定就绪后显示“协同编辑已连接”。
- 未配置数据库时文档只在服务端内存，最后连接离开或服务重启可能丢失。Day 19 PostgreSQL 模式可从完整二进制快照恢复；Day 20 客户端离线 CRDT 缓存尚未交付。
- 默认单条 WebSocket 消息上限 1MiB；大文档传输限制应在后续容量测试中调整。
- SIGINT/SIGTERM 停服会关闭文档会话、刷新待写快照并关闭 TCP/数据库连接；失败明确报错，CLI 最长等待 15 秒后非零退出。数据库仍不可用时无法保证内存中的编辑落库。端口被占用时明确失败退出。

## 验证

```powershell
npm --prefix mc_web run verify:day15
npm --prefix mc_web run verify:day16
npm --prefix mc_web run verify:day17
npm --prefix mc_web run verify:day18
npm --prefix mc_web run verify:day19
npm --prefix mc_web test
npm --prefix mc_web run build
```

专项入口同时运行 7 项 React 生命周期/状态测试、生产客户端的 6 项真实通道测试，以及 3 项服务端配置/HTTP/Origin/端口冲突测试。真实通道测试使用独立子进程服务与临时端口，不会连接外部服务；包括两客户端双向 Yjs 更新、房间隔离、断线重连、服务重启、服务迟到、心跳超时、重复 online/快速上下线竞态和销毁清理。

API 依据：[服务端配置](https://tiptap.dev/docs/hocuspocus/server/configuration)、[Provider 配置](https://tiptap.dev/docs/hocuspocus/provider/configuration)。


## Day 16 页面数据协议与验证

页面使用 page 根 Map：schema=1、seedSource、title(Y.Text)、nodes(Y.Map)、order(Y.Array)。每个节点包含 type、content(Y.Text)、properties(Y.Map) 和 children(Y.Array ID)。顺序与节点实体分离，重排不重建文本，投影去重；删除节点优先于对旧节点的并发写入。

首连完成后客户端发送 initialize-page stateless 请求。空房间只接受首个合法快照，已有房间忽略后续初始化提案；迟到客户端采用共享内容，握手期间本地修改按差异合并。标题/正文在本地 Store、Yjs 和 DOM 之间双向映射，远端反射不会形成回写循环；本人事务进入独立 Y.UndoManager，初始化和他人事务不进入本人历史。

verify:day16 包含 10 项组件测试、8 项独立进程/双客户端真实 Yjs 通信测试，并执行服务端测试（5 项，含 2 项新增初始化校验）。验收包括并发输入、结构变化、选择性撤销/重做、迟到快照、握手缓冲、页面隔离、Emoji、IME、选区、安全显示与自动保存恢复。

当前正文行内格式使用 HTML 字符串而非语义化 Yjs 格式标记，客户端渲染前清洗。页面树、图标和封面尚未同步；数据库单元格已由 Day 18 接入。未同步 CRDT 变更只在存活会话中缓存，切页销毁或关闭浏览器后恢复未同步变更仍需 Day 20 的 y-indexeddb；不要将普通 JSON 本地快照误当作完整 CRDT 历史。未配置数据库时服务端内存仍可能在最后用户离开或重启时丢失；Day 19 已支持下述 PostgreSQL 快照模式。


## Day 17 在线感知

启用上面的 VITE_COLLABORATION_URL 后，同一工作区、同一页面的成员会在顶栏显示头像及在线会话数。点击头像可修改访客昵称（最多 24 个 Unicode 字符），保存在当前浏览器中；已有其他标签页保持各自的当前昵称，新会话沿用最后保存值。每个 Provider 会话单独计数，无账户身份或访问权限含义。

正文 contenteditable、标题 input 与代码 textarea 的插入点/单块选区通过 Awareness 共享。颜色由随机会话 ID 映射为预设色，光标携带 Yjs 相对位置，文字插入后仍跟随目标。渲染为独立覆盖层，不改动本人的选区；切页/断线退出，重连后重新续报。失焦、IME 合成期间、跨块选择和无法安全对应的内容不发布光标；数据库单元格及行详情不在本日范围。

Awareness 不持久化、不写入 Y.Doc、不进入 UndoManager。Day 17 专项新增 12 项 UI/DOM 测试和 5 项真实双客户端测试，覆盖加入/改名/退出/重连、相对范围移动、房间隔离、异常状态、删除目标和监听清理；同时执行已有服务端 5 项回归。


## Day 18 数据库协同

同样设置 VITE_COLLABORATION_URL 即可启用，无需新增依赖。数据库连接使用 mc/db/v1/<workspaceId>/<databaseId> 独立命名空间，与页面房间 mc/v1/<workspaceId>/<pageId> 隔离。当前页面（含行详情正文）引用同一数据库多次时只连接一次，并阻断循环引用；同库 ID 可以被不同页面引用。工作区/页面绑定成功后再开启数据库会话，切页/换空间或引用移除时清理。

元信息、字段、选项、行和单元格分别映射 Y.Map，顺序映射 Y.Array。服务端对 initialize-database 请求校验房间 ID、结构、类型、顺序及容量，再一次性初始化；后续旧快照不覆盖共享库。不同单元格并发可同时保留，同一单元格（多选数组也视为一个值）由 Yjs 确定性裁决并最终收敛。字段迁移使用类型版本，旧版本写入不污染新类型；删除行列或数据库后，旧编辑不能复活它们。不存在分区下的线性强一致性保证。

远端更新写回 Store，并沿用 500ms IndexedDB 自动保存。视图、筛选、排序和画廊设置是本地偏好，不广播给其他人；结构变化后仍清理失效配置。单元格编辑保留本地草稿，字段和行的身份均与位置分离，类型变更/删除会退出失效编辑器。数据库房间不启用 Awareness，页面成员列表不受其影响。

行详情正文 blocks 目前按整段数组原子同步，没有逐字合并或数据库级协同撤销。Day 19 已支持可配置 PostgreSQL 文档及删除墓碑持久化，未配置时仍为内存模式；客户端离线 CRDT 缓存留待 Day 20。已有本地 JSON 快照不是完整 CRDT 历史，最后客户端关闭后不能据此保证重放全部离线冲突。

verify:day18 包含 9 项组件、10 项真实双客户端和当前 7 项服务端测试。真实测试覆盖并发单元格、行列新增/重排、删除与旧编辑、字段类型迁移、选项删除、整库墓碑、迟到/缺失快照、握手缓冲、空间隔离及独立行正文和元信息；使用独立服务子进程与临时端口。


## Day 19 PostgreSQL 持久化

准备一个现有 PostgreSQL 数据库及专用角色（需要 public schema 的 CREATE 权限和快照表 SELECT/INSERT/UPDATE 权限）。服务自动创建 mc_yjs_documents 表，不自动创建数据库或用户。本轮在真实 PostgreSQL 18.4 上验证；不代表已在 PostgreSQL 16 或所有版本上验收。

从仓库根目录启动：

```powershell
$env:MC_SYNC_DATABASE_URL = 'postgresql://mc:REPLACE_ME@127.0.0.1:5432/mc'
npm --prefix mc_sync start
Invoke-RestMethod http://127.0.0.1:1234/healthz
```

请替换示例用户、密码和数据库。不要把凭据放入 VITE_*（会暴露给前端）或提交到 Git。也可复制 mc_sync/.env.example 为已忽略的 mc_sync/.env.local，并从根目录执行 `node --env-file=mc_sync/.env.local mc_sync/src/index.mjs`；普通 npm start 不自动读取 .env 文件。生产依赖可用 `npm --prefix mc_sync ci --omit=dev` 安装，不包含测试用数据库二进制。

成功启动日志与健康检查应显示 storage: postgresql。未配置 URL 时兼容既有 memory 模式；配置了 URL 而连接/建表失败时直接启动失败，不降级成内存。运行中数据库不可用、有待重试的失败快照或加载错误时，/healthz 返回 HTTP 503 / degraded，并提供 pendingDocuments、loadErrors 计数；恢复且积压清空后回到 200。不会在诊断中输出数据库 URL 或密码。

onLoadDocument 在握手初始化前读取快照；onStoreDocument 使用 Hocuspocus 的 500ms 防抖/5000ms 最长等待。保存完整 Yjs update（二进制身份、删除历史、页面块、数据库单元格和删除墓碑），gzip 后写入 BYTEA，附 format=1、SHA-256、原始长度及更新时间。Awareness 和本地视图偏好不写入文档。压缩与解压后的大小均限制为 16MiB；既有单条 WebSocket 1MiB 限制仍独立存在。

每次写入事务先建立并锁定文档行，将数据库已有状态和新状态按 Yjs 合并后提交，避免并发写者互相覆盖。这个存储合并不提供多实例实时广播，当前实时协同仍按单服务实例运行。不要直接用 JSON 重建或替换 Yjs 二进制数据；页面树等未接入协同的数据也不包含在快照中。

保存失败时保留服务端文档，自动每秒重试，不要求下一次编辑来触发恢复。损坏的 gzip、校验和、版本或 Yjs 状态会拒绝加载，旧客户端初始化不会覆盖它。修复数据库连接或由管理员从可信备份恢复该行后，重新连接可重试；不要通过删除快照来掩盖损坏。数据库需独立备份和运维。

正常停服刷新已经到达服务端的待写内容；硬退出只保证已提交到 PostgreSQL 的状态。网络仍在途、最后防抖窗口中的内容以及数据库故障期间未落库的数据，在进程/机器崩溃时仍可能丢失。前端“协同编辑已连接”是传输状态，不是每次编辑的数据库落盘确认。客户端关闭后的离线 CRDT 恢复留给 Day 20。

### 可重复验证

先安装两个工程依赖。`npm --prefix mc_web run verify:day19` 执行 13 项服务端测试及 7 项真实 PostgreSQL 验收。测试需要支持原生 TypeScript 的 Node.js（本机 24.16.0；建议 >=22.18）和 embedded-postgres 支持的平台；Linux 需以可运行 PostgreSQL 的非 root 用户执行。

测试专用 embedded-postgres 是 devDependency，首次安装会获取当前平台 PostgreSQL 二进制（Windows x64 约 109MB），不依赖 Docker 或系统数据库服务。每轮创建随机密码、本地临时端口与 mc-day19-* 临时目录，结束关闭自有数据库进程并校验路径后清理；不连接你的实际数据库。生产客户端与后端分别运行在独立进程，避免两套 npm 工程重复加载 Yjs。

覆盖 BYTEA/gzip/校验、事务并发首写、短突发与持续编辑防抖、停服刷新、显式数据库不可用启动失败；独立服务重启后全新客户端恢复页面/数据库/墓碑、已落库状态硬退出恢复、真实 PostgreSQL 停机再启动后自动重试、损坏行拒绝加载且不被旧快照覆盖。本日没有 UI 变更，验收以真实 SQL、WebSocket 和进程生命周期为主。

实现依据：[Hocuspocus 持久化指南](https://tiptap.dev/docs/hocuspocus/guides/persistence)、[测试数据库运行器](https://github.com/leinelissen/embedded-postgres)。
