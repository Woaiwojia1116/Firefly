# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 编码原则

### 1. 编码前先思考

- **明确陈述你的假设**。如果不确定，必须先问清楚，不要自己瞎猜。
- **如果对需求有多种理解，把它们都列出来**，不要自己默默选一个。
- **如果有更简单的解决方案，要主动提出来**，必要时"反驳"用户的指令。

### 2. 简单至上

- 写能解决问题的**最少代码**。
- **不要写没被要求的功能**。
- **不要为只用一次的代码创建抽象层**。
- **不要添加没被要求的"灵活性"或"可配置性"**。
- 如果一个资深工程师看了会说"这太复杂了"，那就重写。

### 3. 外科手术式修改

- **只改动你**必须改动**的部分**。
- **不要"顺手改进"旁边的代码、注释或格式**。
- **如果代码没坏，就不要重构它**，并**匹配项目现有的代码风格**。
- 如果你看到不相关的死代码或问题，可以提一嘴，但不要动手删。
- **只清理由你自己的改动造成的废弃代码**。

### 4. 目标驱动执行

- 定义清晰的**成功标准**。循环执行任务直到验证通过。
- **不要告诉 AI 具体的操作步骤**（"写一个函数实现 X"），而是告诉它**成功的标准是什么**（"先写一个能复现 Bug 的测试，然后让测试通过"）。
- 对于复杂任务，要求它先列出分步计划，每一步都要带有验证方法。

## 项目概述

Firefly 是一款基于 Astro、Tailwind CSS 和 Svelte 构建的现代静态博客主题。这是一个面向中文用户的个人博客模板，具有丰富的自定义选项、国际化支持，以及页面过渡、搜索、评论和统计分析等丰富功能。

**技术栈：**
- Astro 6.1.9（静态站点生成器）
- Tailwind CSS 4.2.4
- Svelte 5.55.5
- TypeScript 5.9.2
- Biome 2.4.13（代码检查/格式化工具）
- Node.js ≥ 22, pnpm ≥ 9

## 常用命令

```bash
# 开发
pnpm dev              # 在 localhost:4321 启动开发服务器
pnpm start            # dev 的别名

# 构建与预览
pnpm build            # 构建到 ./dist/（包含图标生成和 pagefind 索引）
pnpm preview          # 本地预览已构建的站点

# 代码质量
pnpm check            # 使用 astro check 检查错误
pnpm format           # 使用 Biome 格式化代码
pnpm lint             # 使用 Biome 检查并自动修复
pnpm type-check       # TypeScript 类型检查

# 工具
pnpm new-post <filename>  # 创建带有 frontmatter 模板的新文章
pnpm icons          # 生成图标
```

## 架构

### 双布局系统

主题提供两种布局选项，可通过 `siteConfig.postListLayout.defaultMode` 选择：

- **Layout.astro** - 传统博客布局，单侧边栏（左侧或右侧）
- **MainGridLayout.astro** - 现代网格/瀑布流布局，双侧边栏

布局文件位于 `src/layouts/`，页面组件位于 `src/pages/`。

### 组件组织 (`src/components/`)

组件按用途分类：
- **layout/** - 页面结构（导航栏、侧边栏、页脚、文章卡片）
- **controls/** - 交互控件（返回顶部、浮动目录、搜索、主题切换）
- **common/** - 可复用 UI 组件（链接按钮、图标、封面图）
- **widget/** - 侧边栏小部件（个人资料、日历、音乐、标签、站点统计）
- **features/** - 全局功能（字体管理器、音乐管理器、樱花特效）
- **comment/** - 评论系统集成（Artalk、Disqus、Giscus、Twikoo、Waline）
- **analytics/** - 统计集成（Google Analytics、Microsoft Clarity）

### 配置系统 (`src/config/`)

所有站点配置集中在 `src/config/` 目录，每个配置文件负责特定功能。`index.ts` 统一导出所有配置以便导入。主要配置文件：
- `siteConfig.ts` - 站点主要设置（标题、主题、页面、布局）
- `navBarConfig.ts` - 导航栏配置
- `sidebarConfig.ts` - 侧边栏布局和小部件
- `backgroundWallpaper.ts` - 背景/壁纸设置
- `commentConfig.ts` - 评论系统设置

### 内容集合

内容通过 Astro Content Collections 管理：
- **文章**：`src/content/posts/` - Markdown/MDX 格式的博客文章
- **专题**：`src/content/spec/` - 特殊页面

文章的 frontmatter 结构定义在 `src/content.config.ts` 中。

### 国际化 (`src/i18n/`)

UI 翻译支持 zh_CN、zh_TW、en、ja、ru。`i18n()` 函数提供翻译功能，缺失时会回退到中文。

### 路径别名

在 `tsconfig.json` 中配置：
- `@components/*` → `src/components/*`
- `@assets/*` → `src/assets/*`
- `@constants/*` → `src/constants/*`
- `@utils/*` → `src/utils/*`
- `@i18n/*` → `src/i18n/*`
- `@layouts/*` → `src/layouts/*`
- `@/*` → `src/*`

### 插件 (`src/plugins/`)

自定义 remark/rehype 插件，用于扩展 Markdown 功能：
- 数学公式（KaTeX）
- Mermaid 图表
- PlantUML 图表
- GitHub 卡片
- 图片网格
- 阅读时间估算
- 邮箱保护
- 外部链接处理


### 暗色模式

使用 `:root.dark` 选择器（非 `html.dark`），在 `variables.styl` 中定义暗色变量。切换主题时 JavaScript 在 `<html>` 上添加/移除 `dark` class。

### 核心特性

- **页面过渡**：Swup.js 实现流畅的 SPA 风格导航
- **搜索**：Pagefind 提供客户端全文搜索
- **图片优化**：支持 AVIF/WebP 的响应式图片
- **主题**：浅色/深色/跟随系统三种模式，可自定义色相
- **壁纸模式**：横幅、叠加或无壁纸
- **移动端**：响应式设计，针对移动端专项优化

## 构建输出

- 输出目录：`dist/`
- 带有客户端交互的静态站点
- 优化后的图片位于 `dist/_astro/`
- Pagefind 搜索索引位于 `dist/pagefind/`

## 部署

已配置 Vercel（`vercel.json`），但可部署到任何静态托管平台（Netlify、Cloudflare Pages 等）。构建命令：`pnpm build`。
