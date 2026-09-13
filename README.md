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

截至 2026-09-13，处于 **Sprint 1，Day 1 至 Day 4 已圆满完成，Day 5 待开始**（4 / 35，约 11%）。

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
  - **全量自动化验证**：扩充 Vitest 组件测试至 32 项（全通过），`verify:day4`、`verify:day3`、`verify:day2` 脚本全部通过，TypeScript 与 Vite 生产构建零报错。

## 🎯 Day 5 计划：斜杠指令 (Slash Command `/`) 与浮动菜单 (Bubble Menu)

1. 斜杠指令呼出面板：在空块或键入 `/` 时弹出块类型快速选择面板（支持中文拼音/英文模糊过滤搜索）。
2. 文字选中浮动菜单 (Bubble Menu)：行内文本加粗 (Bold)、斜体 (Italic)、下划线 (Underline)、删除线 (Strikethrough)、行内代码 (Inline Code) 与超链接 (Link)。

详细任务、核查依据及验收清单见 [每日研发规划](DAILY_DEVELOPMENT_PLAN.md)。

## 🚀 本地开发与验收

```bash
cd mc_web
npm ci
npm run dev
```

- 在 `mc_web` 目录执行 `npm test` 运行 Vitest 真实组件测试套件（32 项全部通过）。
- 执行 `npm run verify:day4` 运行 Day 4 数据契约、语法高亮安全、容器隔离与键盘交互验收。
- 执行 `npm run verify:day3` 运行 Day 3 列表与待办块验收。
- 执行 `npm run verify:day2` 运行 Day 2 基础编辑器回归测试。
- 执行 `npm run build` 完成 TypeScript 检查与生产打包构建。

## 📅 每日开发推进建议

打开 [DAILY_DEVELOPMENT_PLAN.md](DAILY_DEVELOPMENT_PLAN.md) 查看当前进度与今日目标。每日只需输入：

> *"今天我们推进 [Sprint 1 - Day 5: 斜杠指令 (Slash Command `/`) 与浮动菜单]，请查看 DAILY_DEVELOPMENT_PLAN.md 并开始。"*

即可快速进入当日开发闭环！