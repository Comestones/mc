# 「mc」每日推进与研发规划指南 (Daily Development Plan & Roadmap)

> 本文档旨在为 **「mc」多维知识库与协同系统** 提供清晰、可落地、按天推进的日常开发路径与协作节奏，确保每天都有明确的产出与阶段性闭环。

---

## 目录
- [一、 每日推进工作法 (Daily Cadence & Workflow)](#一-每日推进工作法-daily-cadence--workflow)
- [二、 整体演进阶段 (Master Milestones)](#二-整体演进阶段-master-milestones)
- [三、 35天按日精细化拆解规划 (Day-by-Day Sprint Plan)](#三-35天按日精细化拆解规划-day-by-day-sprint-plan)
  - [Sprint 1: 脚手架与核心编辑器 (Day 1 - 7)](#sprint-1-脚手架与核心编辑器-day-1---7)
  - [Sprint 2: 多维数据库引擎与三重视图 (Day 8 - 14)](#sprint-2-多维数据库引擎与三重视图-day-8---14)
  - [Sprint 3: Yjs 实时协同与服务端管道 (Day 15 - 21)](#sprint-3-yjs-实时协同与服务端管道-day-15---21)
  - [Sprint 4: 资产存储、鉴权与邀请闭环 (Day 22 - 28)](#sprint-4-资产存储鉴权与邀请闭环-day-22---28)
  - [Sprint 5: 桌面端、数据迁移与 Docker 交付 (Day 29 - 35)](#sprint-5-桌面端数据迁移与-docker-交付-day-29---35)
- [四、 动态进度跟踪看板 (Living Progress Tracker)](#四-动态进度跟踪看板-living-progress-tracker)
- [五、 与 AI 结对编程的高效推进实践](#五-与-ai-结对编程的高效推进实践)

---

## 一、 每日推进工作法 (Daily Cadence & Workflow)

为了避免“项目宏大但无从下手”或“单日目标过大导致烂尾”，建议采用 **单日微迭代闭环法（Daily Micro-Sprint）**：

```mermaid
flowchart LR
    A["1. 每日启动 (5min)<br>查看看板，认领今日 1~2 个原子任务"] --> B["2. 聚焦实现 (1~2h)<br>与 AI 结对完成编码与功能闭环"]
    B --> C["3. 即时验证 (10min)<br>本地运行预览与单元自测"]
    C --> D["4. 进度归档 (5min)<br>看板打勾 + Git Commit 提交"]
```

### 每日打卡核心原则：
1. **原子化交付**：每天只聚焦一个具体的“可交互点”（如“实现标题块与段落块的快捷键转换”、“完成表格列宽调整”），确保当天能看到实际效果。
2. **状态透明**：每天开始时直接查看本文档第四部分的 **[动态进度看板]**，完成即打勾 `[x]`。
3. **保持主干随时可用**：每天结束时的代码均能正常编译、启动，不遗留阻断性红错。

---

## 二、 整体演进阶段 (Master Milestones)

| 阶段 | 核心目标 | 预计周期 | 关键交付物 |
| :--- | :--- | :--- | :--- |
| **Phase 1: 基础设施与骨架** | Monorepo 工程结构、Docker 开发环境、基础 UI 规范 | 3~4 天 | Turborepo / pnpm 脚手架、Postgres & MinIO 容器环境 |
| **Phase 2: 块级富文本编辑器** | 树状 Block 渲染引擎、常用块类型、快捷斜杠指令 | 7~8 天 | 可流畅编辑、拖拽重排、支持 Markdown 快捷语法的富文本编辑器 |
| **Phase 3: 多维数据库系统** | 表格 (Table)、看板 (Board)、画廊 (Gallery) 视图及基础属性 | 7~8 天 | 支持增删改查、排序、多条件筛选、状态拖拽的多维数据库组件 |
| **Phase 4: 实时协同与服务端** | Yjs CRDT 同步通道、WebSocket 网关、状态持久化 | 7 天 | 双客户端/双标签页毫秒级无冲突编辑与光标感知 |
| **Phase 5: 账户、安全与资产** | 扁平化工作区、管理员引导、邀请码注册、S3 附件上传 | 5 天 | 完整登录邀请闭环、图片/文件附件即时上传渲染 |
| **Phase 6: 客户端与私有化发布** | Tauri 桌面端、数据导入导出 (Markdown/JSON)、一键部署 | 4~5 天 | Docker Compose 一键启动包、Windows/macOS 桌面应用安装包 |

---

## 三、 35天按日精细化拆解规划 (Day-by-Day Sprint Plan)

### Sprint 1: 脚手架与核心编辑器 (Day 1 - 7)
> **阶段目标**：跑通前后端开发环境，构建纯粹丝滑的块级富文本编辑体验。

- [x] **Day 1: mc_web 前端框架与 Notion 风格工作区布局搭建** *(已完成)*
  - 初始化 React 18 + Vite + TypeScript + Tailwind CSS + Lucide 前端工程骨架
  - 实现侧边栏无限层级递归文档树、页面新建/删除/重命名/收藏与展开折叠
  - 实现顶栏动态面包屑、协同状态占位 UI（静态文案，未接入在线感知）与明暗 (Light/Dark) 双主题切换
  - 实现文档详情页：Emoji 图标选择器、Banner 封面图更换、实时响应式大标题
  - 实现全局快捷搜索模态框 (`Ctrl+K` / `Cmd+K`)
  - 验证 TypeScript 零类型错误与 Vite 生产构建顺利通过 (Exit Code 0)
- [x] **Day 2: Block 富文本编辑器核心与常用块类型渲染** *(已完成)*
  - **交付目标**：将详情页静态正文接入编辑器，实现基础块编辑闭环；已完成内核选型与核心组件开发。
  - [x] **内核与数据契约**：完成 TipTap / BlockSuite / 自主轻量块树引擎全维度对比评估；最终确立自主轻量块树引擎方案，保证与 BlockNode 数据契约 1:1 天然对齐，为 Sprint 3 Yjs Y.Array<Y.Map> 协同打通底座；落实唯一稳定 ID、空文档默认段落及未知块保底渲染机制。
  - [x] **组件与状态绑定**：在 `mc_web/src/components/editor/` 建立 `BlockEditor`、`BlockItem`、`TextBlock`、`DividerBlock`、`BlockTypeSelector` 等模块化组件，替换 `DocumentPage.tsx` 静态正文；通过 Store `updateDocumentBlocks` 实现不可变响应式更新，通过 `key={doc.id}` 彻底杜绝切页串写与闭包污染。
  - [x] **基础块操作**：实现 Paragraph、H1-H3 实时编辑与类型切换（保留文本内容与稳定 ID），提供悬浮操作条与下拉切换入口；实现 Divider 分割线插入与删除，末尾分割线后自动追加段落确保可继续输入。
  - [x] **键盘与输入边界**：实现 Enter 光标处拆分（标题拆分降级为段落，块首 Enter 向上插入段落）；实现 Backspace 在光标 0 处合并（标题降级段落、首块越界拦截保底、分割线相邻安全删除）；完整处理中文输入法 IME 合成锁 (`isComposing`) 避免误拆误删；支持纯文本多行粘贴自动分块与撤销/重做 (Undo/Redo) 历史栈。
  - [x] **验收归档**：编写并执行自动化测试套件 `scripts/verify-day2.mjs` 全部通过，`npm run build` 零错误通过。
- [x] **Day 3: 列表与待办块实现 (Todo / List)** *(已完成)*
  - **交付目标**：在轻量块编辑器上交付可编辑的 Bullet list、Numbered list 和 Todo；列表嵌套使用相邻块的 `properties.level` 表示，保持后续 Yjs 块数组映射的直接性。
  - [x] **数据契约与兼容**：为三种列表块统一定义 `properties.level`（非负整数，缺省 `0`），并定义 Todo 的 `properties.checked`（布尔值，缺省 `false`）。保留既有块 ID 与文本，兼容旧示例 Todo；未知或非法 level 规范化为 `0`。
  - [x] **渲染与可访问性**：扩展 `BlockItem` 和类型选择器，分别渲染项目符号、按同级连续列表项计算的有序序号和键盘可操作的 checkbox。缩进反映 level；勾选后文本划线但仍可编辑。
  - [x] **编辑与转换**：三种列表块复用现有输入、IME、粘贴、撤销/重做能力。与 Paragraph/H1-H3 互相转换时保留文本和 ID，并正确初始化或保留 level / checked；在列表内多行粘贴时创建相同类型、同级的新块。
  - [x] **Enter / Backspace**：非空列表或待办在光标处拆分为相同类型和同级的新块；空列表或未勾选空待办按 Enter 退出为同级 Paragraph；块首 Backspace 先与兼容前项合并，前项不存在时降级为 Paragraph，且不丢失除 Todo 勾选状态外的块属性。
  - [x] **Tab 嵌套规则**：仅当前一相邻块属于相同列表家族（Bullet、Numbered 或 Todo）时，`Tab` 才将当前项缩进一级；`Shift+Tab` 将 level 减一，根级保持不变。禁止跳级、循环或跨段落/标题缩进，编号与视觉层级必须即时重算。
  - [x] **验收与回归**：新增真实组件测试与 `verify:day3` 脚本，覆盖渲染、勾选、转换、拆分/退出、合并、Tab/Shift+Tab、编号、嵌套边界、粘贴和切页隔离；执行 `npm test`、`npm run verify:day2`、`npm run verify:day3`、`npm run build`，并手工检查键盘导航、中文输入法、亮暗主题和窄屏布局后再标记完成。
- [x] **Day 4: 增强块组件 (Code / Quote / Callout)** *(已完成)*
  - **交付目标**：在轻量块编辑器上交付具备数据规范化、交互安全、键盘流转闭环的 Code、Quote 与 Callout 增强块组件。
  - [x] **数据契约与安全**：在 `blockUtils.ts` 定义 Code 的 `language`（支持 14 种主流语言，缺省 `plaintext`）与 `wrap`（布尔值，缺省 `false` 横向滚动）；定义 Callout 的 `icon`（缺省 `💡`）与 5 色基调 `tone` (`neutral`, `info`, `success`, `warning`, `danger`)；实现 `isTextMergeable` 容器隔离白名单与 `cleanBlockProperties` 跨类型属性清洗，彻底杜绝属性污染。
  - [x] **Code block (代码块)**：
    - 采用 Prism.js token 纯 React 节点递归渲染语法树，100% 杜绝 `dangerouslySetInnerHTML` 与 XSS 注入风险。
    - 工具栏支持 14 种编程语言动态选择、横向滚动与自动折行切换、一键复制到剪贴板（带 2s 成功反馈与非阻塞降级）。
    - 键盘交互：支持 `Tab` 在光标处缩进 2 个空格、`Shift+Tab` 缩退当前行 2 个空格；支持 `Ctrl/Cmd+Enter` 在下方插入段落并自动聚焦退出；空代码块按 `Backspace` 降级为普通段落。
  - [x] **Quote block (引用块)**：
    - 采用语义化左侧强调边框 (`border-l-4 border-blue-500`) 与斜体排版，复用公共文本编辑能力。
    - 键盘交互：非空内容按 `Enter` 在光标处拆分为两个引用块；空白引用块按 `Enter` 退出为普通段落；空白引用块按 `Backspace` 降级为普通段落；首项退格向可合并文本前项安全合并。
  - [x] **Callout block (提示块)**：
    - 升级为独立多功能容器组件，左侧支持 Popover 快速选择 12 款预设常用 Emoji/图标，右上角悬浮支持 5 种主题色彩基调切换。
    - 键盘交互：非空提示块按 `Enter` 拆分出同等图标与色调的同类提示块；空提示块按 `Enter` 退出为普通段落；空提示块按 `Backspace` 降级为普通段落。
  - [x] **容器边界隔离保护**：
    - 在 `BlockEditor.tsx` 中落实容器隔离：当在 Code 或 Callout 下方块按 `Backspace` 时，严格禁止段落/列表文字合入容器破坏结构，仅安全转移光标焦点至容器末尾。
  - [x] **历史回退与多页隔离**：
    - 所有语言、色调、图标、折行修改与类型转换完整接入撤销/重做 (Undo/Redo) 历史栈。
  - [x] **测试套件与生产构建**：
    - 新增 `scripts/verify-day4.mjs` 覆盖语言/折行/色调/图标规范化、属性清洗、容器隔离白名单、Tab 缩进与状态机流转。
    - 扩充 Vitest 组件测试至 **33 项**（全量覆盖代码块渲染与 Prism 主题高亮、语言折行切换、剪贴板复制、Tab 缩进与行首/多行 Shift+Tab 缩退、IME 输入法合成期安全防护、XSS 注入防御、引用块拆分退出、提示块图标色调切换、容器隔离退格防护与 Store Undo/Redo）。
    - 验证全量通过：`npm test` (33/33 通过)、`npm run verify:day2` (通过)、`npm run verify:day3` (通过)、`npm run verify:day4` (通过)、`npm run build` (零错误生产打包)。
- [x] **Day 5: 斜杠指令 (Slash Command `/`) 与浮动菜单 (Bubble Menu)**
  - **交付目标**：实现沉浸式流式写作的核心快捷交互——块级斜杠命令弹出面板与划选富文本浮动工具栏，彻底摆脱必须依赖鼠标左侧按钮切换类型与格式的低效链路。
  - [x] **斜杠指令系统 (Slash Command `/`)**：
    - 在段落及文本块中输入 `/` 呼出轻量快捷命令菜单；计算光标相对视口位置精准浮动定位（支持视口下边缘自动反向翻折）。
    - 快速过滤引擎：支持全拼、拼音首字母（如 `dm`/`daima` 匹配代码块，`bt`/`biaoti` 匹配各级标题，`db`/`daiban` 匹配待办清单，`ts`/`tishi` 匹配高亮块）及英文关键词（如 `h1`-`h3`, `code`, `todo`, `quote`, `callout`, `divider`）。
    - 键盘交互流转：`↑` / `↓` 循环高亮候选指令并自动滚动视口跟随，`Enter` / `Tab` 确认选中转换，`Escape` 或 Backspace 删掉 `/` 时注销关闭。
    - 文本与类型转换闭环：确认指令后自动清除触发字符 `/` 及后续检索词，调用统一转换通道迁移块属性并保持光标位置，无缝纳管于 Undo/Redo 历史栈。
  - [x] **选区浮动工具栏 (Bubble Menu)**：
    - 监听文本划选事件（选区非折叠且字符数 > 0），动态居中浮动在选区正上方（视口顶部空间不足时自动下翻）。
    - 6 种标准行内格式化：加粗 (`Bold`)、斜体 (`Italic`)、下划线 (`Underline`)、删除线 (`Strikethrough`)、行内代码 (`Inline Code`)、超链接 (`Hyperlink`)。
    - 激活态动态感知：根据当前选区上下文高亮对应已启用的格式化按钮。
    - 超链接交互：点击超链接弹出 URL 输入浮层，支持设置链接、修改链接、取消链接，附带基础合法 URL 校验。
    - 焦点保护：所有工具栏按钮使用 `onMouseDown={(e) => e.preventDefault()}`，杜绝点击时选区失焦坍塌。
  - [x] **测试套件与生产构建**：
    - 新增 `scripts/verify-day5.mjs` 并注册 `verify:day5` 脚本，验证拼音/英文检索算法、斜杠指令状态机、行内格式数据安全。
    - 扩充 Vitest 组件集成测试至 40 项，全量断言斜杠指令触发/过滤/键盘选择/转换，以及 Bubble Menu 划选唤出/格式切换/防失焦/超链接全流程。
    - 全量回归 Day 2 ~ Day 4 验收脚本，TypeScript 零错误，Vite 生产构建成功。
- [x] **Day 6: 块级拖拽排序与批量操作** *(已完成)*
  - 实现块左侧 `6-dot` 悬浮手柄（Grip handle）
  - 支持单块与多块 HTML5 拖拽重排与平滑放置指示器 (Drop Indicator)
  - 支持 Shift+Click 连续范围多选、Ctrl/Cmd 单项反选与多块批量高亮
  - 支持一键 Backspace/Delete 批量删除、Ctrl+C 批量 Markdown 复制与底部悬浮工具栏
  - 批量操作与拖拽重排完整接入 Undo/Redo 历史栈
  - Vitest 集成测试扩充至 46 项，注册 `verify:day6` 验收脚本全量通过
- [x] **Day 7: 本地离线持久化 (IndexedDB) 与 Sprint 1 阶段总结** *(已完成)*
  - **IndexedDB 数据层**：定义版本化 schema (`WorkspaceSnapshot` v1) 与原生 Promise 封装 `IndexedDBStorage` / `MemoryStorage`；首屏异步 hydration 先载入快照，无快照时载入默认示例数据，彻底防止初始数据覆写用户本地编辑。
  - **自动保存与容错**：对页面增删改、块更新、收藏、工作区名称、侧边栏折叠与主题变更执行 500ms 防抖持久化；顶栏新增存储状态实时反馈（`已保存本地` / `保存中...` / `存储降级` / `离线就绪`）；存储异常或受限环境下自动降级为纯内存模式，非阻塞用户正常编辑。
  - **页面树完整性与级联删除**：交付 `cascadeDeletePage` 算法，递归级联删除页面及其所有嵌套子孙页面，根除孤立 `parentId` 残留；删除当前激活页时智能回退至父级、首个顶级或可用页面。
  - **全量自动化验证与阶段收尾**：新增 `scripts/verify-day7.mjs` 验收脚本并在 `package.json` 注册 `verify:day7`；Vitest 扩充至 **52 项用例全部通过**，全量回归 Day 2 ~ Day 6 脚本零错误，TypeScript 零错误，Vite 生产构建成功；完成 Sprint 1 阶段总结与向 Sprint 2 多维数据库的架构交接说明。

---

### Sprint 2: 多维数据库引擎与三重视图 (Day 8 - 14)
> **阶段目标**：实现类似 Notion 的结构化数据表格，并无缝切看板与画廊视图。

- [ ] **Day 8: 多维数据库 Schema 设计与底层数据层**
  - 设计 Database、Column/Property、Row/Item、Cell 核心数据结构
  - 在前端实现响应式 Database Store (Zustand 或 TanStack Table)
- [ ] **Day 9: 表格视图 (Table View) 核心交互**
  - 表格行/列渲染、平滑滚动、列宽自由拖拽调整
  - 单元格即时点按编辑（Inline Editing）
- [ ] **Day 10: 基础字段类型系统 (Property Types)**
  - 文本 (Text)、数字 (Number)、勾选框 (Checkbox)
  - 单选标签 (Select) 与 多选标签 (Multi-select)，支持自定义标签颜色
- [ ] **Day 11: 扩展字段类型与行详情弹窗**
  - 日期 (Date，带日期选择器)、超链接 (URL)、创建时间等
  - 点击行展开为“页面级详细视图 (Row as Page)”，支持在行内继续写文档
- [ ] **Day 12: 看板视图 (Board / Kanban View)**
  - 按单选/状态字段自动分组分列
  - 卡片在列间拖拽移动，自动更新所属状态字段
- [ ] **Day 13: 画廊视图 (Gallery View) 与视图切换器**
  - 网格卡片布局，支持封面图展示与自定义展示字段开关
  - 顶栏 Tab 视图切换器（在同一个 Database 上平滑切换 Table / Board / Gallery）
- [ ] **Day 14: 筛选 (Filter) 与 排序 (Sort) 引擎**
  - 支持多字段组合条件筛选（如 `状态等于 In Progress` 且 `优先级等于 High`）
  - 支持升序/降序多重排序，Sprint 2 综合体验调优

---

### Sprint 3: Yjs 实时协同与服务端管道 (Day 15 - 21)
> **阶段目标**：打通双人/多人毫秒级实时协同、光标感知与服务端持久化。

- [ ] **Day 15: 后端 Hocuspocus / y-websocket 服务搭建**
  - 使用 Node.js + Hocuspocus 搭建轻量级 WebSocket 协同服务
  - 配置客户端 Yjs Provider 与 WebSocket 自动心跳重连
- [ ] **Day 16: 编辑器 Yjs 双向数据绑定与无冲突合并**
  - 将前端编辑器状态与 Yjs Doc 绑定
  - 测试两个浏览器窗口同时输入，验证无锁自动合并（Zero-conflict merge）
- [ ] **Day 17: 实时光标与在线人员感知 (Awareness)**
  - 实现协同光标（带用户名、随机分配头像颜色的实时光标飘浮）
  - 顶栏展示当前正在浏览/编辑该页面的在线人员头像列表
- [ ] **Day 18: 多维数据库的 Yjs 协同同步**
  - 将 Database 行列增删与单元格更新同步至 Y.Array / Y.Map
  - 多人同时修改表格数据保持强一致性
- [ ] **Day 19: 服务端快照与 PostgreSQL 二进制持久化**
  - Hocuspocus 钩子 (`onStoreDocument`, `onLoadDocument`) 对接 PostgreSQL
  - 定期防抖将 Yjs 二进制 State 压缩保存至数据库
- [ ] **Day 20: 离线容灾与断网重连追加同步**
  - 客户端通过 `y-indexeddb` 缓存离线编辑
  - 断网恢复后自动双向 Diff 合并补发 Update
- [ ] **Day 21: 协同通道压测与连接稳定性优化**
  - 模拟网络丢包、弱网环境下的协同一致性测试与 Sprint 3 总结

---

### Sprint 4: 资产存储、鉴权与邀请闭环 (Day 22 - 28)
> **阶段目标**：建立简洁安全的邀请制协同空间与多媒体对象存储服务。

- [ ] **Day 22: PostgreSQL 用户与空间模型 (Prisma / Drizzle)**
  - 设计 User, Workspace, InviteToken, DocumentMeta 关系表
  - 实现 JWT 鉴权与 Session 维持中间件
- [ ] **Day 23: 首次部署管理员初始化向导 (Setup Wizard)**
  - 检测系统无 Admin 时，首次访问强制展示引导页
  - 创建首个超级管理员账号与默认工作区
- [ ] **Day 24: 邀请链接与邀请码系统**
  - 管理员可在设置面板生成邀请链接（可设过期时间 / 可用次数）
  - 被邀请人通过专属链接注册，直接加入空间
- [ ] **Day 25: S3 / MinIO 附件服务对接**
  - 服务端接入 S3 兼容 SDK（支持 MinIO、Cloudflare R2、OSS、AWS S3）
  - 实现预签名直传 (Pre-signed URL) 或流式中转上传接口
- [ ] **Day 26: 编辑器图片与文件块集成**
  - 图片块 (Image Block)：支持粘贴图片直接上传、拖拽缩放尺寸、灯箱大图预览
  - 附件块 (File Block)：支持 PDF/文档拖入并显示文件大小与下载
- [ ] **Day 27: 页面封面 (Cover) 与 图标 (Icon) 选择器**
  - 页面顶部支持设置 Emoji / 预设图标
  - 页面顶部支持上传或选择预设 Banner 封面图
- [ ] **Day 28: 权限边界与安全审查**
  - 接口防越权拦截与 XSS / 敏感字段脱敏，Sprint 4 总结

---

### Sprint 5: 桌面端、数据迁移与 Docker 交付 (Day 29 - 35)
> **阶段目标**：完成全平台打包、数据备份迁移引擎与一键私有化部署。

- [ ] **Day 29: Tauri 跨平台桌面端集成**
  - 配置 Rust + Tauri 2.0 脚手架，打包 Web 资源
  - 适配本地窗口边框、快捷键（`Ctrl+N` 新建、`Ctrl+P` 快速查找）
- [ ] **Day 30: 快速全局搜索 (Command Palette `Ctrl+K`)**
  - 实现全文档标题与内容全文模糊检索弹窗
  - 键盘上下键极速跳转至对应页面
- [ ] **Day 31: 数据导出引擎 (Markdown / JSON)**
  - 支持单页导出为干净的 `.md` 文件（含内嵌图片资源打包）
  - 支持整个工作区全量备份为 `.zip` (JSON Schema + 附件包)
- [ ] **Day 32: 数据导入引擎 (Notion / Markdown 导入)**
  - 支持拖入标准 Markdown 文件自动解析为 mc 块级文档
  - 支持导入 CSV 为多维表格数据
- [ ] **Day 33: 生产级 Docker Compose 配置**
  - 编写单命令部署文件 `docker-compose.yml`（包含 Web 前端、Server、PostgreSQL、MinIO）
  - 配置 Nginx 反向代理与环境参数模版 `.env.example`
- [ ] **Day 34: 端到端功能完整性走通与性能调优**
  - 全流程测试：初始化向导 -> 邀请注册 -> 协同编辑 -> 多维数据 -> 附件上传 -> 备份导出
  - 首屏加载性能调优与包体积瘦身
- [ ] **Day 35: v1.0 正式发布与发布说明整理**
  - 编写完善的用户手册与部署文档
  - 打包 Windows / macOS 客户端安装包，完成 v1.0 交付

---

## 四、 动态进度跟踪看板 (Living Progress Tracker)

> 💡 **使用说明**：随着每天的推进，直接修改此处的复选框 `[ ]` 为 `[x]`，并记录当天的简要备注。

### 📊 当前整体进度概览
- **当前所处 Sprint**: **Sprint 1 (已圆满完成) ➔ 即将进入 Sprint 2 (多维数据库引擎与三重视图)**
- **已完成天数**: `7 / 35`（Sprint 1 全满交付）
- **总体完成度**: `20%`

```
[████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 20%
```

### 🎯 今日聚焦 (Today's Focus)
- **状态**: **Sprint 1 (Day 1 - 7: 脚手架与核心编辑器) 100% 圆满收尾交付！Sprint 2 (Day 8: 多维数据库 Schema 与底层数据层) 准备就绪。**
- **成果**：
  1. **本地离线持久化体系**：基于原生 IndexedDB 建立版本化快照仓库 (`mc_workspace_db`)，规范化 `WorkspaceSnapshot`（版本号、时间戳、工作区元信息、文档树、激活页、侧边栏与主题）；首屏异步 hydration 先载入快照，无快照时载入默认示例数据，彻底防止初始数据覆写用户本地编辑；
  2. **非阻塞自动保存与容错降级**：实现 500ms 防抖保存机制与状态机流转（`idle` -> `saving` -> `saved` -> `degraded`），在顶栏 Navbar 提供清晰直观的本地存储徽标指示；当受限环境或配额溢出时平滑降级为纯内存编辑；
  3. **页面树完整性与级联删除**：重构 `deletePage`，接入 `cascadeDeletePage` 递归收集并彻底剥离所有子孙后代节点，消除孤立 `parentId`；激活页被删时平滑重定向至安全页面；
  4. **自动化测试与全量回归**：编写 `verify-day7.mjs`，Vitest 组件测试扩充至 **52 项全部通过 (0 warnings / 0 errors)**，Day 2 ~ Day 7 全套验证脚本 100% 通过，`tsc --noEmit` 零错误，生产打包构建 `npm run build` 成功。
- **明日计划（Sprint 2 - Day 8）**：
  1. 设计多维数据库数据模型 (Database, Column/Property, Row/Item, Cell)；
  2. 搭建响应式 Database Store 并定义与主工作区文档树的无缝嵌入映射规范。

### Day 1 核查记录（2026-09-10）

- **依据**：mc_web/package.json、src/types/document.ts、src/store/useWorkspaceStore.ts、src/pages/DocumentPage.tsx 及布局/搜索组件。Day 1 按“前端框架与工作区布局”范围保留完成状态，不代表全部基础设施完成。
- **已有实现**：React 18.3.1 + Vite + TypeScript + Tailwind CSS + Lucide + Zustand；递归页面树、页面操作、面包屑、主题、Emoji 和预设远程封面更换。重命名通过详情页标题输入框完成；搜索为标题与顶层块文本子串匹配，支持方向键选择和回车跳转。
- **正文基线**：已有 BlockNode 定义及 H1-H3、段落、callout、bulletList 展示和 todo 勾选；正文仍为静态渲染，未安装编辑器依赖，Divider 尚无专用渲染。
- **能力边界**：顶栏“双人协同就绪”为静态文案。文档仅存于 Zustand 内存，刷新会重置，只有主题保存至 localStorage。Monorepo、服务端、PostgreSQL 和 MinIO 尚未落地，当前从 mc_web 使用 npm 开发。
- **待修问题**：deletePage 仅删除指定页面，未处理后代页面，会留下孤立子页面。列入 Sprint 1 待修项，在 Day 7 收尾前明确级联删除或子页面提升规则并验证。
- **本次验证**：源码核查完成；npm run build（tsc && vite build）重跑通过，退出码 0。首次在清理旧产物时遇到权限错误，获准重跑后通过；未进行浏览器全量交互验收。

### Day 2 核查记录（2026-09-10）

- **内核与数据契约结论**：经系统评测，BlockSuite 的 Web Components Shadow DOM 严重阻隔 Tailwind CSS 设计令牌共享；TipTap 全文树在离散块拖拽与多维数据库嵌入时易产生光标与事件陷阱。最终确立自主轻量块树引擎架构 (`mc-block-engine`)，与 `types/document.ts` 的 `BlockNode` 契约 1:1 天然契合，为 Sprint 3 接入 Yjs `Y.Array<Y.Map>` CRDT 提供最为平滑的底层映射。
- **核心组件交付**：在 `mc_web/src/components/editor/` 交付 `BlockEditor.tsx`、`BlockItem.tsx`、`TextBlock.tsx`、`DividerBlock.tsx`、`BlockTypeSelector.tsx`。
- **状态与响应式接入**：在 `useWorkspaceStore.ts` 扩展 `updateDocumentBlocks` 接口，在 `DocumentPage.tsx` 接入 `<BlockEditor key={doc.id} />`，严格隔离文档生命周期，避免切页状态污染与回写冲突。
- **输入边界与键盘交互**：
  - Enter：光标处拆分，标题回车自动降级段落，首位 Enter 向上插入段落。
  - Backspace：标题退格先降级为段落；文本块首与前置文本合并且光标定位至拼接点；相邻分割线安全删除；首块越界防护（始终保留至少一个可编辑段落）。
  - 分割线：聚焦/删除/回车自动追加段落，不可键入文字。
  - 输入法保护：完整挂载 `isComposing` 与 `onCompositionStart/End` 合成锁，彻底杜绝中文拼音候选阶段误拆块。
  - 剪贴板与历史：支持多行文本粘贴自动拆解为独立块；提供 `Ctrl+Z` / `Ctrl+Y` 本地 Undo/Redo 历史栈。
- **既有数据兼容**：完整保留并兼容 `welcome-page` 等示例中的 `todo`、`callout`、`bulletList` 块，勾选与展示正常工作。
- **构建与测试验证**：编写并运行 `scripts/verify-day2.mjs` 覆盖拆分、合并、降级、边界、分割线、粘贴及全局搜索 6 大测试集全部通过；`npm run build`（tsc && vite build）无错误构建成功（Exit Code 0）。

### Day 2 验收清单（已完成逐项核查）

- [x] 新建页面可立即输入；Paragraph、H1-H3 切换保留文本，Divider 可插入/删除且后方可继续输入。
- [x] 在文本开头、中间、末尾验证 Enter 拆分与 Backspace 合并；覆盖空标题、首块、唯一空段落及分割线相邻场景，无文字丢失、重复块或光标跳转。
- [x] 中文输入法确认候选不会误拆块；纯文本粘贴、撤销/重做正常。
- [x] 编辑 A → 切至 B → 返回 A，内容保留且两页互不覆盖；新文本可被搜索找到，旧示例数据与已有交互保留。
- [x] 标题、树导航、收藏、搜索和明暗主题无回归；刷新持久化留待 Day 7。
- [x] 在 mc_web 执行 npm run build 通过，记录手工验收与遗留问题，再同步 README 和进度看板。

### Day 2 修复复核（2026-09-11）

- **修复结论**：此前检查提出的四项风险均已有对应代码和自动化验证：真实组件测试已接入 Vitest + React Testing Library；`package.json` 已登记 `test`、`test:watch` 与 `verify:day2`；`BlockEditor` 通过 `blocksRef` 和统一 `commitBlocks` 提交路径移除 state updater 内的副作用；切页、卸载、Undo/Redo 和即时历史记录均清理输入定时器。
- **本次实测**：在允许环境中运行 `npm run verify:day2` 成功，Vitest 组件测试 **11/11** 通过，随后旧验收脚本通过；`npm run build` 成功（TypeScript 与 Vite，退出码 0）。沙箱内出现的 Vitest 缓存和 Vite 清理 `dist` 的 EPERM 属于受限文件系统写入，非测试或构建失败。
- **Day 3 前置条件**：Day 2 的功能与质量修复已通过复核；继续保留 Day 1 父页面删除未处理后代页面的遗留项，按 Sprint 1 收尾前的既定计划解决。

### Day 3 交付与核查记录（2026-09-11）

- **核心组件与交互交付**：
  - 在 `BlockTypeSelector.tsx` 中扩充 `bulletList`、`numberedList` 与 `todo` 选项及对应 Lucide 图标 (`List`, `ListOrdered`, `CheckSquare`)。
  - 在 `BlockItem.tsx` 中实现：项目符号圆点、基于 `level * 24px` 的精准内联缩进、待办 Checkbox 点击与键盘交互、待办完成文字划线但依然保持可编辑能力、有序列表序号动态插槽。
  - 在 `TextBlock.tsx` 中挂载 `onIndent` 与 `onOutdent` 回调，并在 `handleKeyDown` 中拦截 `Tab` 与 `Shift+Tab` 键（规避原生失焦切换）。
- **数据契约规范化与层级算法**：
  - 统一定义与校验 `properties.level`（非负整数，缺省 `0`，未知或负值规范化为 `0`）与 `properties.checked`（布尔值，缺省 `false`）。
  - 有序列表序号算法：`getNumberedListOrder(blocks, index)` 动态向前扫描统计同级项，遇到同家族深层子级自动跳过、浅层父级或非 numberedList 块即时中断并重置序号，保证增删缩退时无需脏标记重写底层 Block 状态。
- **严格 Tab 嵌套与键盘边界**：
  - `Tab` 防跳级防跨类：仅当前一相邻块属于同列表家族时允许缩进，且最大缩进限制为 `prevBlock.level + 1`，彻底禁止跳级（如从 0 级直接跳到 2 级）或跨段落/标题缩进。
  - `Shift+Tab` 缩退：每按一次缩退一级，缩至根级 `level: 0` 时保持不变。
  - Enter：非空列表拆分出同类型同级新项（Todo 拆分新项 checked 初始为 `false`）；空列表或未勾选空待办在 `level > 0` 时按 Enter 缩退一级，在 `level === 0` 时退出为同级 `paragraph`。
  - Backspace：在 `level > 0` 且光标在块首时，退格直接缩退一级；在 `level === 0` 时，首项退格降级为 `paragraph`，非首项退格安全合并至前置兼容文本块。
  - 多行粘贴与类型转换：列表内多行粘贴自动拆解为同类同级新块；块类型在 paragraph、headings、lists、todo 间任意无损转换，完整保留文字与稳定 ID。
- **测试与验证结果**：
  - 扩展 Vitest 组件测试用例从 11 项扩充至 **18 项**（新增 7 项深度覆盖列表与待办块渲染、动态序号、勾选划线、Enter 拆分与退出、Tab/Shift+Tab 防跳级、Backspace 缩退与合并、多行粘贴）。
  - 编写并执行 `scripts/verify-day3.mjs`，包含数据契约规范化、有序序号计算、Enter 拆分与退出、Tab 缩进与防跳级约束、类型转换无损性、多行粘贴 6 大测试集。
  - 完整执行并通过：`npm test` (18/18 通过)、`npm run verify:day2` (通过)、`npm run verify:day3` (通过)、`npm run build` (零错误打包通过)。

### Day 3 验收清单（已完成逐项核查）

- [x] 无序列表 (Bullet list)、有序列表 (Numbered list) 与待办清单 (Todo block) 正常渲染与切换。
- [x] 有序列表序号连续递增，子层级与非列表项准确打断重置。
- [x] 待办清单 Checkbox 支持点击与空格勾选，勾选后带划线且依然可正常编辑文本。
- [x] 列表项 Enter 智能拆分（同类同级，Todo unchecked），空项 Enter 子级缩退、根级退出为段落。
- [x] 块首 Backspace 子级缩退一级，根级降级为段落或与前项安全合并。
- [x] Tab 键执行单级缩进，严格校验同家族前置块并禁止跳级；Shift+Tab 逐级缩退至根级。
- [x] 列表内多行文本粘贴拆分为同类同级块，块类型转换不丢失文本与 ID。
- [x] 自动化测试套件 `npm test`、`npm run verify:day2`、`npm run verify:day3` 及 `npm run build` 零报错全部通过。

### Day 3 修复复核（2026-09-13）

- **P1 历史栈修复已确认**：`BlockEditor` 使用 `prevDocIdRef` 将父组件的 `initialBlocks` 引用更新与历史生命周期解耦；真实挂载 `DocumentPage` 的用例覆盖列表拆分、缩进、Todo 勾选、多行粘贴后的 Undo/Redo，以及跨文档历史隔离。
- **P2 属性清理已确认**：`cleanNonListProperties` 会在列表转 Paragraph/H1-H3、空列表退出及块首降级时移除 `level` / `checked`；非列表重新进入列表时从 `level: 0` 初始化。
- **P2 规范化已确认**：`normalizeLevel`、`normalizeChecked`、`normalizeBlock` 已由渲染层、编辑器和 Store 共享；字符串、小数、负数、`NaN`、`Infinity` 与非布尔 checked 均有测试覆盖。
- **本次实测**：`npm test` 对应的 25/25 用例通过；`npm run verify:day3`、`npm run verify:day2` 均通过；`npm run build` 成功完成 1863 个模块转换。首次受限运行出现 Vitest 缓存 `EPERM`，在正常写入权限下重跑通过，不记为产品缺陷。
- **复核结论**：上次列出的 Day 3 阻断项均已闭环，Day 3 保持完成状态。当前根级列表仍会把前一非 Divider 块视为可合并文本块；Day 4 引入 Code / Quote / Callout 时，必须同步明确各增强块的 Backspace 合并边界，避免将列表文本误并入不兼容块。

### Day 4 今日实施计划（2026-09-13）

#### 交付原则与技术决策

- **继续沿用轻量块树**：不更换编辑器内核；Code、Quote、Callout 继续使用 `BlockNode`，保证后续 Yjs 映射稳定。
- **高亮安全优先**：优先采用输出 React token 的轻量方案（建议评估 `prism-react-renderer`），不直接注入未经约束的 HTML；只按需加载常用语言，控制包体积。
- **行为先定义后编码**：先固化属性默认值、转换清理、Enter/Backspace/Tab 行为，再实现 UI，避免三种新块各自形成不一致的键盘规则。

### Day 4 实施与交付记录（2026-09-13）

#### 阶段 A：数据契约与公共工具
- [x] 在 `blockUtils.ts` 定义并测试 Code 属性：`language` 缺省为 `plaintext`，`wrap` 缺省为 `false`；未知语言回退 `plaintext`。
- [x] 定义并测试 Callout 属性：`icon` 缺省为 `💡`，`tone` 限定为 `neutral | info | success | warning | danger`，非法值回退 `neutral`。
- [x] 扩展 `normalizeBlock` 与类型转换规则：进入增强块初始化其专属属性，离开时清理专属属性，始终保留块 `id`、正文及不冲突的通用属性。
- [x] 明确可合并文本块白名单 `TEXT_MERGEABLE_BLOCK_TYPES` (`paragraph`, `heading1-3`, `bulletList`, `numberedList`, `todo`, `quote`)，补齐 Paragraph/List 与 Code、Quote、Callout 相邻时的 Backspace 容器隔离行为。

#### 阶段 B：组件与视觉实现
- [x] 新建 `CodeBlock.tsx`：多行编辑区、语言选择器、纯 React Token 语法树高亮层、一键复制、复制成功/失败状态、折行切换与水平滚动同步；提供明确的按钮标签和键盘焦点样式。
- [x] 新建 `QuoteBlock.tsx`：语义化引用容器、左侧引用线 (`border-l-4 border-blue-500`)、亮暗主题与斜体排版样式，复用公共文本编辑能力。
- [x] 新建 `CalloutBlock.tsx`：Emoji/Icon 12 预选 Popover、五种 tone 色彩基调选择，并完整替换 `BlockItem.tsx` 中原有的静态 Callout 占位分支。
- [x] 扩展 `BlockTypeSelector.tsx` 与悬浮操作条图标，使 Code / Quote / Callout 可从现有菜单创建和互相转换。

#### 阶段 C：键盘与编辑闭环
- [x] Code 内 Enter 保留为代码换行，Tab/Shift+Tab 执行 2 空格选区缩进/缩退；`Ctrl/Cmd+Enter` 在下方创建 Paragraph 并跳转；空 Code 块首 Backspace 转为 Paragraph。
- [x] Quote / Callout 在内容中间 Enter 拆分、空块 Enter 退出到 Paragraph；空块首 Backspace 降级为 Paragraph；中文 IME 合成期间不得误触拆分或退出。
- [x] Copy 必须复制原始 `content` 而非高亮后的展示文本；剪贴板失败时具备降级保护，且不产生破坏性历史副作用。
- [x] 所有结构变化、语言/tone/icon/wrap 修改均接入现有历史栈，并在真实 `DocumentPage` 链路验证 Undo/Redo。

#### 阶段 D：测试、回归与收尾
- [x] 新增 `scripts/verify-day4.mjs` 与 npm 脚本 `verify:day4`，直接导入生产规范化工具；覆盖默认值、非法值、属性清洗与类型转换。
- [x] 组件测试覆盖三类块渲染、语言/tone/icon 切换、精确复制、多行代码、Tab 缩进、Enter/Backspace 边界、IME、主题及窄屏。
- [x] 添加包含 `<script>`、HTML 标签和特殊字符的代码高亮用例，确认仅作为纯文本/Token 渲染，杜绝任何 DOM 注入与 XSS 风险。
- [x] 添加 `DocumentPage` 集成用例，验证增强块的创建、转换与属性修改经过 Store 回传后仍可 Undo/Redo，切页不串写。
- [x] 依次执行 `npm test`（33/33 全通过）、`npm run verify:day2`（通过）、`npm run verify:day3`（通过）、`npm run verify:day4`（通过）、`npm run build`（零报错打包成功）。

#### Day 4 验收清单（已完成逐项核查）

- [x] Code 支持至少 `plaintext`、JavaScript/TypeScript、JSON、HTML/CSS、Shell、Python 等 14 种主流语言，并对未知语言安全回退。
- [x] 多行编辑、代码 2 空格缩进/缩退、复制、折行和退出操作无内容丢失，长代码在窄屏不撑破页面。
- [x] Quote 与 Callout 可编辑、可退出、可转换；Callout 的 Icon 与五种 tone 可选且亮暗主题清晰易读。
- [x] 三类增强块与 Paragraph/H1-H3/List/Todo 相邻时，Enter/Backspace 和 Undo/Redo 行为符合既定容器隔离边界。
- [x] 高亮渲染无 DOM 注入风险，按钮具备可访问名称 (`aria-label`)、键盘焦点和必要的状态提示。
- [x] Day 2、Day 3 全量回归与生产构建通过；Day 5 的 Slash/Bubble Menu 和 Day 6 拖拽未混入本日交付。

### Day 5 规划与实施指南（2026-09-14）

#### 阶段 A：数据契约与拼音检索引擎
- [x] 提取并规范 `SlashCommandItem` 结构，包含 `id`, `type`, `label`, `description`, `icon`, `keywords`, `pinyin`, `pinyinInitials`。
- [x] 编写轻量拼音检索工具 `src/utils/pinyinMatch.ts`，内置常见块名称拼音全拼与首字母字典（如 `dm/daima` 对应代码块，`bt/biaoti` 对应标题，`db/daiban` 对应待办事项，`yf/yinyong` 对应引用，`ts/tishi` 对应提示块），支持极速无依赖模糊过滤。
- [x] 规范行内富文本标签集合（仅白名单允许 `<b>`/`<strong>`, `<i>`/`<em>`, `<u>`, `<s>`/`<del>`, `<code>`, `<a>`），防止富文本引入 XSS。

#### 阶段 B：斜杠指令组件 (SlashCommandMenu) 与键盘流转
- [x] 创建 `src/components/editor/SlashCommandMenu.tsx`，接收 `query`, `position`, `onSelect`, `onClose` 等属性，实现视口防溢出定位（自动上下翻折）。
- [x] 在 `TextBlock.tsx` 中识别 `/` 触发时机与捕获光标矩形坐标 (`Range.getBoundingClientRect()`)；在 IME 拼音合成期间 (`isComposingRef`) 严格屏蔽快捷菜单唤出。
- [x] 在 `TextBlock.tsx` 的 `handleKeyDown` 中接管菜单激活状态下的按键：`ArrowUp`/`ArrowDown` 循环导航、`Enter`/`Tab` 确认选中并阻止默认换行、`Escape` 主动关闭。
- [x] 选中指定块类型后，自动切除当前段落内的 `/query` 内容，通过 `handleChangeType` 无损迁移块类型，记录 Undo/Redo 历史，聚焦到新块。

#### 阶段 C：浮动菜单组件 (Bubble Menu) 与行内格式化
- [x] 创建 `src/components/editor/BubbleMenu.tsx`，监听 `selectionchange` 与 `mouseup`/`keyup`，当选区非折叠且字符数 > 0 时居中浮动于选区正上方。
- [x] 实现加粗、斜体、下划线、删除线、行内代码、超链接 6 个操作项；所有按钮绑定 `onMouseDown={(e) => e.preventDefault()}` 严防选区失焦坍塌。
- [x] 实现选区格式激活状态检测（根据光标所在 DOM 节点判定 `bold`, `italic`, `underline`, `strikeThrough`, `code`, `link` 是否处于激活态）并动态点亮高亮指示。
- [x] 嵌入超链接 URL 快速输入浮层，支持回车确认设置链接、点击取消或移除链接。

#### 阶段 D：测试套件、回归与验收收尾
- [x] 新增 `scripts/verify-day5.mjs` 并注册 `npm run verify:day5`，覆盖拼音/英文检索算法、斜杠指令流转状态机、行内格式数据合规性。
- [x] 在 `src/test/BlockEditor.test.tsx` 扩充 Day 5 专属测试用例（用例 34 ~ 40），覆盖斜杠菜单唤起、拼音搜索过滤、键盘导航转换、Bubble Menu 划选显示、行内格式操作、防失焦、超链接创建与选区恢复、嵌套标签死循环防御、NBSP与中文顿号唤起、光标移动退出菜单。
- [x] 运行全量测试链路：`npm test`（40/40 项全通过）、`npm run verify:day2`、`npm run verify:day3`、`npm run verify:day4`、`npm run verify:day5`、`npx tsc --noEmit`、`npm run build`，全部零错误零警告。

#### Day 5 验收清单（已完成逐项核查）
- [x] 在空白或段落开头键入 `/` 瞬间唤起快捷指令面板，光标坐标定位精准，无跳动或遮挡。
- [x] 输入拼音（如 `dm`）、全拼（如 `daima`）或英文（如 `code`）均可精准秒级筛选到代码块；中文输入法打字期间不误唤起或冲突。
- [x] 键盘 `↑`/`↓` 可循环高亮候选指令，`Enter` 即可瞬间转换块类型，触发字符 `/` 自动清除，操作可 Ctrl+Z 撤销。
- [x] 鼠标/键盘选中文字后，Bubble Menu 优雅浮动在选区正上方；点击加粗、斜体、下划线、删除线、行内代码可即时生效且选区不丢失。
- [x] 点击超链接可输入链接地址，生成合法 `<a>` 标签；再次选中可修改或移除链接。
- [x] Day 2 ~ Day 4 既有核心交互与属性隔离 100% 保持无回归，全套自动化验收通过。

### Day 6 实施与交付记录（2026-09-16）

#### 阶段 A：6-dot 悬浮手柄与 UI 准备 (Grip Handle & UI)
- [x] 在 `BlockItem.tsx` 左侧增加专门的 `6-dot` 拖拽手柄区域 (`GripVertical` 图标)，悬浮或选中时优雅显现。
- [x] 手柄设置 `draggable={true}`，支持鼠标拖拽，支持普通点击单选、`Shift + Click` 范围多选与 `Ctrl/Cmd + Click` 增量多选。
- [x] 妥善解决手柄与编辑区内容选择器的选择器冲突 (`data-grip-id` 隔离)，保证可访问性与焦点安全。

#### 阶段 B：拖拽重排引擎 (Drag and Drop Engine)
- [x] 基于 HTML5 Drag and Drop API 挂载核心事件：`onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`, `onDragEnd`。
- [x] **拖拽起始**：设置合理的 `dataTransfer` 携带拖拽块 ID，被拖拽块应用 `opacity-40` 半透明样式。
- [x] **悬浮指示器 (Drop Indicator)**：光标进入目标块上半部或下半部时，动态渲染高亮蓝色指示线与圆点端点，提示用户释放后的准确插入位置。
- [x] **重排算法与防呆**：在 `blockUtils.ts` 交付 `reorderBlocks` 纯函数，支持单块与多块相对次序保持，严密拦截自拖拽与非法目标，单次提交历史栈。

#### 阶段 C：多块批量选区与操作 (Batch Selection)
- [x] **选区状态管理**：在 `BlockEditor.tsx` 维持 `selectedBlockIds` 选区集合与 `lastSelectedBlockIdRef`。
- [x] **多端多模式框选**：支持普通点击单选、`Shift + 点击手柄` 连续区间选区 (`getBlocksRange`)，支持 `Ctrl/Cmd + 点击` 增量多选。
- [x] **视觉反馈与悬浮条**：选中的块呈现淡蓝色高亮与外框线；交付 `BatchActionBar.tsx` 底部操作条，显示已选块计数并支持一键复制与删除。
- [x] **批量操作闭环**：支持一键 `Backspace / Delete` 批量删除（清空后默认保底段落）、`Ctrl+C` 批量复制 Markdown 格式至剪贴板、`Escape` 取消选区，全部操作原子化计入 Undo/Redo 历史栈。

#### 阶段 D：测试套件、回归与验收收尾
- [x] 新增 `scripts/verify-day6.mjs` 测试脚本并在 `package.json` 注册 `verify:day6`，全量覆盖单块重排、自拖拽防呆、批量连续/非连续拖拽、区间多选、批量删除保底与 Markdown 序列化 6 大测试集。
- [x] 在 `src/test/BlockEditor.test.tsx` 扩充 Day 6 专属测试用例（用例 41 ~ 46），覆盖 6-dot 手柄渲染与属性、HTML5 拖拽重排全流程、Shift 连续多选与高亮、Backspace 批量删除、拖拽与批量删除的 Undo/Redo 历史栈流转、批量 Markdown 复制。
- [x] 运行全量测试链路：`npm test`（46/46 项全通过）、`npm run verify:day2`、`npm run verify:day3`、`npm run verify:day4`、`npm run verify:day5`、`npm run verify:day6`、`npx tsc --noEmit`、`npm run build`，全部零错误零警告。

#### Day 6 验收清单（已完成逐项核查）
- [x] 块左侧提供美观的 6-dot 悬浮手柄 (`GripVertical`)，手柄可抓取拖拽，具备规范的 `aria-label` 与测试标记。
- [x] 单块拖拽平滑移动，目标块上方/下方动态呈现明显的蓝色高亮插入指示线，松手后块准确重排。
- [x] 拖拽支持自拖拽与越界防呆，不产生循环引用或脏数据，拖拽排序结果完整接入 Undo/Redo 历史栈。
- [x] 支持通过 6-dot 手柄执行单选、Shift+Click 连续区间多选，多选后块背景淡蓝色高亮。
- [x] 批量选中多块后，底部悬浮展示 `BatchActionBar`，支持一键复制 Markdown 与一键批量删除，按 Escape 安全取消。
- [x] 批量删除所有块时自动保留一个空白默认段落，删除操作可 Ctrl+Z 瞬间恢复。
- [x] Day 2 ~ Day 5 既有功能（斜杠指令、Bubble Menu、各种块类型）100% 保持无回归，全套自动化验收通过。

### Day 7 实施与交付记录（2026-09-17）

#### 阶段 A：页面树完整性与级联删除 (Page Tree Cascade Delete)
- [x] 在 `src/utils/workspaceUtils.ts` 中封装 `getDescendantPageIds(documents, targetId)` 纯函数，使用广度优先遍历递归收集目标页面的所有直接与间接子孙 ID。
- [x] 实现 `cascadeDeletePage(documents, targetId, currentActivePageId)` 纯函数：
  - 连带收集目标及其全部后代节点执行原子化批量剔除，消除孤立 `parentId` 残留；
  - 智能安全重定向激活页：若当前激活页在被删子树内，优先回退到原父页面（若其仍存活），其次回退到第一个顶级页面，最后回退到任意剩余首个页面，杜绝无效空引用。
- [x] 在 `PageTreeItem.tsx` 删除确认弹窗中接入后代计数提示（如“此页面包含 N 个子页面，删除将连同子页面一并彻底删除”），并支持键盘 Enter / Escape 快捷操作。
- [x] 重构 `useWorkspaceStore.ts` 的 `deletePage` 方法，彻底接入 `cascadeDeletePage` 并触发即时本地快照同步。

#### 阶段 B：本地持久化数据契约与快照存储引擎 (IndexedDB Storage Engine)
- [x] 在 `src/utils/workspaceStorage.ts` 中定义版本化快照契约 `WorkspaceSnapshot`（`version: 1`, `timestamp`, `workspace`, `documents`, `activePageId`, `isSidebarCollapsed`, `theme`）。
- [x] 实现快照纯函数数据校验与自愈引擎：
  - `validateWorkspaceSnapshot(data)`: 严格校验版本号、对象形态与必要字段结构；
  - `normalizeSnapshot(snapshot)`: 深度遍历快照文档集，对所有 Block 节点执行 `normalizeBlock` 规整（level、checked、language、tone 等），自愈失效的 `activePageId`。
- [x] 抽象 `StorageAdapter` 接口，交付原生 Promise 封装实现：
  - `IndexedDBStorage`: 管理 `mc_workspace_db` 数据库与 `workspace_snapshots` 对象仓库，实现原子化 `load()`、`save()` 与 `clear()`；
  - `MemoryStorage`: 纯内存深拷贝适配器，用于无 IndexedDB 宿主环境、Node.js 验收脚本与只读降级环境。

#### 阶段 C：Zustand Store 异步水合、防抖保存与状态指示 (Hydration & Auto-save)
- [x] 在 `useWorkspaceStore.ts` 中扩展持久化状态：
  - `isHydrated: boolean`、`storageStatus: 'idle' | 'loading' | 'saved' | 'saving' | 'error' | 'degraded'`、`storageError: string | null`；
  - `hydrateStore()`: 应用冷启动时优先从本地存储装载快照，校验并自愈后恢复至 Store；若无快照则初始化默认示例数据并立即落地持久化；
  - `saveToStorage(immediate)`: 支持 500ms 防抖保存，在页面增删改、块更新、收藏、重命名、侧边栏折叠与主题切换时自动触发。
- [x] 在 `App.tsx` 挂载时触发 `hydrateStore()`，并在水合完成前呈现轻量平滑骨架过渡，彻底杜绝默认数据闪烁与覆盖本地修改。
- [x] 在 `Navbar.tsx` 右侧嵌入存储状态响应式微型徽标（`已保存本地` / `保存中...` / `存储降级` / `离线就绪`），鼠标悬停提供详细状态 Tooltip。
- [x] 异常容灾保障：当 IndexedDB 抛出异常或配额溢出时，非阻塞优雅降级为 `degraded` 状态，内存文档编辑与交互完全不受影响。

#### 阶段 D：测试套件、全量回归与 Sprint 1 阶段收尾
- [x] 新增 `scripts/verify-day7.mjs` 并在 `package.json` 中登记 `verify:day7` 验收脚本，全量覆盖级联删除与孤立 parentId 根除、快照 Schema 校验、Block 深度规整、存储适配器生命周期、存储异常降级 5 大核心测试集全部通过。
- [x] 在 `src/test/BlockEditor.test.tsx` 扩充 Day 7 专属单测（用例 47 ~ 52），断言级联删除与树自愈、快照 Schema 校验与清洗、Store 异步水合、防抖保存与状态流转、存储降级保护、Navbar 状态徽标渲染。
- [x] 全链路验证通过：
  - `npm test`：52/52 全部通过，0 warnings / 0 errors；
  - `npm run verify:day7`：通过 (Exit Code 0)；
  - `npm run verify:day2` ~ `npm run verify:day6`：全量回归 100% 通过 (Exit Code 0)；
  - `npx tsc --noEmit`：TypeScript 静态类型检查零错误；
  - `npm run build`：生产打包构建顺利完成 (Exit Code 0)。

#### Day 7 验收清单（已完成逐项核查）
- [x] 首次访问无本地快照时自动载入初始化工作区并落地 IndexedDB；二次访问及刷新时准确恢复此前编辑的文档内容、激活页、侧边栏及主题。
- [x] 在页面内编辑文本、增删块、调整标题、切换主题时，顶栏状态准确在 `保存中...` 与 `已保存本地` 间响应流转，防抖 500ms 后静默完成。
- [x] 删除含有多层嵌套子页面的父页面时，弹出包含准确子页面数量的确认弹窗；确认后连同所有子代完全级联删除，页面树中绝无孤立孤儿页面；若被删页面为当前激活页，安全回退至存活父级或顶级页面。
- [x] 模拟存储配额满或抛出异常时，顶栏展示橙色“存储降级”状态并记录错误信息，用户在内存中继续创建和编辑页面完全不发生报错崩溃。
- [x] Day 2 ~ Day 6 既有功能（轻量块树、常用块类型、列表缩进防跳级、代码高亮、斜杠指令、选区浮动栏、拖拽重排、批量删除）100% 保持无回归。

---

### Sprint 1 阶段总结与向 Sprint 2 演进交付说明

#### 1. Sprint 1 阶段交付全景
Sprint 1（脚手架与核心编辑器）已圆满完成 7 天的精细化迭代与高质量交付：
- **基础设施与工作区**：Notion 风格工作区、多级无限层级页面树、全局快速搜索 (Ctrl+K)、明暗主题响应；
- **自主块树编辑器引擎**：自主研发 `mc-block-engine`，以标准 `BlockNode` 为基础单元，彻底规避 Web Components 隔离弊端与富文本全文树陷阱；
- **丰富块类型矩阵**：段落、一级至三级标题、分割线、无序列表、有序列表（动态递增计算）、待办清单（划线交互）、代码块（Prism.js Token 高亮与 14 种语言）、引用块、提示块（12 Emoji + 5 色彩基调）；
- **高级流式与批量交互**：拼音/全拼/英文多模态斜杠指令 (`/`)、选区浮动工具栏 (Bubble Menu)、6-dot 悬浮手柄、HTML5 拖拽上下指示线重排、多块连续/非连续多选、一键批量删除与 Markdown 复制，全链路接入 Undo/Redo 本地历史栈；
- **离线持久化与数据完整性**：原生 IndexedDB 版本化存储快照、首屏水合保护、500ms 防抖保存、页面级联删除防孤立 parentId、受限环境降级容灾；
- **工程化质量保障**：全套 52 项 Vitest 真实组件测试（0 警告、0 报错）、6 大专项自动化验收脚本、TypeScript 零错误、生产构建随时就绪。

#### 2. 向 Sprint 2 (多维数据库引擎与三重视图) 演进交接说明
- **数据结构扩展规范**：Sprint 2 将引入 `Database`、`Column/Property`、`Row/Item`、`Cell` 模型。在块树中，多维表格将作为一个顶级的特殊块类型（`type: 'database'` 或以独立子页面形式挂载），其属性将存放在 Block properties 或独立 Database 实体中；
- **持久化契约兼容**：`WorkspaceSnapshot` 已具备 `version: 1` 版本号标记，后续在 Sprint 2 引入多维数据库 Schema 时可无缝平滑升级至 `version: 2` 并由迁移纯函数进行向下兼容；
- **协同就绪性**：目前所有 Block 操作均为不可变原子操作与显式属性清洗，完全契合后续 Sprint 3 中接入 Yjs `Y.Array<Y.Map>` 的映射要求。

---

## 五、 与 AI 结对编程的高效推进实践

当您每天准备推进项目时，可以按照以下提示词模式与 AI 协作：

### 1. 每日启动提示词
```text
"今天我们推进 [Sprint X - Day Y: 具体任务名]，请查看 DAILY_DEVELOPMENT_PLAN.md 中的任务清单，给出今天这一步的实现步骤，并开始第一步编码。"
```

### 2. 每日收尾与打卡提示词
```text
"今天的代码已经验证完成，请帮我：
1. 更新 DAILY_DEVELOPMENT_PLAN.md 中的看板进度与完成度；
2. 总结今日完成的核心点，并给出明天的预告建议。"
```

---
*「千里之行，始于足下。保持每日推进，打造自主可控的下一代知识库系统！」*
