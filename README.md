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

截至 2026-09-10，处于 **Sprint 1，Day 1 与 Day 2 已顺利完成，Day 3 待开始**（2 / 35，约 6%）。

- **Day 1 基础骨架**：完成递归页面树、页面 CRUD、动态面包屑、明暗主题切换、Emoji 与远程封面更换，以及 Ctrl+K / Cmd+K 全局快捷搜索。
- **Day 2 基础块编辑闭环**：
  - 交付 `mc_web/src/components/editor/` 块编辑器核心，完成自主块树架构选型，无缝映射 `BlockNode` 数据模型。
  - 支持段落 (Paragraph)、一至三级标题 (Heading 1-3) 实时编辑与无损类型切换。
  - 支持分割线 (Divider) 插入、聚焦、安全删除及后置回车连续输入。
  - 支持键盘 Enter 智能拆分（标题拆分降级段落）、Backspace 向上合并与标题降级、首块越界防护与空文档默认段落兜底。
  - 具备中文输入法 (`isComposing`) 防误拆锁、纯文本多行粘贴自动拆块与本地撤销/重做 (Undo/Redo) 栈。
  - 通过 `key={doc.id}` 彻底隔离多文档编辑生命周期，编辑内容实时同步 Store 并与全局搜索联动，既有 Todo/Callout 块正常兼容。
  - 自动化测试脚本 (`scripts/verify-day2.mjs`) 与 `npm run build` 生产构建均顺利通过 (Exit Code 0)。

## 🎯 Day 3 计划：列表与待办块实现 (Todo / List)

1. 实现无序列表 (Bullet list) 与有序列表 (Numbered list) 的键盘输入与序号递增。
2. 实现待办清单 (Todo block) 的快速创建、划线切换与点击勾选。
3. 支持 `Tab` / `Shift+Tab` 块级缩进与降级嵌套交互。

详细任务、核查依据及验收清单见 [每日研发规划](DAILY_DEVELOPMENT_PLAN.md)。

## 🚀 本地开发

```bash
cd mc_web
npm ci
npm run dev
```

在 mc_web 目录执行 `npm run build` 完成 TypeScript 检查与生产构建。
执行 `node scripts/verify-day2.mjs` 运行 Day 2 自动化验收套件。

## 📅 每日开发推进建议

打开 [DAILY_DEVELOPMENT_PLAN.md](DAILY_DEVELOPMENT_PLAN.md) 查看当前进度与今日目标。每日只需输入：

> *"今天我们推进 [Sprint 1 - Day 3: 列表与待办块实现 (Todo / List)]，请查看 DAILY_DEVELOPMENT_PLAN.md 并开始。"*

即可快速进入当日开发闭环！