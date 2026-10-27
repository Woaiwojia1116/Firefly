# 友链页 MotionPath 路线重构方案

## 1. 概要

参考 `https://demos.gsap.com/demo/motionpath-waypoints/`（GSAP MotionPathPlugin + ScrollTrigger），把友链页从「卡片网格」改造成「滚动驱动的路线舞台」：

- 滚动页面时，一个暖色光点沿 SVG 曲线滑动；
- 曲线上分布与友链数量相同的虚线站点（带编号）；
- 光点经过每个站点时，舞台中央切换显示该友链的封面大图、名称、描述、域名与标签；
- 到达最后一个站点后路线结束，下面是原有的自定义内容与评论区。

不新增依赖（`gsap` 已安装，`MotionPathPlugin` 与 `ScrollTrigger` 都在包内）；首页、文章页、时间轴页不受影响。

## 2. 现状分析

- [friends.astro](file:///f:/blog/Firefly/src/pages/friends.astro)
  - 第 37 行用 `getEnabledFriends()` 取友链，第 38 行生成 `allTags` 供标签筛选。
  - 第 47-142 行：`.ip.ip-friends` → `div.flex...overflow-hidden` → `.card-base`，内含 `PageTitle`、`friend-filter` 标签按钮和 `.friends-grid` 卡片网格。
  - 第 160-225 行：`friend-filter` 自定义元素，通过切换 `display` 与 `animate-fade-in-up` 做筛选。
  - 第 227-233 行：页面内 `<style is:global>` 定义 `.friends-grid`。
- [inner-pages.css](file:///f:/blog/Firefly/src/styles/inner-pages.css#L1003-L1051)：友链卡片网格与 `.friend-card` 的视觉规则（纸面、细线、暖色 hover）。
- [config.ts](file:///f:/blog/Firefly/src/types/config.ts#L711-L719)：`FriendLink` 只有 `title / imgurl / desc / siteurl / tags / weight / enabled`。
- [friendsConfig.ts](file:///f:/blog/Firefly/src/config/friendsConfig.ts)：当前启用 10 条友链，按 `weight` 排序。
- 滚动是原生 window 滚动（`BackToTop.astro` 注释确认未使用 OverlayScrollbars），ScrollTrigger 可直接使用。
- Swup 配置 `updateHead: true`、`reloadScripts: true`，并在 `page:view` 派发 `astro:page-load`；页面脚本必须处理重复执行与跨页清理。
- 全局 [page-entrance.ts](file:///f:/blog/Firefly/src/utils/page-entrance.ts) 会动画 `.ip-head` 与 `.friend-card`；新页面不再使用 `.friend-card`，不会冲突。
- 现有友链页外层 `div` 带 `overflow-hidden`，会让 `position: sticky` 失效；新结构必须移除该限制。

## 3. 方案设计

### 3.1 页面结构（桌面）

```
.ip.ip-friends
├─ .friends-intro（普通流）
│  └─ PageTitle（eyebrow=FRIENDS、标题、描述）+ 友链数量 / 操作提示
├─ .friends-stage（高度 = 100vh + 友链数 × 42vh）
│  └─ .friends-stage__sticky（sticky，top ≈ 4.5rem，高 ≈ 100vh - 6rem）
│     ├─ .friends-stage__hud（ROUTE · FRIENDS / 当前序号 / 进度条）
│     ├─ svg.friends-stage__svg（viewBox 1200×680，preserveAspectRatio="none"）
│     │  └─ path[data-friends-path]
│     ├─ .friends-waypoint × N（按 SVG 坐标转百分比定位的虚线站点）
│     ├─ .friends-stage__dot（暖色菱形光点）
│     └─ .friends-deck（绝对定位居中）
│        └─ a.friend-stop × N（封面 + 信息，非激活项隐藏）
├─ 自定义内容（保留）
└─ 评论区（保留）
```

- 舞台背景使用极淡网格（`repeating-linear-gradient`），颜色全部取自 `--ip-*` 令牌，自动适配明暗主题。
- 站点坐标在 frontmatter 中生成，SSR 输出，不依赖 JS 计算；路径用 Catmull-Rom 转三次贝塞尔生成平滑 `d`。
- 卡片始终居中（避免 10 个站点分布在页面边缘导致卡片溢出），切换时按奇偶交替从左右轻微滑入。
- 每个友链对应一段等长滚动区间：`index = floor(progress * count)`。

### 3.2 移动端与减少动态效果

- `< 768px`：舞台退化为普通纵向列表，隐藏 SVG、光点与站点标记，所有友链卡片直接排列并可点击。
- `prefers-reduced-motion: reduce`：同样退化为静态列表，不初始化 ScrollTrigger。
- 用同一套 `.friend-stop` 标记，仅靠媒体查询切换 `position` / 显隐，不复制第二套卡片。

### 3.3 数据与封面字段

- `FriendLink` 新增可选 `cover?: string`（封面大图）。
- 渲染时 `item.cover || item.imgurl`，未填封面时回退头像，页面不会出现空白图。
- 在 `friendsConfig.ts` 的示例注释中补充 `cover` 用法，实际数据不改动，由用户自行填写。

## 4. 具体改动

### 4.1 `src/types/config.ts`

在 `FriendLink`（约第 711-719 行）中新增：

```ts
cover?: string; // 友链封面大图URL，留空则使用 imgurl 头像
```

### 4.2 `src/config/friendsConfig.ts`

- 在文件顶部注释中说明 `cover` 字段。
- 在第一条被注释的示例（KASUIE 之前那段）加入 `cover` 示例行，便于用户照抄。
- 不修改任何现有友链数据。

### 4.3 `src/pages/friends.astro`

frontmatter：

- 保留 `getEnabledFriends()` 与评论开关逻辑。
- 删除 `allTags`（第 38 行）与 `i18n(I18nKey.all)` 相关使用。
- 新增路径生成：

```ts
const VIEW_W = 1200;
const VIEW_H = 680;

const stations = items.map((_, i) => {
  const t = items.length === 1 ? 0.5 : i / (items.length - 1);
  return {
    x: 90 + t * (VIEW_W - 180),
    y: VIEW_H / 2 + Math.sin(i * 0.95) * 118,
  };
});

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d +=
      ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6},` +
      ` ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6},` +
      ` ${p2.x} ${p2.y}`;
  }
  return d;
}

const pathD = buildSmoothPath(stations);
```

模板：

- 删除原第 48-142 行的 `overflow-hidden` 包装、筛选按钮、`.friends-grid`。
- 用 `.friends-intro` 放 `PageTitle`，并显示友链总数（等宽字体小标签）。
- 友链为空时保留一段空态提示，不渲染舞台。
- 舞台根节点：`<section class="friends-stage" data-friends-stage style={`--friends-count:${items.length}`}>`。
- sticky 层内：

```astro
<div class="friends-stage__hud">
  <span class="friends-stage__eyebrow">ROUTE · FRIENDS</span>
  <span class="friends-stage__tag">{items.length} SITES</span>
  <span class="friends-stage__counter" data-friends-counter>01 / {String(items.length).padStart(2, "0")}</span>
</div>

<svg class="friends-stage__svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
  <path class="friends-stage__line" data-friends-path d={pathD} />
</svg>

{stations.map((point, i) => (
  <div
    class="friends-waypoint"
    data-friends-waypoint={i}
    style={`left:${(point.x / VIEW_W) * 100}%;top:${(point.y / VIEW_H) * 100}%`}
    aria-hidden="true"
  >
    <span>{String(i + 1).padStart(2, "0")}</span>
  </div>
))}

<div class="friends-stage__dot" data-friends-dot aria-hidden="true"></div>
```

- 卡片（同一份标记同时服务桌面舞台与移动静态列表）：

```astro
<div class="friends-deck">
  {items.map((item, i) => (
    <a
      class="friend-stop"
      href={item.siteurl}
      target="_blank"
      rel="noopener noreferrer"
      data-friends-card={i}
      data-active={i === 0 ? "true" : undefined}
      aria-hidden={i === 0 ? undefined : "true"}
      tabindex={i === 0 ? 0 : -1}
    >
      <figure class="friend-stop__cover">
        <img src={item.cover || item.imgurl} alt={`${item.title} 封面`} loading="eager" decoding="async" />
      </figure>
      <div class="friend-stop__body">
        <div class="friend-stop__meta">
          <span>NO.{String(i + 1).padStart(2, "0")}</span>
          <span>{item.siteurl.replace(/^https?:\/\//, "").split("/")[0]}</span>
        </div>
        <h2 class="friend-stop__title">{item.title}</h2>
        <p class="friend-stop__desc">{item.desc}</p>
        {item.tags?.length ? (
          <div class="friend-stop__tags">
            {item.tags.slice(0, 3).map((tag) => <span>{tag}</span>)}
          </div>
        ) : null}
        <span class="friend-stop__cta">访问站点 <Icon name="material-symbols:arrow-outward-rounded" /></span>
      </div>
    </a>
  ))}
</div>
```

- 舞台之后保留自定义内容卡片与 `<Comment post={friendsPost} customPath="/friends/" />`。
- 删除第 160-225 行 `friend-filter` 自定义元素脚本、第 227-233 行内联 `<style>`。
- 新增页面脚本：

```astro
<script>
  import { initFriendsMotionPath } from "@/utils/friends-motion-path";
  initFriendsMotionPath();
</script>
```

### 4.4 新增 `src/utils/friends-motion-path.ts`

- 静态导入并注册插件：

```ts
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);
```

- `initFriendsMotionPath()` 只注册一次监听（`window.__friendsMotionPathBound` 守卫），绑定 `astro:page-load` 执行 `init()`、`astro:before-swap` 执行 `destroy()`。
- `init()`：
  - 清理旧实例（`ctx.revert()`，ScrollTrigger 由 context 一并回收）。
  - 无 `[data-friends-stage]`、少于 2 条友链、`max-width: 767px` 命中、或 `prefers-reduced-motion: reduce` 时直接返回，交给 CSS 静态列表。
  - 取 `path`、`dot`、`cards`、`waypoints`、`counter`。
  - `gsap.set(cards, { autoAlpha: 0, y: 18 })`，首张设为激活。
  - 在 `gsap.context(() => {...}, stage)` 内创建 ScrollTrigger：

```ts
const trigger = ScrollTrigger.create({
  trigger: stage,
  start: "top 4.5rem",
  end: "bottom 4.5rem",
  scrub: 0.65,
  invalidateOnRefresh: true,
  onUpdate: (self) => {
    const index = Math.min(count - 1, Math.floor(self.progress * count));
    if (index !== activeIndex) setActive(index, index > activeIndex ? 1 : -1);
    setProgress(self.progress);
  },
});

gsap.to(dot, {
  motionPath: {
    path,
    align: path,
    alignOrigin: [0.5, 0.5],
    start: 0,
    end: 1,
  },
  ease: "none",
  scrollTrigger: trigger,
});
```

  - `setActive(index, direction, immediate?)`：
    - 旧卡 `gsap.to(prev, { autoAlpha: 0, y: direction * -14, duration: 0.32, overwrite: true })`；
    - 新卡 `gsap.fromTo(next, { autoAlpha: 0, y: direction * 18 }, { autoAlpha: 1, y: 0, duration: 0.42, overwrite: true })`；
    - 同步 `data-active`、`aria-hidden`、`tabindex`；
    - 切换 `.friends-waypoint.is-active`；
    - 更新 `[data-friends-counter]` 文本（`01 / 10`）。
  - `setProgress` 更新 HUD 进度条宽度（CSS 变量 `--friends-progress`）。
  - 首帧调用 `setActive(0, 1, true)` 并刷新一次 `ScrollTrigger.refresh()`；封面色图 `load` 后再 refresh 一次（图固定比例，理论上不改变布局）。
- `destroy()`：`ctx?.revert(); ctx = null;`，避免 Swup 离开后残留触发器。

### 4.5 `src/styles/inner-pages.css`

替换第 1003-1051 行「友链：卡片网格」整段，改为舞台样式（全部限定 `body:not(.homepage)`，使用现有 `--ip-*` 令牌）：

- `.friends-stage`：`height: calc(100vh + var(--friends-count) * 42vh); position: relative;`
- `.friends-stage__sticky`：`position: sticky; top: 4.5rem; height: calc(100vh - 6rem); min-height: 32rem; overflow: hidden;`（sticky 需要祖先无 `overflow: hidden`，所以页面结构已移除旧包装）。
- 背景网格：`::before` 用 32px 的 `repeating-linear-gradient`（`--ip-line-soft`），`mask-image: radial-gradient(...)` 让边缘淡出。
- `.friends-stage__svg`：`position:absolute; inset:0; width:100%; height:100%;`
- `.friends-stage__line`：`fill:none; stroke: var(--ip-line); stroke-width:1;`
- `.friends-waypoint`：58px 虚线方框（`border:1px dashed var(--ip-line)`），居中编号（`--ip-mono`，`--ip-ink-faint`）；`.is-active` 时边框换成 `--ip-warm`、编号变 `--ip-warm`。
- `.friends-stage__dot`：16px 菱形（`transform: rotate(45deg)`），背景 `linear-gradient(135deg, var(--ip-warm), #e7a6a3)`，柔光用 `color-mix(in srgb, var(--ip-warm) 40%, transparent)`，`will-change: transform`。
- `.friends-deck`：`position:absolute; inset:0; display:grid; place-items:center; pointer-events:none;`
- `.friend-stop`：约 `min(34rem, calc(100% - 4rem))`，两栏（封面 1.15fr / 信息 1fr），`background: var(--ip-surface)`、`border:1px solid var(--ip-line)`、`border-radius: var(--ip-radius)`、无阴影；`opacity:0; visibility:hidden; pointer-events:none;`。
- `.friend-stop[data-active="true"]`：`pointer-events:auto;`
- `.friend-stop__cover`：`aspect-ratio: 4 / 3`（桌面可改 16 / 10），`overflow:hidden`，图片 `object-fit: cover`。
- `.friend-stop__meta`：等宽小字、大写、`--ip-ink-faint`；标题 1.25rem、600；描述两行截断；标签沿用胶囊细线；CTA 暖色。
- `.friends-stage__hud`：absolute 顶部，左侧眉标、右侧计数；底部细进度条用 `::after` + `--friends-progress`。
- 移动端 `@media (max-width: 767px)`：
  - `.friends-stage { height:auto; }`
  - `.friends-stage__sticky { position:relative; top:auto; height:auto; min-height:0; padding-block:1rem; }`
  - 隐藏 `.friends-stage__svg`、`.friends-stage__dot`、`.friends-waypoint`；
  - `.friends-deck { position:static; display:flex; flex-direction:column; gap:.85rem; pointer-events:auto; }`
  - `.friend-stop { position:relative; width:100%; display:flex; opacity:1; visibility:visible; pointer-events:auto; }`
  - HUD 改为普通流。
- `@media (prefers-reduced-motion: reduce)` 追加与移动端相同的静态规则（不限宽度）。
- 第 1054 行起的筛选按钮规则保留（图库/番剧仍使用）。

## 5. 假设与决策

- 采用「当前方案」：滚动驱动、替换卡片网格、新增 `cover` 字段（用户已确认）。
- 桌面优先；移动端只提供静态列表，不做移动端路径动画。
- 不保留标签筛选；标签仅作为卡片信息展示。
- 卡片居中揭示，而不是把每张卡片摆到对应站点旁，避免宽屏溢出与遮挡。
- 封面图缺失时回退 `imgurl` 头像，不生成占位图。
- 自定义内容、评论区、标题、描述、页面路由全部保留。
- 不新增依赖；不使用 Draggable / 自动轮播。

## 6. 验证

1. `pnpm check` 0 errors，`pnpm build` 通过。
2. 浏览器（预览服务 `http://localhost:4322/friends/`）：
   - 1440×900：首屏显示第 1 条友链、光点在路径起点、计数器 `01 / 10`。
   - 缓慢滚动：光点连续移动，卡片按顺序切换，无空白、无闪烁、无卡死；滚到底部后评论区正常。
   - 反向滚动：卡片顺序可倒退，状态与计数器同步。
   - 1280 与 1920 宽度：路径与站点标记仍对齐，卡片不溢出。
   - 明暗主题切换：网格、虚线框、光点、卡片均正常。
   - 点击当前卡片：新标签页打开正确站点；非激活卡片不可点击、不可 Tab 聚焦。
   - 390×844：静态列表显示全部友链，链接可点击，无 SVG/光点残留。
   - 系统开启「减少动态效果」：桌面同样退化为静态列表。
   - Swup：首页 → 友链 → 归档 → 返回友链，动画可重复初始化；控制台无报错；`ScrollTrigger.getAll().length` 不会累积。
3. 若预览服务未运行，先重新启动再验证；不要重复启动同一端口。
