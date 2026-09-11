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
- [ ] **Day 4: 增强块组件 (Code / Quote / Callout)**
  - 代码高亮块 (Code block)：支持语言选择、语法高亮与一键复制代码
  - 引用块 (Quote block) 与 提示块 (Callout block，支持自定义 Icon 与背景色)
- [ ] **Day 5: 斜杠指令 (Slash Command `/`) 与浮动菜单**
  - 输入 `/` 呼出块选择快捷菜单（支持模糊拼音/英文搜索过滤）
  - 选中文字后呼出 Bubble Menu（加粗、斜体、下划线、删除线、行内代码、超链接）
- [ ] **Day 6: 块级拖拽排序与批量操作**
  - 实现块左侧 `6-dot` 悬浮手柄（Grip handle）
  - 支持块级拖拽重排与批量框选
- [ ] **Day 7: 本地离线持久化 (IndexedDB) 与 Sprint 1 阶段总结**
  - 本地状态即时自动保存 (IndexedDB)
  - Sprint 1 整体编辑体验调优与代码审查

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
- **当前所处 Sprint**: **Sprint 1 (脚手架与核心编辑器)**
- **已完成天数**: `3 / 35`
- **总体完成度**: `9%`

```
[███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 9%
```

### 🎯 今日聚焦 (Today's Focus)
- **目标**: 准备启动 **Day 4: 增强块组件 (Code / Quote / Callout)**
- **状态**：Day 3 列表与待办块已全面交付并通过 Vitest 与脚本双重自动化验收；Day 4 待开始。
- **今日交付边界**：Day 3 范围聚焦无序列表、动态有序列表、待办块、Tab 缩进与降级嵌套；未越界开发 Slash 菜单或拖拽重排。
- **完成标准**：Day 3 新增 7 个真实组件用例（累计 18/18 全绿），`verify:day3` 脚本全绿，`verify:day2` 回归通过，`npm run build` 零错误。

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
