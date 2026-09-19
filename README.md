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
| **编辑器与协同内核** | 已实现：自主轻量块树引擎 (`mc-block-engine`)，实现 BlockNode 1:1 双向绑定与常用块编辑；规划接入 Yjs + y-indexeddb |
| **桌面客户端壳** | 规划：Tauri 2.0 (Rust) |
| **后端 API & WebSocket** | 规划：Node.js (Hono / Fastify) + Hocuspocus CRDT 网关 |
| **数据持久化与存储** | 规划：PostgreSQL 16 (Prisma/Drizzle) + S3 兼容对象存储 (MinIO/R2) |
| **部署形式** | 当前为 mc_web 独立 npm 工程；规划 Docker Compose 一键启动 |

---

## 📍 当前进度与最新交付

截至 2026-09-17，**Sprint 1 (Day 1 至 Day 7: 脚手架与核心编辑器) 已 100% 圆满交付收官**（7 / 35，20%），即将开启 **Sprint 2 (多维数据库引擎与三重视图)**。

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
  - **全量测试与回归**：新增 `scripts/verify-day9.mjs`（5 大核心交互验收全部通过，200 行插入 ~3ms、更新 ~0.8ms），Vitest 扩充至 **63 项全部通过**，全套历史回归零错误，生产构建连续两次成功。

## 🎯 下一阶段：Sprint 2 (多维数据库引擎与三重视图，Day 8 - 14)

- **Day 8**：多维数据库 Schema 设计与底层数据层 *(已完成)*。
- **Day 9**：表格视图 (Table View) 核心交互、列宽拖拽调整与单元格即时点按编辑 *(已完成)*。
- **Day 10**：基础字段类型系统 (Property Types: text, number, checkbox, select, multiSelect)。

详细任务、核查依据及验收清单见 [每日研发规划](DAILY_DEVELOPMENT_PLAN.md)。

## 🚀 本地开发与验收

```bash
cd mc_web
npm ci
npm run dev
```

- 在 `mc_web` 目录执行 `npm test` 运行 Vitest 真实组件测试套件（63 项全部通过，0 警告 0 报错）。
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

> *"今天我们推进 [Sprint 2 - Day 9: 表格视图核心交互与单元格点按编辑]，请查看 DAILY_DEVELOPMENT_PLAN.md 并开始。"*

即可快速进入当日开发闭环！