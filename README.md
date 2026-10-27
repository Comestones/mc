# 🌌 mc (Modular Collaboration / Multi-dimension Core)

自主可控、私有化部署、支持本地极速响应与双人/多人无缝实时协作的 **Notion 级多维知识库与结构化数据库平台**。

---

## 📚 项目核心文档导航

- 📋 **[系统架构与宏观规划 (Product Architecture & Planning)](mc_software/plan.md)**: 了解项目定位、技术选型（React + Yjs + Hocuspocus + PostgreSQL + S3）、三大多维视图与系统架构。
- 🚀 **[每日推进与研发规划指南 (Daily Development Plan & Roadmap)](DAILY_DEVELOPMENT_PLAN.md)**: 35 天按日精细化拆解、每日微迭代闭环工作法与动态进度看板。

---

## 🛠️ 技术栈总览

| 模块 | 当前实现 / 后续规划 |
| :--- | :--- |
| **前端 Web & UI** | 已实现：React 18.3.1 + TypeScript + Vite + Tailwind CSS + Lucide + Zustand；Shadcn UI 尚未接入 |
| **编辑器与协同内核** | 已实现：自主轻量块树引擎 (`mc-block-engine`)，实现 BlockNode 1:1 双向绑定与常用块编辑；已接入可选 Yjs 通道与标题/正文编辑器双向绑定；已接入 y-indexeddb 格式的完整 CRDT 离线缓存与关闭恢复 |
| **桌面客户端壳** | 规划：Tauri 2.0 (Rust) |
| **后端 API & WebSocket** | 已实现：Node.js + Hocuspocus；可选 JWT/Session 认证 API 与房间授权，前端初始化/登录入口已接入，账户文档编辑入口待接入 |
| **数据持久化与存储** | 已实现：本地 IndexedDB、可配置 PostgreSQL Yjs gzip/BYTEA 快照（pg 驱动，真实 PostgreSQL 18.4 验证）；S3 对象存储待实现 |
| **部署形式** | 当前为 mc_web 与 mc_sync 独立 npm 工程；规划 Docker Compose 一键启动 |

---

## 📍 当前进度与最新交付

截至 2026-10-27，已完成 **Day 1 至 Day 24（24 / 35，68.6%）**。本轮优先补推 DAY23，远程 main 已核验为 35352cab30d0ae7c61f39204ae1225c706d3f03e；DAY24 提交后独立核验同步结果。多维数据库支持字段编辑、Row as Page 行详情、看板和画廊；三视图 Tab、看板分组、画廊配置及组合筛选/多字段排序均可在自动保存完成后刷新恢复。

- **Day 1 基础骨架**：完成递归页面树、页面 CRUD、动态面包屑、明暗主题切换、Emoji 与远程封面更换，以及 Ctrl+K / Cmd+K 全局快捷搜索。
- **Day 2 基础块编辑闭环**：
  - 交付 `mc_web/src/components/editor/` 块编辑器核心，完成自主块树架构选型，无缝映射 `BlockNode` 数据模型。
  - 支持段落 (Paragraph)、一至三级标题 (Heading 1-3) 实时编辑与无损类型切换。
  - 支持分割线 (Divider) 插入、聚焦、安全删除及后置回车连续输入。
  - 支持键盘 Enter 智能拆分（标题拆分降级段落）、Backspace 向上合并与标题降级、首块越界防护与空文档默认段落兜底。
  - 具备中文输入法 (`isComposing`) 防误拆锁、纯文本多行粘贴自动拆块与本地撤销/重做 (Undo/Redo) 栈。
  - 通过 `key={doc.id}` 彻底隔离多文档编辑生命周期，编辑内容实时同步 Store 并与全局搜索联动，既有 Todo/Callout 块正常兼容。
- **Day 3 列表与待办块实现 (Todo / List)**：
  - 支持无序列表 (Bullet list)、有序列表 (Numbered list) 与待办清单 (Todo block) 实时编辑、渲染与无损互相转换。
  - **动态连续序号算法**：有序列表无需存储硬编码序号，按同级连续规则动态向前扫描计算，遇到浅层项或非有序列表块即时中断重置。
  - **待办清单交互**：支持点击与快捷键勾选，勾选后文本划线置灰但依然保持可编辑能力；拆分新待办初始为未勾选。
  - **严格 Tab 嵌套与防跳级**：`Tab` 仅在与前项同属列表家族时允许缩进，且限制 `level <= prevBlock.level + 1` 彻底杜绝跳级；`Shift+Tab` 逐级缩退至 0。
  - **边界响应与剪贴板**：非空项 Enter 拆分同类同级新块；空项 Enter 优先缩退一级，根级退出为段落；块首 Backspace 优先缩退或合并；列表内多行粘贴拆解为同类型同级块。
  - **双重测试与构建保障**：Vitest 真实组件测试 25/25 全绿，`verify:day3` 核心验收脚本通过，`verify:day2` 回归通过，`npm run build` 零错误。
- **Day 4 增强块组件 (Code / Quote / Callout)**：
  - **代码块 (Code block)**：基于 Prism.js Token 纯 React 节点树实现 100% 杜绝 XSS 注入的语法高亮渲染；支持 14 种主流编程语言切换、横向滚动与自动折行、一键复制到剪贴板；支持 `Tab`/`Shift+Tab` 2 空格缩进/缩退、`Ctrl+Enter` 快捷退出到下方新段落、空代码块退格自动降级为段落。
  - **引用块 (Quote block)**：语义化左侧高亮边框与斜体排版，支持在任意位置 Enter 拆分为两个引用块、空引用块 Enter / Backspace 安全退出降级为普通段落。
  - **提示块 (Callout block)**：独立容器化设计，支持 Popover 快速选择 12 款预设常用 Emoji/图标、右上角悬浮快速切换 5 种主题色彩基调 (`neutral`, `info`, `success`, `warning`, `danger`)；支持非空回车拆分与空块回车/退格安全退出。
  - **容器隔离与属性安全**：建立 `TEXT_MERGEABLE_BLOCK_TYPES` 白名单与 `cleanBlockProperties` 跨类型清洗规则；在 Code/Callout 下方退格时严格保护容器结构，不发生文本误合并；所有属性与结构变动全面接入 Store 撤销重做 (Undo/Redo) 栈。
  - **全量自动化验证**：扩充 Vitest 组件测试至 33 项（全通过），`verify:day4`、`verify:day3`、`verify:day2` 脚本全部通过，TypeScript 与 Vite 生产构建零报错。
- **Day 5 斜杠指令 (Slash Command `/`) 与浮动菜单 (Bubble Menu)**：
  - **斜杠指令系统 (Slash Command `/`)**：输入 `/` 呼出轻量快捷命令菜单；计算光标相对视口位置精准浮动定位并防止下边缘溢出；支持全拼与拼音首字母模糊检索（如 `dm` 匹配代码块、`bt` 匹配标题、`db` 匹配待办、`ts` 匹配提示块）与英文指令；支持键盘 `↑`/`↓` 循环导航、`Enter` 选中转换并自动清除 `/` 触发词，接入 Undo/Redo 历史栈。
  - **选区浮动工具栏 (Bubble Menu)**：划选文本时动态居中浮动于选区上方（顶端自动下翻）；提供加粗 (Bold)、斜体 (Italic)、下划线 (Underline)、删除线 (Strikethrough)、行内代码 (Inline Code) 与超链接 (Link) 6 大行内格式化；全工具项 `e.preventDefault()` 严防选区失焦坍塌；支持当前选区格式激活态感知与动态点亮；内置轻量 URL 输入弹窗。
  - **行内安全与 XSS 防护**：建立轻量 `sanitizeHtml` 白名单清洗引擎，严格仅允许安全行内标签与合法协议 URL。
  - **全量自动化验证**：Vitest 真实组件测试扩充至 40 项全部通过，`verify:day5` 核心验收脚本通过，TypeScript 与 Vite 生产构建零报错。
- **Day 6 块级拖拽排序与批量操作 (Drag & Drop & Batch Operations)**：
  - **6-dot 悬浮手柄**：在 `BlockItem.tsx` 交付可拖拽 `GripVertical` 抓手（`draggable={true}`，`cursor-grab`），悬浮或选中时显示，具备无障碍属性与测试属性隔离。
  - **拖拽重排引擎**：基于 HTML5 Drag and Drop API 与 `reorderBlocks` 纯函数算法，支持单块与多块连续/非连续整体拖拽，动态计算目标块上下插入指示线 (Drop Indicator)，单次原子化提交 Undo/Redo 历史栈。
  - **批量多选与操作**：支持普通点击单选、Shift+Click 连续区间选择 (`getBlocksRange`)、Ctrl/Cmd 增量多选，选区呈现淡蓝色高亮外框；交付 `BatchActionBar.tsx` 底部操作条，支持一键 Backspace/Delete 批量删除（清空后保底默认段落）、Ctrl+C 批量 Markdown 复制、Escape 取消选区。
  - **全量自动化验证**：Vitest 真实组件测试扩充至 46 项全部通过，新增 `scripts/verify-day6.mjs` 覆盖 6 大纯函数测试集全部通过，`verify:day2` ~ `verify:day6` 回归全部通过，TypeScript 与 Vite 生产打包零报错。
- **Day 7 本地离线持久化 (IndexedDB) 与 Sprint 1 阶段总结**：
  - **IndexedDB 版本化快照**：建立 `mc_workspace_db` 对象存储与版本化 schema (`WorkspaceSnapshot` v1)；冷启动异步 Hydration 先读取校验快照再开放编辑，无快照时落入默认示例数据，彻底防止初始示例覆盖用户本地修改。
  - **500ms 防抖自动保存与容错降级**：页面增删改、块更新、主题与侧边栏变动防抖自动持久化；顶栏 Navbar 呈现响应式状态徽标（`已保存本地` / `保存中...` / `存储降级` / `离线就绪`）；存储受限或报错时优雅降级为纯内存编辑，保障非阻塞操作。
  - **页面树完整性与级联删除**：交付 `cascadeDeletePage` 算法，递归级联删除父页面与其所有嵌套后代，根除孤立 `parentId` 残留；删除激活页时智能安全回退至存活父级或顶级页面；删除弹窗明确提示子页面总数。
  - **全量自动化验证与阶段收官**：Vitest 真实组件测试扩充至 **54 项全部通过 (0 warnings / 0 errors)**，新增 `scripts/verify-day7.mjs` 覆盖 5 大测试集通过，`verify:day2` ~ `verify:day7` 全套验收脚本全部通过，TypeScript 零错误，Vite 生产构建成功。
- **Day 8 多维数据库 Schema 设计与底层数据层 (Database Core Engine)**：
  - **规范化实体契约**：在 `src/types/database.ts` 定义 `DatabaseSchema`、`DatabaseProperty`、`DatabaseRow`、`DatabaseCell` 与可扩展属性类型（title, text, number, select, multiSelect, checkbox, date, url）与单元格值联合。
  - **不变量保护与纯函数数据层**：交付 `databaseUtils.ts` 纯函数，严格断言与维护主标题列唯一性、`propertyOrder`/`rowOrder` 1:1 键集合对齐、禁止删除主标题列、禁止篡改主标题列类型，并在删除普通属性列时原子化级联移除所有行关联 cell。
  - **响应式 Store 与自动保存**：在 `useWorkspaceStore.ts` 扩展 `databases` 状态切片与 12 项增删改查 actions/selectors，原子化接入 500ms 防抖持久化管道。
  - **快照 v1 -> v2 平滑迁移**：升级 `WorkspaceSnapshot` 至版本 2，交付 `migrateSnapshotToV2` 兼容旧版快照，拦截未知未来高版本。
  - **Block 树基线与斜杠指令**：交付 `DatabaseBlock.tsx` 及其未找到回退占位卡片；斜杠指令支持 `/sjk`, `/table`, `/db`, `/biaoge` 秒级唤出并关联新数据库。
  - **全量测试与回归**：新增 `scripts/verify-day8.mjs`（6 大模块验收全部通过），Vitest 组件测试扩充至 58 项全部通过，Day 2~7 历史全量验收脚本零回归，生产构建零错误打包成功。
- **Day 9 表格视图 (Table View) 核心交互 (Table Component Architecture & Interaction)**：
  - **组件架构解耦**：将 `DatabaseBlock.tsx` 拆分为模块化组件树（`DatabaseTable.tsx`、`TableHeader.tsx`、`TableRow.tsx`、`TableCell.tsx`），严格通过 `databaseId` 与细粒度 selector 订阅状态，杜绝复制整库到局部 state。
  - **Pointer Events 列宽拖拽**：实现平滑调整手柄，动态约束宽度在 `120px ~ 600px`（`MIN_COLUMN_WIDTH` / `MAX_COLUMN_WIDTH`）；拖拽期间实时视觉反馈，`pointerup` 时单次原子化提交 Store，提供组件卸载安全防护。
  - **内联编辑与 IME 防护**：`title` 与 `text` 字段支持双击、`Enter` 或 `F2` 进入编辑态；`Enter` 提交并向下转移焦点，`Tab` 提交并向右移动，`Shift+Tab` 提交并向左移动，`Escape` 取消并保留原值，`onBlur` 失焦提交；挂载 `isComposing` 输入法合成锁，拼音候选阶段绝不误提交或退出。
  - **无障碍与 Roving Tabindex**：完整支持 WAI-ARIA `grid`, `row`, `columnheader`, `gridcell` 语义；方向键自由穿梭单元格，空表引导与新增行自动聚焦标题列。
  - **全量测试与回归**：新增 `scripts/verify-day9.mjs`（5 大核心交互验收全部通过，200 行插入 ~3ms、更新 ~0.8ms），Vitest 扩充至 **66 项全部通过**，全套历史回归零错误，生产构建连续两次成功。
- **Day 10 基础字段类型系统 (Property Types: text, number, checkbox, select, multiSelect)**：
  - **数据契约与原子安全迁移**：为 5 大基础类型定义统一空值、解析、规整与校验规则；标签值统一持久化稳定 option ID；跨类型转换（如 text ↔ number ↔ checkbox ↔ select ↔ multiSelect）提供纯函数 `migrateCellForTypeChange` 与 `changePropertyType` 原子化迁移，级联清理删除选项，严禁悬空 ID 与 `NaN`。
  - **专用单元格编辑器**：拆分 `TextCellEditor`（文本/标题编辑、IME 防误触）、`NumberCellEditor`（数字过滤、monospace 右对齐）、`SelectCellEditor`（单选 Popover、搜索过滤、新建选项、色彩高亮、上下方向键隔离）、`MultiSelectCellEditor`（多选 Popover、批量勾选、标签徽章展示、一键清除）。
  - **字段与选项配置**：`ColumnConfigPopover` 支持列重命名、字段类型安全切换（主标题列禁止改类型与删除保护）、删除列；Select/Multi-select 支持选项新增、重命名、8 款精选预设色彩选择、删除与行数据级联清理。
  - **无障碍与交互隔离**：Checkbox 支持 Space 键即时勾选与点击切换；选项 Popover 打开时隔离 Grid 导航，关闭后平滑归还单元格焦点。
  - **全量测试与回归**：新增 `scripts/verify-day10.mjs`（6 大核心契约与 200 行原子迁移耗时 < 1ms），Vitest 测试扩充至 **80 项全部通过**，Day 2 ~ Day 9 全量历史回归零报错，默认生产构建连续两次以退出码 0 成功打包。
- **Day 11 扩展字段类型与行详情弹窗 (Extended Property Types & Row as Page)**：
  - **扩展字段契约与安全**：交付 `date`（本地 `YYYY-MM-DD` 严格格式与虚构日期拦截，防时区漂移）、`url`（协议白名单校验、无协议自动补全 `https://`、恶意协议拦截、外链安全属性）与 `createdTime`（纯只读派生自 `DatabaseRow.createdAt`，禁止写入 `row.cells`）。
  - **专用单元格编辑器**：交付 `DateCellEditor`（实时输入校验、Escape 回退原值、错误状态提示与 `aria-invalid`）、`UrlCellEditor`（自动补全协议、恶意协议拦截、外部链接安全打开）与 `CreatedTimeCell`（只读格式化展示，无额外 tab stop）。
  - **表头新增字段下拉菜单**：表头新增列入口拆分为快速添加文本列按钮与类型下拉菜单触发器，支持直接从下拉菜单选择并添加 8 种字段类型。
  - **Row as Page 数据模型与正文编辑**：`DatabaseRow` 扩展 `blocks?: BlockNode[]`；`BlockEditor` 解耦为受控/注入模式；旧快照自愈保底默认段落；行删除级联清理正文。
  - **行详情弹窗 (DatabaseRowDetail)**：交付 `role="dialog"` 抽屉弹窗，顶部主标题与属性网格实时双向同步，正文内嵌 `BlockEditor`，完整支持焦点捕获、Escape 关闭与焦点精确归还。
  - **全量测试与回归**：新增 `scripts/verify-day11.mjs`（6 大核心契约与 200 行基准耗时全部达标），Vitest 真实组件测试扩充至 **80 项全部通过**，Day 2 ~ Day 10 全量历史回归零报错，默认生产构建连续两次以退出码 0 成功打包。

## 🎯 Sprint 2 交付（Day 8 - 14）与下一阶段

- **Day 8**：多维数据库 Schema 设计与底层数据层 *(已完成)*。
- **Day 9**：表格视图 (Table View) 核心交互、列宽拖拽调整与单元格即时点按编辑 *(已完成)*。
- **Day 10**：基础字段类型系统 (Property Types: text, number, checkbox, select, multiSelect) *(已完成)*。
- **Day 11**：扩展字段类型 (Date, URL, CreatedTime) 与行详情展开为页面 (Row as Page) *(已完成)*。
- **Day 12**：看板视图 (Board / Kanban View)，单选字段分组、跨列拖拽更新状态、键盘移动、列内新增、行详情与表格共享数据 *(已完成)*。
- **Day 13**：响应式画廊、URL 字段封面、摘要字段开关、三视图键盘 Tab 与配置持久化 *(已完成)*。
- **Day 14**：三视图共享 AND 筛选、多字段升降序排序与优先级调整、空值处理、配置持久化和编辑身份保护 *(已完成)*。

- **Day 15**：新增 mc_sync Hocuspocus 服务、可选客户端 Provider、通道状态、心跳/自动重连与切页资源清理 *(已完成)*。Day 16 已绑定页面标题和正文，Day 18 已接入数据库数据协同。
- **Day 16**：页面标题、块内容/类型/属性/增删/顺序协同，首次初始化防重复、并发字符合并、本人撤销/重做、光标与中文输入法保护 *(已完成)*。
- **Day 17**：在线头像/访客昵称、正文与标题/代码实时光标和单块选区、切页/断线退出与重连恢复 *(已完成)*。

- **Day 18**：独立数据库协同房间，按行列/单元格增量同步、初始化与删除防复活、字段类型冲突保护、草稿与列身份保护，视图偏好保留本地 *(已完成)*。

- **Day 19**：PostgreSQL 完整 Yjs 二进制压缩快照、事务合并、故障重试、停服刷新和损坏保护；全新客户端重启恢复页面、数据库及墓碑 *(已完成)*。启用需配置 MC_SYNC_DATABASE_URL，默认仍为内存模式。

- **Day 20**：页面/数据库完整 CRDT 离线缓存，先恢复再联网；事务提交后报告缓存已保存，关闭重开、并发合并和缓存异常保护通过验证。未访问过的房间、页面树及网页静态资源离线启动不在本日范围。

- **Day 21**：连接风暴复用握手与退避，16 客户端弱网/丢帧/中断及 PostgreSQL 恢复验收，记录传播分位数、资源释放及可重复压测报告 *(已完成)*。详见 [压测范围与实测](mc_web/benchmarks/README.md)。

详细任务、核查依据及验收清单见 [每日研发规划](DAILY_DEVELOPMENT_PLAN.md)。

## 🚀 本地开发与验收

```bash
cd mc_web
npm ci
npm run dev
```

- 在 `mc_web` 目录执行 `npm test` 运行 Vitest 真实组件测试套件（**159 项通过**；存储故障注入测试会输出预期诊断）。
- 执行 `npm run verify:day21` 运行 3 项弱网/多客户端场景及服务端回归；`npm run benchmark:day21` 更新有限负载实测 JSON，参数及指标口径见 [压测说明](mc_web/benchmarks/README.md)。
- 执行 `npm run verify:day20` 运行 9 项缓存/UI、4 项独立服务+PostgreSQL 联合恢复测试和 13 项服务端回归；真实浏览器已验证断线编辑、关闭重开、续写与重连。
- 执行 `npm run verify:day19` 运行 13 项服务端和 7 项真实 PostgreSQL 验收，自动使用隔离临时数据库，详见 [持久化配置](mc_sync/README.md#day-19-postgresql-持久化)。
- 执行 `npm run verify:day18` 运行 9 项数据库协同组件测试、10 项真实双客户端测试和 7 项服务端回归。
- 启用协同后数据库标题旁显示独立的连接状态；数据同步覆盖表格、看板和画廊，视图/筛选/排序各自保存在本地。同一单元格同时提交时确定性裁决；行正文按整段 blocks 原子同步。
- 执行 `npm run verify:day17` 运行 12 项在线感知组件/选区测试、5 项真实双客户端测试和服务端回归。
- 协同启动方式见 [mc_sync 配置说明](mc_sync/README.md)；接通后点击顶栏头像修改访客昵称，其他人可看到正文、标题及代码的编辑光标。在线数量按标签页会话计数。
- 执行 `npm run verify:day13` 运行 Day 13 的 13 项组件测试与配置契约验收。
- 执行 `npm run verify:day14` 运行 Day 14 的 18 项查询/组件测试及 200 行性能与数据契约验收。
- 使用数据库 Tab 下的“筛选与排序”添加条件和排序；多个条件需全部满足，排序从上到下按优先级执行。空值用“为空”筛选，未填写值的条件暂不生效；清空后恢复全部记录和原始顺序。
- 执行 `npm run verify:day12` 运行 Day 12 看板的 10 项真实组件与数据验收。
- 执行 `npm run verify:day11` 运行 Day 11 扩展字段与行详情验收。
- 执行 `npm run verify:day10` 运行 Day 10 基础字段类型系统验收。
- 执行 `npm run verify:day9` 运行 Day 9 表格视图核心交互验收。
- 执行 `npm run verify:day8` 运行 Day 8 多维数据库 Schema 与底层数据层验收。
- 执行 `npm run verify:day7` 运行 Day 7 本地离线持久化与数据完整性验收。
- 执行 `npm run verify:day6` 运行 Day 6 块级拖拽重排与批量操作验收。
- 执行 `npm run verify:day5` 运行 Day 5 斜杠指令状态机、拼音算法、选区与安全清洗验收。
- 执行 `npm run verify:day4` 运行 Day 4 代码块、引用块与提示块验收。
- 执行 `npm run verify:day3` 运行 Day 3 列表与待办块验收。
- 执行 `npm run verify:day2` 运行 Day 2 基础编辑器回归测试。
- 执行 `npm run build` 完成 TypeScript 检查与生产打包构建。

## 📅 每日开发推进建议

打开 [DAILY_DEVELOPMENT_PLAN.md](DAILY_DEVELOPMENT_PLAN.md) 查看当前进度与今日目标。每日只需输入：

> *"今天我们推进 [Sprint 4 - Day 22: PostgreSQL 用户与空间模型]，请查看 DAILY_DEVELOPMENT_PLAN.md 并开始。"*

即可快速进入当日开发闭环！


## Day 15～21 协同服务与编辑器启动

要求 Node.js >=22。在一个终端运行 `npm --prefix mc_sync ci` 和 `npm --prefix mc_sync start`。健康检查为 `http://127.0.0.1:1234/healthz`。

另一个 PowerShell 终端中设置 `$env:VITE_COLLABORATION_URL = 'ws://127.0.0.1:1234'` 后运行 `npm --prefix mc_web run dev`；未设置该变量时为本地编辑模式。也可使用 mc_web/.env.example 创建已忽略的 .env.local。

执行 `npm --prefix mc_web run verify:day15` 运行前端生命周期、真实通道与服务端专项测试（需要先安装两个工程的依赖）。[完整配置与运行说明](mc_sync/README.md)。服务已绑定页面标题、正文与数据库；可配置 PostgreSQL 持久化，未配置时为本机内存通道。DAY22 已提供可选后端 required 鉴权模式；前端默认使用 local 模式，配置 VITE_API_URL 可进入初始化、登录与邀请账户入口；账户文档编辑尚未接入。

执行 `npm --prefix mc_web run verify:day16` 运行编辑器组件、真实双客户端并发和服务端初始化验收。两个客户端需使用相同工作区和页面 ID；数据库单元格已在 Day 18 接入，页面树仍待后续。


### 每晚自动推进

当前 Codex 聊天已配置每天本地时间 20:00（Asia/Shanghai）的定时继续任务，状态为 ACTIVE。每轮读取实际进度，最多完成最早未完成的一个 Day：规划 → 实现 → 自测/回归与构建 → 更新验收记录 → commit/push → 核对远程 SHA；下一轮核验 Git 状态与同步证据后，从 Day 25 S3 / MinIO 附件服务对接开始。此配置在本机 Codex 中，不是仓库内 GitHub Actions，克隆仓库不会自动启用。

运行时须保持电脑开机且不睡眠、桌面应用运行、项目目录和网络可用、GitHub 凭据有效。定时任务沿用权限边界：本项目部分文件写入、构建和 Git 操作仍需权限允许；本轮自动继续已完成开发与验证，提交推送以验收记录和远程 SHA 为准。未来若权限不允许，会保留工作并报告阻塞。应在应用中检查首轮结果，按需要为明确的工作区/构建/Git 命令配置允许规则；不需要为了定时任务关闭全部沙箱保护。创建定时配置与每轮实际执行结果应分别核对。详见 [官方定时任务说明](https://learn.chatgpt.com/docs/automations?surface=app)。


## Day 22 后端账户与空间基础

Drizzle 定义用户、空间、成员、邀请码、文档元数据及持久会话，提供可重复事务迁移、scrypt 密码哈希、JWT 登录/刷新/注销/me API。required 模式校验空间成员和文档归属，持续检查撤权与到期；默认 local 仅允许本机监听。完整接口、迁移及缓存接入边界见 [服务端说明](mc_sync/README.md#day-22-用户空间模型与认证-api)。

验收：认证集成 9/9、原有后端 13/13、前端 168/168、Day 19 SQL/进程恢复 7/7、Day 15～18/20/21 真实通道 36/36；默认 TypeScript/Vite 构建通过。没有新增 UI，未新增浏览器视觉验收。下一步 DAY23 初始化首个管理员与工作区；本日未预置账户、未启用长期数据库、未替用户修改本地缓存归属。


## Day 23 首次部署初始化向导

设置前端 `VITE_API_URL` 指向 required 后端后，首次访问必须通过管理员初始化向导。服务端需要独立的 `MC_SETUP_TOKEN`，防止首次访问者擅自认领部署。管理员、默认工作区和 owner 关系在同一事务中创建；并发只成功一次，重启或禁用管理员不会重新开放初始化。已有 DAY22 的 `0001.sql` 保持不变，新增 `0002.sql`。

初始化后可登录查看真实默认空间、退出；刷新后重新登录，令牌不写入浏览器存储。该入口独立于匿名编辑器，不读取或迁移旧 JSON/CRDT 缓存；账户文档编辑与缓存归属后续接入。未设置 VITE_API_URL 时仍打开原有本地编辑器。[配置与验收](mc_sync/README.md#day-23-首次部署初始化向导)。

验收：前端 175/175（新增 7 项）、初始化真实 PostgreSQL/HTTP 5/5、既有认证 9/9、后端 13/13、Day 19 持久化 7/7；TypeScript 和默认生产构建通过。真实浏览器完成创建、登录、空间确认、刷新不重开初始化、再次登录与退出，并检查默认生产编辑器入口。[浏览器截图](mc_web/benchmarks/day23-browser.jpg)。


## Day 24 邀请链接与邀请码系统

空间所有者可在账户空间卡片的“邀请设置”中生成链接，设置 1–720 小时有效期及 1–100 次使用上限，查看使用计数、撤销邀请。链接仅创建时显示；数据库仅保存随机令牌摘要。受邀者打开链接检查目标空间，注册后直接成为该空间普通成员，登录即可确认；已有账户先登录再加入，原有成员不会被降权或重复消耗次数。

邀请消费、账户创建、成员关系及次数更新在 PostgreSQL 单事务内完成，过期/撤销/耗尽及创建者失去所有者权限时拒绝。前端仍与匿名编辑缓存隔离，账户编辑入口待后续接入。

验证：前端 181/181、邀请集成 7/7、后端 13/13、认证 9/9、初始化 5/5；TypeScript/默认生产构建通过。真实浏览器验证生成 → 注册 → 成员登录 → 计数 → 撤销拒绝，见 [验收截图](mc_web/benchmarks/day24-browser.jpg) 与 [验收记录](DAILY_CHECK.md)。
