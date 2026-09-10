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
| **编辑器与协同内核** | 待实现：BlockSuite / TipTap（Day 2 确定选型），后续接入 Yjs + y-indexeddb |
| **桌面客户端壳** | 规划：Tauri 2.0 (Rust) |
| **后端 API & WebSocket** | 规划：Node.js (Hono / Fastify) + Hocuspocus CRDT 网关 |
| **数据持久化与存储** | 规划：PostgreSQL 16 (Prisma/Drizzle) + S3 兼容对象存储 (MinIO/R2) |
| **部署形式** | 当前为 mc_web 独立 npm 工程；规划 Docker Compose 一键启动 |

---

## 📍 当前进度与 Day 1 核查

截至 2026-09-10，处于 **Sprint 1，Day 1 前端骨架已完成，Day 2 已规划、待实现**（1 / 35，约 3%）。

- 已实现递归页面树、页面新建/删除/标题重命名/收藏、面包屑、明暗主题、Emoji 图标与预设远程封面更换。
- 已实现 Ctrl+K / Cmd+K 搜索标题与顶层块文本，支持方向键选择及回车跳转。
- 正文只有基础块展示与 todo 勾选，尚不能编辑文本；“双人协同就绪”为静态占位。
- 文档保存于内存，刷新会重置，只有主题保存至 localStorage。父页面删除未处理后代页面，已列入 Sprint 1 待修项。
- 本次源码核查及 npm run build（含 TypeScript 检查）通过，未做浏览器全量交互验收。构建复核过程见每日规划核查记录。

## 🎯 Day 2 计划：基础块编辑闭环

1. 确定编辑器内核、依赖版本与 BlockNode 数据映射，保留稳定 ID 和已有示例块。
2. 建立编辑组件并接入详情页，经 Store 更新当前页面正文，切页不串写、不丢失内存内容。
3. 实现 Paragraph、H1-H3 输入/切换与 Divider 插入/删除，提供基础操作入口。
4. 完成 Enter 拆分、Backspace 合并及空块/首块边界，验证中文输入、粘贴、撤销/重做和光标行为。
5. 通过构建与手工回归后再标记完成；列表、Slash 菜单、拖拽、持久化和协同按后续日程推进。

详细任务、核查依据及验收清单见 [每日研发规划](DAILY_DEVELOPMENT_PLAN.md)。

## 🚀 本地开发

```bash
cd mc_web
npm ci
npm run dev
```

在 mc_web 目录执行 `npm run build` 完成 TypeScript 检查与生产构建。

## 📅 每日开发推进建议

打开 [DAILY_DEVELOPMENT_PLAN.md](DAILY_DEVELOPMENT_PLAN.md) 查看当前进度与今日目标。每日只需输入：

> *"今天我们推进 [Sprint 1 - Day 2: Block 富文本编辑器核心与常用块类型渲染]，请查看 DAILY_DEVELOPMENT_PLAN.md 并开始。"*

即可快速进入当日开发闭环！