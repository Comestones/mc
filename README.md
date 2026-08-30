# 🌌 mc (Modular Collaboration / Multi-dimension Core)

自主可控、私有化部署、支持本地极速响应与双人/多人无缝实时协作的 **Notion 级多维知识库与结构化数据库平台**。

---

## 📚 项目核心文档导航

- 📋 **[系统架构与宏观规划 (Product Architecture & Planning)](file:///d:/Project/ai/antigravity/mc/mc_software/plan.md)**: 了解项目定位、技术选型（React + Yjs + Hocuspocus + PostgreSQL + S3）、三大多维视图与系统架构。
- 🚀 **[每日推进与研发规划指南 (Daily Development Plan & Roadmap)](file:///d:/Project/ai/antigravity/mc/DAILY_DEVELOPMENT_PLAN.md)**: 35 天按日精细化拆解、每日微迭代闭环工作法与动态进度看板。

---

## 🛠️ 技术栈总览

| 模块 | 推荐选型 |
| :--- | :--- |
| **前端 Web & UI** | React 19 + TypeScript + Vite + Tailwind CSS + Shadcn UI |
| **编辑器与协同内核** | BlockSuite / TipTap + Yjs + y-indexeddb |
| **桌面客户端壳** | Tauri 2.0 (Rust) |
| **后端 API & WebSocket** | Node.js (Hono / Fastify) + Hocuspocus CRDT 网关 |
| **数据持久化与存储** | PostgreSQL 16 (Prisma/Drizzle) + S3 兼容对象存储 (MinIO/R2) |
| **部署形式** | Docker Compose 一键启动 |

---

## 📅 每日开发推进建议

打开 [DAILY_DEVELOPMENT_PLAN.md](file:///d:/Project/ai/antigravity/mc/DAILY_DEVELOPMENT_PLAN.md) 查看当前进度与今日目标。每日只需输入：

> *"今天我们推进 [Sprint 1 - Day 1: Monorepo 体系与基础开发环境拉起]，请查看 DAILY_DEVELOPMENT_PLAN.md 并开始。"*

即可快速进入当日开发闭环！