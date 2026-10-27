# mc_sync · Day 15～23 协同、鉴权与部署初始化

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
| MC_AUTH_MODE | local | local 仅允许 loopback；required 启用 PostgreSQL 会话与房间鉴权 |
| MC_AUTH_SECRET | 未设置 | required 模式必需，至少 32 字节的随机秘密，仅存服务端环境 |
| MC_SYNC_HOST | 127.0.0.1 | 监听地址 |
| MC_SYNC_PORT | 1234 | 1～65535 的整数端口 |
| MC_SYNC_TIMEOUT_MS | 60000 | 服务端健康检测超时，1000～300000ms |
| MC_SYNC_ORIGINS | localhost/127.0.0.1 的 3000、4173 端口 | 逗号分隔的精确 HTTP(S) Origin 白名单 |
| MC_SYNC_DATABASE_URL | 未设置（内存模式） | PostgreSQL 连接 URL；显式配置但不可用时启动失败 |
| MC_SYNC_STORE_DEBOUNCE_MS | 500 | 写入防抖，0～60000ms |
| MC_SYNC_STORE_MAX_DEBOUNCE_MS | 5000 | 持续编辑时最长调度等待，1～300000ms；不含 SQL 执行时间 |
| VITE_COLLABORATION_URL | 未设置 | 前端 ws:// 或 wss:// 地址，不接受凭据、查询串、片段 |

默认 local 模式是无账户的本机开发通道，非 loopback 监听会启动失败。Day 22 提供可选 required 后端鉴权，见下方接入契约；现有前端尚未提供登录/刷新接入。Origin 白名单只是来源检查，required 模式中的无 Origin 客户端同样必须提供有效令牌。远程部署应配置 TLS、持久化与备份，不能把 local 模式通过反向代理公开。

## 通道契约

- 房间名：`mc/v1/<encodeURIComponent(workspaceId)>/<encodeURIComponent(pageId)>`。服务端校验规范编码、长度及控制字符；不同工作区和页面隔离。
- 前端等待本地 hydration 完成且页面存在后连接。切页、换工作区、删当前页、卸载及 StrictMode 重挂载时清理 Provider、WebSocket、Y.Doc 和事件监听。
- Provider 每 15 秒主动同步以维持消息活动；45 秒无消息时重建连接。连接失败按 1～30 秒指数退避并加入随机抖动，无限重试；浏览器 offline 事件主动断开，online 恢复连接。
- WebSocket 连接建立与房间初始同步分开判断；状态指示只表示传输通道就绪。**Day 16 已绑定页面标题与正文，Day 18 已接入数据库行列与单元格**；数据库标题旁显示其独立的连接状态。绑定就绪后显示“协同编辑已连接”。
- 未配置数据库时文档只在服务端内存，最后连接离开或服务重启可能丢失。Day 19 PostgreSQL 模式可从完整二进制快照恢复；Day 20 已支持下述客户端完整 CRDT 缓存。
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

当前正文行内格式使用 HTML 字符串而非语义化 Yjs 格式标记，客户端渲染前清洗。页面树、图标和封面尚未同步；数据库单元格已由 Day 18 接入。未同步 CRDT 变更只在存活会话中缓存，切页销毁或关闭浏览器后恢复未同步变更，现由 Day 20 的完整 CRDT 缓存支持；不要将普通 JSON 本地快照误当作完整 CRDT 历史。未配置数据库时服务端内存仍可能在最后用户离开或重启时丢失；Day 19 已支持下述 PostgreSQL 快照模式。


## Day 17 在线感知

启用上面的 VITE_COLLABORATION_URL 后，同一工作区、同一页面的成员会在顶栏显示头像及在线会话数。点击头像可修改访客昵称（最多 24 个 Unicode 字符），保存在当前浏览器中；已有其他标签页保持各自的当前昵称，新会话沿用最后保存值。每个 Provider 会话单独计数，无账户身份或访问权限含义。

正文 contenteditable、标题 input 与代码 textarea 的插入点/单块选区通过 Awareness 共享。颜色由随机会话 ID 映射为预设色，光标携带 Yjs 相对位置，文字插入后仍跟随目标。渲染为独立覆盖层，不改动本人的选区；切页/断线退出，重连后重新续报。失焦、IME 合成期间、跨块选择和无法安全对应的内容不发布光标；数据库单元格及行详情不在本日范围。

Awareness 不持久化、不写入 Y.Doc、不进入 UndoManager。Day 17 专项新增 12 项 UI/DOM 测试和 5 项真实双客户端测试，覆盖加入/改名/退出/重连、相对范围移动、房间隔离、异常状态、删除目标和监听清理；同时执行已有服务端 5 项回归。


## Day 18 数据库协同

同样设置 VITE_COLLABORATION_URL 即可启用，无需新增依赖。数据库连接使用 mc/db/v1/<workspaceId>/<databaseId> 独立命名空间，与页面房间 mc/v1/<workspaceId>/<pageId> 隔离。当前页面（含行详情正文）引用同一数据库多次时只连接一次，并阻断循环引用；同库 ID 可以被不同页面引用。工作区/页面绑定成功后再开启数据库会话，切页/换空间或引用移除时清理。

元信息、字段、选项、行和单元格分别映射 Y.Map，顺序映射 Y.Array。服务端对 initialize-database 请求校验房间 ID、结构、类型、顺序及容量，再一次性初始化；后续旧快照不覆盖共享库。不同单元格并发可同时保留，同一单元格（多选数组也视为一个值）由 Yjs 确定性裁决并最终收敛。字段迁移使用类型版本，旧版本写入不污染新类型；删除行列或数据库后，旧编辑不能复活它们。不存在分区下的线性强一致性保证。

远端更新写回 Store，并沿用 500ms IndexedDB 自动保存。视图、筛选、排序和画廊设置是本地偏好，不广播给其他人；结构变化后仍清理失效配置。单元格编辑保留本地草稿，字段和行的身份均与位置分离，类型变更/删除会退出失效编辑器。数据库房间不启用 Awareness，页面成员列表不受其影响。

行详情正文 blocks 目前按整段数组原子同步，没有逐字合并或数据库级协同撤销。Day 19 已支持可配置 PostgreSQL 文档及删除墓碑持久化，未配置时仍为内存模式；客户端离线 CRDT 缓存已由 Day 20 接入（见下）。已有本地 JSON 快照不是完整 CRDT 历史，最后客户端关闭后不能据此保证重放全部离线冲突。

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

正常停服刷新已经到达服务端的待写内容；硬退出只保证已提交到 PostgreSQL 的状态。网络仍在途、最后防抖窗口中的内容以及数据库故障期间未落库的数据，在进程/机器崩溃时仍可能丢失。前端“协同编辑已连接”是传输状态，不是每次编辑的数据库落盘确认。客户端关闭后的离线 CRDT 恢复见下述 Day 20。

### 可重复验证

先安装两个工程依赖。`npm --prefix mc_web run verify:day19` 执行 13 项服务端测试及 7 项真实 PostgreSQL 验收。测试需要支持原生 TypeScript 的 Node.js（本机 24.16.0；建议 >=22.18）和 embedded-postgres 支持的平台；Linux 需以可运行 PostgreSQL 的非 root 用户执行。

测试专用 embedded-postgres 是 devDependency，首次安装会获取当前平台 PostgreSQL 二进制（Windows x64 约 109MB），不依赖 Docker 或系统数据库服务。每轮创建随机密码、本地临时端口与 mc-day19-* 临时目录，结束关闭自有数据库进程并校验路径后清理；不连接你的实际数据库。生产客户端与后端分别运行在独立进程，避免两套 npm 工程重复加载 Yjs。

覆盖 BYTEA/gzip/校验、事务并发首写、短突发与持续编辑防抖、停服刷新、显式数据库不可用启动失败；独立服务重启后全新客户端恢复页面/数据库/墓碑、已落库状态硬退出恢复、真实 PostgreSQL 停机再启动后自动重试、损坏行拒绝加载且不被旧快照覆盖。本日没有 UI 变更，验收以真实 SQL、WebSocket 和进程生命周期为主。

实现依据：[Hocuspocus 持久化指南](https://tiptap.dev/docs/hocuspocus/guides/persistence)、[测试数据库运行器](https://github.com/leinelissen/embedded-postgres)。


## Day 20 客户端离线 CRDT 缓存

启用 VITE_COLLABORATION_URL 后，页面和数据库会话默认启用 IndexedDB 缓存。数据库名包含协议版本、规范化服务地址、工作区、页面/数据库命名空间和实体 ID；相同服务器和房间复用，同名实体不会跨服务/工作区混用。浏览器源也天然隔离缓存，换前端端口或清理网站数据不会保留原缓存。

先将缓存完整加载到临时 Y.Doc，成功后才反映到编辑器并允许 WebSocket 握手，避免先向空服务器播种旧 JSON。已缓存房间在断线重开后即可绑定和继续编辑；重连按原始 CRDT 身份补发差异，与远端并发编辑合并，不重复播种。页面标题/正文、数据库元信息/行列/单元格和数据库删除墓碑都在缓存中；Awareness 与个人昵称不写入 CRDT 缓存。

实现固定依赖 y-indexeddb 9.0.12，复用其导出的 fetchUpdates 重放与 updates/custom 数据格式；用受控 IndexedDB 写入事务包裹错误、提交确认和每 500 次写入的原子日志压缩。上游默认构造器部分异步路径未处理拒绝，故没有直接依赖其默认写入回调。专项证明本缓存可由原版 IndexeddbPersistence 读取；升级依赖时必须重跑兼容、损坏及失败测试。未修改依赖源码。

“缓存写入中”和“离线缓存已保存”分别表示本地事务进行中/已提交，不表示 PostgreSQL 已确认。缓存拒绝、损坏、版本变更和写入中止会显示异常，不自动删除或覆盖损坏记录；缓存失败时停止该会话的联网，保留当前内存及既有 JSON 本地编辑。检查浏览器存储权限/容量、保留数据后重新打开可重试。缺少 IndexedDB 的环境会明确显示缓存不可用，仅沿用内存协同及既有本地存储，不能保证关闭后的 CRDT 恢复。

边界：须至少成功加载过房间并等到缓存已保存；尚未访问或未完成首次服务端初始化的页面继续沿用 JSON 本地编辑，联网后初始化。关页/断电前仍在进行的事务可能未提交；清空网站数据、隐私会话过期或更换服务器 URL/浏览器源会失去原缓存。未实现 Service Worker，不保证网络完全不可用时首次加载网页静态资源。页面树、图标/封面和用户权限继续按后续计划推进；没有自动清除用户 CRDT 数据的入口。

`npm --prefix mc_web run verify:day20`：9 项缓存/UI 测试使用独立 fake-indexeddb 工厂，4 项真实 WebSocket/独立进程与 PostgreSQL 18.4 测试验证销毁全部旧客户端、离线重开、双方并发合并、单元格与墓碑、缓存和服务双重重启、加载期输入缓冲及空间隔离；同时执行当前 13 项服务端回归。fake-indexeddb 仅用于测试，不进入生产包。真实浏览器另验证了实际 IndexedDB 下的断线编辑、关闭重开和重连。

测试数据库正常清理改用自带 pg_ctl 的 fast 停机，故障注入用 immediate 停机；等待进程退出后才清理临时目录，避免 Windows 强杀遗留子进程和管道。专项命令有 60 秒测试超时，失败不会被当作通过。

参考：[Yjs 离线支持](https://docs.yjs.dev/getting-started/allowing-offline-editing)、[y-indexeddb API 与实现](https://github.com/yjs/y-indexeddb)。


## Day 21 连接稳定性与 Sprint 3 验收

Session 对重复 online/connect 采用幂等处理：正在握手或退避中的自动重试由既有尝试负责，重复事件不再取消连接并重置退避；明确断开后的重新连接及已连接状态的重复通知仍正常处理。没有改变生产的 1～30 秒重试退避、15 秒同步或 45 秒 watchdog。

`npm --prefix mc_web run verify:day21` 组合 3 项真实网络场景及当前服务端测试。`npm --prefix mc_web run benchmark:day21` 记录本机 16 客户端/4 房间的延迟、应用帧丢失、全黑洞及重连循环验收，校验 PostgreSQL 二进制状态与全新客户端恢复，报告源文件哈希、传播分位数、RSS、事件循环采样及资源归零。默认不开启生产诊断端点；IPC 度量仅位于 test/fixture-server.mjs。完整实测与限制见 [压测说明](../mc_web/benchmarks/README.md)。

Sprint 3 已完成：可选传输通道 → 页面 CRDT 与本人撤销 → 成员/光标 → 数据库行列/单元格 → PostgreSQL 快照 → 客户端离线缓存 → 连接事件风暴修复与有限负载验证。下一阶段为用户、空间及会话鉴权。当前部署仍需遵守本机开发边界；页面树、完整语义富文本冲突、记录正文逐字协同、网页资源 Service Worker 和多服务实时广播尚未交付。本轮实测为功能与稳定性证据，不是生产容量或公网延迟承诺。


## Day 22 用户、空间模型与认证 API

固定依赖 Drizzle ORM 0.45.4（node-postgres）和 jose 6.2.13。`src/auth/schema.mjs` 定义 User、Workspace、Membership、InviteToken、DocumentMeta、Session；`0001.sql` 是审核过的首版迁移，启动 required 服务时在 advisory lock + 事务内应用。迁移版本/规范化 LF 的 SHA-256 记录在 mc_auth_migrations，重复启动无损；已有版本摘要不符则拒绝启动。后续改表应新增迁移，不能改写已经部署的 0001.sql。

用户 email 去首尾空白并转小写，数据库唯一且限制规范格式。密码使用随机盐 scrypt（N=32768,r=8,p=1），至少 12 字符、最多 1024 字节。is_admin 默认 false，保留给 Day 23 初始化；管理员身份不绕过空间成员校验。成员角色暂为 owner/editor，均有空间内编辑权限。InviteToken 仅建模（摘要、过期、次数、撤销），生成/消费接口留待 Day 24。DocumentMeta 以 workspace_id/kind/id 为复合主键，区分 page/database 并带删除标记；Yjs 正文仍在 mc_yjs_documents，账户迁移不改写历史快照。

required 模式必须同时提供 MC_SYNC_DATABASE_URL、MC_AUTH_SECRET，错误配置或数据库/迁移失败不会降级为 local。秘密应由本机安全随机生成并保存在私有环境，不能使用示例密码或 VITE_* 变量。服务不会创建默认账户、空间，也不会把既有无主本地文档自动归属给第一个用户。DAY23 初始化向导将调用模型完成首次注册，已有数据归属需明确迁移流程。

| 接口 | 输入 | 成功结果 |
| --- | --- | --- |
| POST /api/auth/login | JSON email/password | accessToken、expiresIn（900 秒）、refreshToken |
| POST /api/auth/refresh | JSON refreshToken | 新 accessToken 与轮换后的 refreshToken |
| GET /api/me | Authorization: Bearer accessToken | 当前用户公开字段及其工作区/角色 |
| POST /api/auth/logout | Authorization: Bearer accessToken | 撤销当前 Session，返回 ok |

只接受 Bearer 头或 Hocuspocus token 消息，不从 URL 接收凭据，不设置 Cookie。HTTP JSON 上限 4096 字节，响应 no-store，允许的浏览器 Origin 有精确 CORS 响应；无效登录统一 401，拒绝来源 403，依赖故障 503。单进程按直连 IP 限制 30 次 API 请求/分钟，最多 4 个处理中请求、1000 个限流条目；不信任 X-Forwarded-For。该限制不是分布式网关，代理场景需另配入口限制。

JWT 固定 HS256、issuer=mc-sync、audience=mc-api，校验签名、类型、exp/iat/sub/sid，并逐次检查真实 Session 与用户禁用状态。Session 固定绝对有效期 7 天（数据库时间），刷新不延长该期限；刷新令牌为 32 字节随机值，数据库只存 SHA-256，一次性原子轮换，并发使用仅一次成功。旧 refreshToken 无法重放；accessToken 在 15 分钟内仍有效，但注销会令同一 Session 的所有访问令牌失效。秘密变更会使旧 JWT 失效；持有有效刷新令牌的客户端仍能换取新 JWT，如需全部退出还须撤销 Session。

协同认证先查有效 Session，再查对应空间成员及未删除 DocumentMeta；客户端提供工作区 ID 不会自动创建成员关系。每条入站消息重验权限，防止已撤权的写入落入快照；被动连接每 5 秒重验一次，数据库查询/网络延迟另计，期间可能收到先前订阅的广播。访问令牌到期由独立定时器关闭连接。客户端需 refresh 后以新 token 重新建立 Provider；本日不支持连接内 tokenSync 延长授权。服务器关闭/连接离开会清理上述定时器。

**前端接入边界**：DAY22 是后端模型与中间件交付，现有 mc_web 仍连接 local 模式，没有登录表单、账户切换或认证令牌缓存。required 模式会拒绝该匿名前端；不要为了演示而预置账户或把令牌写入 URL。后续账户界面接入前必须按可信用户隔离 JSON/CRDT 缓存、在注销/换用户时销毁连接，且不能将 local 模式缓存默认上传到新的账户空间。离线缓存不是服务端授权凭证。

验证：`npm --prefix mc_sync run verify:day22`（13 项原有后端测试 + 9 项真实 PostgreSQL/HTTP/WebSocket 场景）。覆盖迁移与外键/唯一约束、密码、JWT 伪造/算法/受众/到期、并发刷新/重放、注销/禁用/会话过期、跨空间及 page/database 隔离、被动撤权、撤权写入不落盘、数据库停机拒绝/恢复及请求限流。用临时 PostgreSQL 18.4，不修改用户数据库。DAY22 无 UI 改动，不声称新增浏览器视觉验收。

依据：[Drizzle PostgreSQL 模型](https://orm.drizzle.team/docs/sql-schema-declaration)、[Drizzle SQL 迁移工作流](https://orm.drizzle.team/docs/migrations)、[jose JWT 签名与校验](https://github.com/panva/jose)。


## Day 23 首次部署初始化向导

在 DAY22 required 配置基础上，设置服务端 `MC_SETUP_TOKEN` 为独立的至少 32 字节随机秘密；仅通过私有渠道交给部署管理员，不使用 MC_AUTH_SECRET 代替。前端设置 `VITE_API_URL=http://127.0.0.1:1234`（远程应使用 HTTPS），重启 Vite/重新构建，并把前端的精确 Origin 加入 MC_SYNC_ORIGINS。VITE_API_URL 只含服务 origin，不允许路径、查询、凭据或片段。服务端数据库/签名秘密的准备仍是部署前提，向导不自动安装数据库。

GET /api/setup 返回 setupRequired/setupEnabled。数据库故障返回 503，不伪装成“未初始化”；没有 MC_SETUP_TOKEN 时显示配置提示，不能提交初始化。POST /api/setup 接受 JSON email/password/displayName/workspaceName/setupToken，验证密钥、邮箱、名称和密码后，在 advisory lock + 单个事务内创建 is_admin 用户、默认空间、owner 成员及一次性标记；任一步失败全部回滚，冲突返回 409，错误不泄露 SQL/秘密。状态接口不返回用户数量、邮箱或初始化密钥。

`0002.sql` 添加 mc_setup_state，并将已有管理员的 DAY22 部署标记为已初始化，不修改已提交的 0001.sql。初始化检查任意已有管理员（包括禁用者）及永久标记；后续禁用、降级管理员不重新开放认领。管理员恢复应走明确的运维恢复流程，不删除标记来解决登录问题。初始化成功后可移除 MC_SETUP_TOKEN；登录/刷新不依赖该密钥。

界面首次检测期间不挂载匿名编辑器；未初始化显示名称、空间、邮箱、密码确认和部署密钥表单。提交失败保留非秘密字段并清空密码/密钥，提供重新检查以处理并发冲突或成功响应丢失。成功后登录即可通过 /api/me 查看真实空间；凭据仅驻留当前页面内存，刷新/关闭需重新登录，页面打开期间自动轮换令牌。注销调用真实服务撤销 Session。

账户入口目前交付初始化、登录和空间确认，不提供账户空间编辑器；匿名编辑器仍由不设置 VITE_API_URL 的入口提供。两者懒加载隔离，账户入口不加载 WorkspaceStore 或其 IndexedDB。后续编辑器接入必须先实现可信用户缓存命名空间及文档归属，不能直接把匿名 Store 挂到新账户。

验证：`npm --prefix mc_sync run verify:day23`，以及 `npm --prefix mc_web test` / `npm --prefix mc_web run build`。开发者可在交互终端启动 `node mc_sync/test/setup-browser.mjs`，它创建临时 PostgreSQL、监听 1243，仅允许前端 3023 Origin；使用脚本中的明确测试密钥、虚构账户验收，输入 stop 后清理。自动化进程应保持 stdin（PTY），不要把此 fixture 当作生产服务。正式配置不会预置任何测试用户/秘密。

2026-10-26 浏览器验收在 3023/1243 完成：创建 DAY23 验收管理员及 DAY23 验收空间，登录显示空间所有者；刷新只有登录入口，重新登录和注销成功。3024 默认生产预览仍显示原编辑器。证据：[默认空间确认](../mc_web/benchmarks/day23-browser.jpg)。


## Day 24 邀请 API 与账户入口

复用 DAY22/23 required 配置及 InviteToken 表，无新迁移或依赖。以下均为 JSON POST，并沿用 Origin、no-store、4096 字节请求上限及限流：

| 路径 | 身份 / 请求 | 结果 |
| --- | --- | --- |
| /api/invites | owner Bearer；workspaceId, expiresInHours（整数 1–720）, maxUses（整数 1–100） | token、id、expires_at、max_uses |
| /api/invites/list | owner Bearer；workspaceId | invites，按到期降序最多 100 条，无令牌或摘要 |
| /api/invites/revoke | owner Bearer；workspaceId, id | 幂等撤销 |
| /api/invites/preview | token | workspaceName，不消耗次数 |
| /api/invites/register | token, email, password, displayName | 新用户及 editor 成员，joined:true；随后登录 |
| /api/invites/join | Bearer；token | 已有账户加入，joined:true |

令牌为 32 随机字节，数据库仅保存 SHA-256。链接使用 #invite= 片段，入口读取后移除地址片段，只在内存保留并通过 POST 发送，不写 localStorage/sessionStorage。原文仅生成时返回一次，请私下分享；关闭后不可找回，可撤销重建。所有者依据目标空间成员权限检查，系统管理员身份不绕过空间权限。过期、撤销、次数耗尽、创建者禁用或不再是 owner 均拒绝（410）。

注册在同一事务/邀请行锁下校验、消费次数、创建用户与 editor 成员；唯一邮箱冲突返回 409，全部回滚，请使用已有账户登录加入。已有成员使用仍有效邀请不重复消费也不降权。数据库时钟再次检查期限，防止等待锁后使用过期邀请；失败不遗留用户或消耗次数。账户编辑器与旧匿名缓存依旧隔离。

运行 npm --prefix mc_sync run verify:day24（后端 13 + 邀请集成 7），以及 mc_web 的 npm test / npm run build。沿用 setup-browser.mjs 临时数据库 fixture 可进行邀请 UI 验收；2026-10-27 实测新成员注册登录、1/2 计数及撤销拒绝，截图见 ../mc_web/benchmarks/day24-browser.jpg。
