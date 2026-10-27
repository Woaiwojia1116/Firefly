# 留言板 → 「动态」改造计划（v2：强化身份校验）

## 核心机制

- **存储**：复用自建 Twikoo（twokoo.ccwu.cc）。动态 = `/moments/` 路径下的 Twikoo 评论，客户端实时拉取渲染，发布后立即可见、无需重新构建。
- **身份校验（强化）**：进入动态流须同时满足 ① 昵称 === masterTag.nickname（"ysdy"）② 评论的 mailMd5 === 构建时由配置邮箱算出的 MD5。邮箱明文不出现在前端产物，只出现其 MD5。`masterTag.email` 为空时降级为仅昵称匹配（配置注释说明风险）。冒充需要猜中昵称 + 私密邮箱；冒充内容 Twikoo 后台可删，后台「评论审核」可作 100% 兜底（默认不开，保留即发即见）。访客发的内容一律只留在评论区，不会变成动态。
- **书写接口**：页面保留标准 Twikoo 评论区作为「写动态」入口——博主用它发布即成动态（自带表情、图片上传、通知等全部能力）；「写动态」按钮滚动聚焦到输入区。旁边加心情 emoji 快捷条（🌧️☀️🎧…），点击注入 Twikoo 输入框，以「🌧️｜正文」约定开头；渲染端解析成时间旁的小徽章。
- **互动**：每条动态卡片点赞（`COMMENT_LIKE` + localStorage 防重复）；动态下方显示 Twikoo 嵌套回复预览，访客在底部评论区即可回复动态——原留言板的互动属性保留。
- **首页**：拱窗旁手写便签运行时拉取最新一条动态（心情 emoji + 截断正文，按便签宽度拆行），失败/无动态回退配置默认文案；便签可点击跳 `/moments/`。由 `homeConfig.hero.noteLive` 开关控制。

## 新增文件

1. **`src/utils/twikoo-moments.ts`** — REST 轻客户端与解析：
   - `twikooCall(event, payload)`：POST `commentConfig.twikoo.envId`，处理 `{code, data, count, more}` 信封；
   - `fetchMoments({before})`：`COMMENT_GET`（url=`/moments/`，`before` 游标翻页），按「昵称 + mailMd5」过滤出博主动态；
   - `parseMoment(raw)`：DOMParser 解析评论 HTML → 图片节点（九宫格）、纯文本、`emoji｜`心情徽章、相对时间（dayjs relativeTime）；
   - 主页便签与动态页共用。
2. **`src/components/pages/Moments.svelte`**（client:load，仿 AdvancedSearch.svelte 先例）— 动态流孤岛：加载骨架 → 朋友圈式卡片流（博主头像/相对时间/心情徽章/正文/图片九宫格/点赞/回复预览/加载更多）；心情 emoji 快捷条（best-effort 注入 `.el-textarea__inner`）；样式 scoped + 站点 CSS 变量适配明暗。
3. **`src/pages/moments.astro`** — `pages.moments` 门控（404 约定）、MainGridLayout + PageTitle（eyebrow "MOMENTS"，icon `material-symbols:bolt`）、`Moments` 孤岛（props 注入 masterNick、masterMailMd5）、底部 `Comment customPath="/moments/"`。

## 修改文件

4. **`src/config/commentConfig.ts`**：`masterTag` 增加 `email: "你的邮箱"`（类型若缺则在 types/config.ts 补可选字段）。
5. **`src/types/config.ts`**：`pages.guestbook` → `pages.moments`；`LinkPreset.Guestbook` → `LinkPreset.Moments`；masterTag 类型补 `email?`。
6. **`src/config/siteConfig.ts`**：`pages.moments: true`。
7. **`src/constants/link-presets.ts`**：preset → `i18n(I18nKey.moments)`、`/moments/`、`material-symbols:bolt`。
8. **`src/config/navBarConfig.ts`**：门控改 `siteConfig.pages.moments`。
9. **`src/config/homeConfig.ts`**：`entryTiles` 留言板瓦片 → `{ id: "moments", label: "动态", url: "/moments/", size: "small" }`；`images.entries` 键名同步；`hero.noteLive: true` 新开关。
10. **`src/components/layout/CinematicHome.astro`**：新增 module 脚本（按现有 `window.__fyhHeroBound` + `astro:page-load` 守卫模式），到首页即拉最新动态填充 `i.fyh-hero__note-paper`（~7 字/行拆行、`el.isConnected` 防过期响应、失败静默保留 SSR 默认）；便签点击跳 `/moments/`。
11. **i18n**：`i18nKey.ts` 删 guestbook 三键，增 `moments/momentsDescription/momentsWriteHint/momentsEmpty`；zh_CN/zh_TW/en/ja/ru 五语言补齐。
12. **`src/styles/inner-pages.css`**：`.ip-guestbook` 覆盖块改 `.ip-moments`。

## 删除

13. `src/pages/guestbook.astro`、`src/content/spec/guestbook.md`（已核实全仓库无其他引用）。

## 已知取舍

- 动态为客户端渲染：不进 HTML 源码/RSS/SEO，个人博客动态流可接受。
- 冒名风险与现有留言板的绿标机制同源，双重校验后需同时猜中昵称+私密邮箱，风险足够低。
- 图片上传取决于 Twikoo 后台图床配置；未配置时以贴图链（markdown）发图。
- 旧留言板数据留在 Twikoo `/guestbook/` 路径下不删，可后台导出。

## 验证

- `pnpm type-check` + `pnpm check` 通过；
- `pnpm dev` 实测：`/moments/` 拉流/发布（昵称+邮箱匹配进流，访客不进）/点赞/加载更多、首页便签刷新与回退、导航与瓦片入口、swup 二次进站脚本重跑；
- `pnpm build` 冒烟（无编译错误）。