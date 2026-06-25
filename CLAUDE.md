# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### 三层页面结构

页面渲染遵循以下层次：

1. **Layout.astro** (`src/layouts/Layout.astro`) — 所有页面的根壳层，负责：
   - 引入全局 CSS（`variables.styl`、`main.css`、`sakura-theme.css`、`markdown-extend.styl`）
   - 渲染 `ConfigCarrier`（将 `themeColor.hue` 和 `wallpaper-mode` 注入为 `data-*` 属性供 CSS 使用）
   - 处理暗色模式切换（JS 在 `<html>` 上 toggle `dark` class）
   - 管理横幅高度和 Swup 页面过渡容器

2. **双布局系统**（在 Layout.astro 内部根据 `siteConfig.postListLayout.defaultMode` 选择）：
   - **Layout.astro** — 传统博客布局，单侧边栏
   - **MainGridLayout.astro** — 网格/瀑布流布局，双侧边栏

3. **页面组件** (`src/pages/`) — 具体页面，如 `[...slug].astro`（文章）、`archive.astro`、`friends.astro` 等

### Swup 页面过渡系统

本项目使用 **Swup.js** 实现 SPA 风格的无刷新页面切换。关键注意事项：

- Swup 替换的容器在 `astro.config.mjs` 的 `swup.containers` 中定义（`#swup-container`、`#left-sidebar-dynamic`、`#right-sidebar-dynamic` 等）
- **页面切换后，DOMContentLoaded 不会重新触发**。所有需要在页面切换后重新初始化的逻辑必须通过 `window.swup.hooks.on("content:replace", ...)` 或 `document.addEventListener("firefly:page:loaded", ...)` 实现
- 在 Twikoo 评论组件中可以看到标准模式：初始化函数同时绑定 `DOMContentLoaded` 和 `content:replace` 事件

### 配置传递模式

有几种方式将服务器端配置传递到客户端脚本：

1. **`define:vars`** — Astro 的 `<script define:vars={{ obj }}>` 语法，将变量序列化为 JSON 注入脚本。**注意**：只适合传递简单的小对象。如果对象包含复杂值（如 `Astro.props.path` 在某些构建环境下），可能导致 `JSON.stringify` 失败或产生意外结果。

2. **`data-*` 属性** — 将 JSON 序列化到 HTML 元素的 `data-*` 属性上，客户端用 `JSON.parse` 读取。适合传递可能包含特殊字符或嵌套结构的配置。

3. **ConfigCarrier 模式** — `src/components/layout/ConfigCarrier.astro` 将 `themeColor.hue` 和 `wallpaper-mode` 注入为 CSS 根元素的 `data-*` 属性，供 `variables.styl` 中的 CSS 规则使用。

### 组件组织 (`src/components/`)

组件按用途分类：
- **layout/** — 页面结构（导航栏、侧边栏、页脚、文章卡片、横幅）
- **controls/** — 交互控件（返回顶部、浮动目录、搜索、主题切换）
- **common/** — 可复用 UI 组件（链接按钮、图标、封面图、Markdown 渲染器）
- **widget/** — 侧边栏小部件（个人资料、日历、音乐、标签、站点统计）
- **features/** — 全局功能（字体管理器、音乐管理器、樱花特效、Fancybox 图片查看器）
- **comment/** — 评论系统集成（Artalk、Disqus、Giscus、Twikoo、Waline）
- **analytics/** — 统计集成（Google Analytics、Microsoft Clarity、Umami、51la）
- **misc/** — 杂项（许可证、推荐文章、分享海报）

### 配置系统 (`src/config/`)

所有站点配置集中在 `src/config/` 目录，`index.ts` 统一导出。主要配置文件：
- `siteConfig.ts` — 站点主要设置（标题、主题、页面开关、布局）
- `navBarConfig.ts` — 导航栏配置
- `sidebarConfig.ts` — 侧边栏布局和小部件
- `backgroundWallpaper.ts` — 背景/壁纸设置
- `commentConfig.ts` — 评论系统设置
- `fontConfig.ts` — 字体配置
- `musicConfig.ts` — 音乐播放器配置
- `coverImageConfig.ts` — 封面图配置

**注意**：配置在 Astro frontmatter（`---` 块）中处理，是服务器端数据。如果需要在客户端脚本中使用，必须通过上述"配置传递模式"显式传递。

### 内容集合

内容通过 Astro Content Collections 管理：
- **文章**：`src/content/posts/` — Markdown/MDX 格式的博客文章
- **专题**：`src/content/spec/` — 特殊页面

文章的 frontmatter 结构定义在 `src/content.config.ts` 中。关键字段包括：
- `title`、标题
- `published`：发布日期
- `image`：封面图（支持 `"api"` 表示随机图）
- `tags`、`category`：分类标签
- `comment`：是否启用评论
- `password`：加密文章密码
- `timelineOnly`：是否仅显示在时间轴

### 国际化 (`src/i18n/`)

UI 翻译支持 zh_CN、zh_TW、en、ja、ru。`i18n()` 函数提供翻译功能，缺失时会回退到中文。

翻译文件位于 `src/i18n/languages/`，键名定义在 `src/i18n/i18nKey.ts`。

### 路径别名

在 `tsconfig.json` 和 `astro.config.mjs` 的 `vite.resolve.alias` 中同步配置：
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
- 图片懒加载和响应式处理

### 暗色模式

使用 `:root.dark` 选择器（非 `html.dark`），在 `variables.styl` 中定义暗色变量。切换主题时 JavaScript 在 `<html>` 上添加/移除 `dark` class。

主题色相通过 `siteConfig.themeColor.hue` 控制，ConfigCarrier 将其注入到 CSS 中。

### 构建输出

- 输出目录：`dist/`
- 带有客户端交互的静态站点
- 优化后的图片位于 `dist/_astro/`
- Pagefind 搜索索引位于 `dist/pagefind/`

### 构建流程

`pnpm build` 执行以下步骤：
1. `node scripts/generate-icons.js` — 生成 PWA 图标
2. `astro build` — 构建静态站点
3. `pagefind --site dist` — 生成搜索索引

### 部署

已配置 Vercel（`vercel.json`），但可部署到任何静态托管平台（Netlify、Cloudflare Pages 等）。

`vercel.json` 配置了安全响应头（X-Content-Type-Options、X-Frame-Options 等）和静态资源长期缓存（`/_astro/*` 缓存 1 年）。

## Biome 配置注意事项

- 使用 **tab 缩进**（`indentStyle: "tab"`）
- 使用 **双引号**（`quoteStyle: "double"`）
- 对 `.svelte`、`.astro`、`.vue` 文件禁用了 `useConst`、`useImportType`、`noUnusedVariables`、`noUnusedImports` 规则
- CSS 文件（`src/**/*.css`）和 `src/public/**/*` 不在 Biome 处理范围内
- `src/constants/icons.ts` 被 Biome 忽略（可能因为文件过大）
