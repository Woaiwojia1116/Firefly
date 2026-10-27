<script lang="ts">
/**
 * 友链页面交互组件 —— 「雨夜来信」
 * - 玻璃按钮 → 弹窗：雨夜信笺插画铺满弹窗，友链信息按信封透视（matrix3d 单应变换）
 *   写在信封书写区内，逐行浮现，点击任意一行即可复制
 * - 入场为纯 ease-out 浮现（上移 + 淡入），无回弹
 * - 弹窗通过 Svelte action (use:portal) 挂载到 body，避免被 Swup 容器的 transform 裁剪
 */

import { onMount } from "svelte";

/** 将元素移动到 document.body，销毁时自动移除（SSR 安全） */
function portal(node: HTMLElement) {
	if (typeof document !== "undefined" && document.body) {
		document.body.appendChild(node);
	}
	return {
		destroy() {
			if (
				typeof document !== "undefined" &&
				node.parentElement === document.body
			) {
				document.body.removeChild(node);
			}
		},
	};
}

import letterImg from "../../assets/images/雨夜门前的无字信笺.webp";

interface Site {
	name: string;
	desc: string;
	url: string;
	avatar: string;
	email: string;
}

interface Props {
	site: Site;
}

let { site }: Props = $props();

let isOpen = $state(false);
let isMounted = $state(false);
let closing = $state(false);
let figEl: HTMLDivElement | undefined = $state();
let figW = $state(0);
let copiedIdx = $state(-1);
// 用户滚轮接管缩放后的状态（null = 跟随默认构图）
let userZoom = $state<number | null>(null);
let userAnchor = $state<{ x: number; y: number } | null>(null);

onMount(() => {
	isMounted = true;
	// 空闲时预加载信笺大图，点击弹窗时直接命中缓存、无需等待
	const warm = () => {
		new Image().src = letterImg.src;
	};
	if ("requestIdleCallback" in window) {
		requestIdleCallback(warm, { timeout: 2500 });
	} else {
		setTimeout(warm, 1200);
	}
});

/** 信笺上可复制的字段（顺序即信封上的书写顺序） */
const letterFields = $derived([
	{ label: "站点名称", value: site.name },
	{ label: "站点描述", value: site.desc },
	{ label: "站点链接", value: site.url },
	{ label: "头像链接", value: site.avatar },
	{ label: "联系邮箱", value: site.email },
]);

function open() {
	isOpen = true;
	document.body.style.overflow = "hidden";
}

function close() {
	if (closing) return;
	closing = true;
	setTimeout(() => {
		document.body.style.overflow = "";
		isOpen = false;
		closing = false;
		copiedIdx = -1;
		userZoom = null;
		userAnchor = null;
	}, 280);
}

// Escape 关闭
$effect(() => {
	if (!isOpen) return;
	const handler = (e: KeyboardEvent) => {
		if (e.key === "Escape") close();
	};
	window.addEventListener("keydown", handler);
	return () => window.removeEventListener("keydown", handler);
});

function onOverlayClick(e: MouseEvent) {
	if (e.target === e.currentTarget) close();
}

async function copyField(i: number, value: string) {
	try {
		await navigator.clipboard.writeText(value);
	} catch {
		// 非安全上下文的兜底
		const ta = document.createElement("textarea");
		ta.value = value;
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		document.execCommand("copy");
		document.body.removeChild(ta);
	}
	copiedIdx = i;
	setTimeout(() => {
		if (copiedIdx === i) copiedIdx = -1;
	}, 1500);
}

/* ============================================================
 * 透视贴合
 * 插画原始尺寸 1672×940。信封书写区（金框内沿）四角实测为
 * TL(672,668) TR(1085,655) BR(1140,838) BL(628,852) —— 下宽上窄的梯形。
 * 已离线求解「470×190 矩形 → 该四边形」的单应矩阵，直接写成
 * matrix3d，让文字层与信封平面完全共透视。
 * ============================================================ */
const LETTER_MATRIX =
	"matrix3d(0.857365, -0.040553, 0, -0.000020, -0.867398, 0.105814, 0, -0.001012, 0, 0, 1, 0, 672, 668, 0, 1)";

/* ============================================================
 * 视口聚焦与缩放
 * 默认构图：桌面端放大 1.55 倍，纵向完整收入人脸与信封；
 * 小屏进一步放大信封保证字迹可读。
 * 锚点（舞台坐标下的画面中心）被钳制在舞台边界内，
 * 保证信封任何视口下都完整入画。
 * ============================================================ */
const STAGE_W = 1672;
const STAGE_H = 940;
const FIG_AR = 1.2; // 画框宽高比（width/height）
const AUTO_ANCHOR = { x: 884, y: 700 }; // 信封中心
const ZOOM_MIN = 1.2;
const ZOOM_MAX = 4;

function clampAnchor(a: { x: number; y: number }, z: number) {
	const hw = STAGE_W / (2 * z);
	const vh = STAGE_W / (FIG_AR * z);
	const cx = hw > STAGE_W / 2 ? STAGE_W / 2 : Math.min(Math.max(a.x, hw), STAGE_W - hw);
	const cy = vh > STAGE_H / 2 ? STAGE_H / 2 : Math.min(Math.max(a.y, vh), STAGE_H - vh);
	return { x: cx, y: cy };
}

let zoomVal = $derived(
	userZoom ??
		(figW >= 700
			? 1.55
			: figW > 0
				? Math.min(ZOOM_MAX, Math.max(1.9, 1150 / figW))
				: 1),
);
let scaleK = $derived(figW > 0 ? (figW / STAGE_W) * zoomVal : 1);
let stageTransform = $derived.by(() => {
	if (!figW) return "none";
	const anchor = clampAnchor(userAnchor ?? AUTO_ANCHOR, zoomVal);
	return `scale(${scaleK}) translate3d(${figW / (2 * scaleK) - anchor.x}px, ${
		figW / (2 * FIG_AR * scaleK) - anchor.y
	}px, 0)`;
});

/** 滚轮缩放：以光标下的画面点为锚点 */
function handleWheel(e: WheelEvent) {
	e.preventDefault();
	if (!figEl || !figW) return;
	const rect = figEl.getBoundingClientRect();
	const sx = e.clientX - rect.left;
	const sy = e.clientY - rect.top;
	const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
	const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomVal * factor));
	if (z1 === zoomVal) return;
	// 光标位置反解为当前缩放下的舞台坐标，作为新缩放的锚点
	const k0 = (figW / STAGE_W) * zoomVal;
	const a0 = clampAnchor(userAnchor ?? AUTO_ANCHOR, zoomVal);
	const px = sx / k0 - (figW / (2 * k0) - a0.x);
	const py = sy / k0 - (figW / (2 * FIG_AR * k0) - a0.y);
	userZoom = z1;
	userAnchor = { x: px, y: py };
}

/** 中键点击还原默认构图（并阻止浏览器的中键自动滚动） */
function handleMiddleReset(e: MouseEvent) {
	if (e.button !== 1) return;
	e.preventDefault();
	userZoom = null;
	userAnchor = null;
}

// wheel 需以非 passive 方式监听才能 preventDefault
$effect(() => {
	const el = figEl;
	if (!el) return;
	el.addEventListener("wheel", handleWheel, { passive: false });
	return () => el.removeEventListener("wheel", handleWheel);
});
</script>

<!-- ==================== 玻璃按钮 ==================== -->
<button class="friends-glass-btn" onclick={open} type="button">
  <span class="friends-glass-btn-icon">
    <svg class="w-5 h-5" style="color:var(--ip-warm)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  </span>
  <span class="friends-glass-btn-title">查看友链信息</span>
  <span class="friends-glass-btn-sub">雨夜来信 · 轻触字迹即可复制</span>
</button>

<!-- ==================== 弹窗（use:portal 挂载到 body 以避免 Swup transform 裁剪） ==================== -->
{#if isOpen && isMounted}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="friends-letter-overlay"
    class:out={closing}
    use:portal
    onclick={onOverlayClick}
    role="dialog"
    aria-modal="true"
    aria-label="友链信笺"
  >
    <!-- 关闭按钮 -->
    <button class="friends-letter-close" aria-label="关闭" onclick={close} type="button">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>

    <div class="friends-letter-scene" class:out={closing} class:in={figW > 0}>
      <div
        class="friends-letter-figure"
        bind:this={figEl}
        bind:clientWidth={figW}
        onmousedown={handleMiddleReset}
        role="img"
        aria-label="雨夜信笺插画，滚轮缩放，中键还原"
      >
        <!-- 悬浮层：入场后信笺连同字迹一起缓慢呼吸浮动 -->
        <div class="friends-letter-float">
          <!-- 舞台：始终 1672×940，通过缩放 + 平移聚焦到信封区域 -->
          <div class="friends-letter-stage" style:transform={stageTransform}>
            <img
              src={letterImg.src}
              alt="雨夜里，少女向你递出一封信笺"
              class="friends-letter-img"
              draggable="false"
            />

            <!-- 字迹层：matrix3d 贴合信封透视 -->
            <div class="friends-letter-ink" style:transform={LETTER_MATRIX}>
              <p class="friends-letter-head">友 链 信 笺</p>
              {#each letterFields as field, i}
                <button
                  class="friends-letter-row"
                  class:copied={copiedIdx === i}
                  style:--stagger={`${0.18 + i * 0.09}s`}
                  onclick={() => copyField(i, field.value)}
                  type="button"
                  title={`点击复制${field.label}`}
                >
                  <span class="friends-letter-row-label">
                    {copiedIdx === i ? "已复制 ✓" : field.label}
                  </span>
                  <span class="friends-letter-row-value">{field.value}</span>
                  <svg class="friends-letter-row-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <p class="friends-letter-hint">轻触信笺字迹即可复制 · 滚轮缩放画面 · 中键还原 · 点击空白处或按 Esc 关闭</p>
    </div>
  </div>
{/if}

<style>
  /* ========== 玻璃按钮（无边框版：直接融进页面背景） ========== */
  .friends-glass-btn {
    position: relative;
    width: 100%;
    padding: 1.25rem 1rem 1.1rem;
    border-radius: 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    transition:
      transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1),
      background 0.25s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    font-family: inherit;
  }

  .friends-glass-btn:active {
    transform: scale(0.95) translateY(2px);
    transition: transform 0.05s ease-out;
    background: rgba(0, 0, 0, 0.04);
  }

  .friends-glass-btn:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  html.dark .friends-glass-btn:active {
    background: rgba(255, 255, 255, 0.04);
  }

  html.dark .friends-glass-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .friends-glass-btn-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.18);
    transition: background 0.25s ease, transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .friends-glass-btn:active .friends-glass-btn-icon {
    transform: scale(0.9);
    transition: transform 0.05s ease-out;
  }

  html.dark .friends-glass-btn-icon {
    background: rgba(255, 255, 255, 0.06);
  }

  .friends-glass-btn-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--ip-ink);
    line-height: 1.2;
  }

  .friends-glass-btn-sub {
    font-size: 0.7rem;
    color: var(--ip-ink-faint);
    line-height: 1.2;
  }

  /* ========== 遮罩 ========== */
  .friends-letter-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(8, 10, 20, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .friends-letter-overlay,
  .friends-letter-overlay.in {
    animation: letterOverlayIn 0.35s ease-out both;
  }

  .friends-letter-overlay.out {
    animation: letterOverlayOut 0.28s ease-in both;
  }

  @keyframes letterOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes letterOverlayOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  /* ========== 关闭按钮 ========== */
  .friends-letter-close {
    position: absolute;
    top: 1.1rem;
    right: 1.1rem;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.14);
    cursor: pointer;
    color: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    z-index: 10;
  }

  .friends-letter-close:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    transform: rotate(90deg);
  }

  /* ========== 场景容器 ========== */
  .friends-letter-scene {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    min-width: 0;
    /* 测量完成（.in）前隐藏，避免首帧以未聚焦的裁切闪现 */
    opacity: 0;
  }

  /* 入场：纯 ease-out 浮现（上移 + 淡入 + 微缩），无任何回弹 */
  .friends-letter-scene.in {
    animation: letterSceneIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .friends-letter-scene.out {
    animation: letterSceneOut 0.28s ease-in both;
  }

  @keyframes letterSceneIn {
    from {
      opacity: 0;
      transform: translateY(26px) scale(0.965);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes letterSceneOut {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateY(14px) scale(0.985);
    }
  }

  /* ========== 画框：宽高比 6:5，同时受视口宽高约束 ========== */
  .friends-letter-figure {
    position: relative;
    width: min(92vw, 760px, calc(72vh * 1.2));
    aspect-ratio: 6 / 5;
    overflow: hidden;
    border-radius: 1.1rem;
    background: #0b1020;
    box-shadow:
      0 30px 80px rgba(0, 0, 0, 0.45),
      0 10px 30px rgba(0, 0, 0, 0.3);
    user-select: none;
    cursor: zoom-in;
  }

  /* 缓慢呼吸浮动（非弹跳，7s 交替） */
  .friends-letter-float {
    position: absolute;
    inset: 0;
    animation: letterFloat 7s ease-in-out infinite alternate;
  }

  @keyframes letterFloat {
    from { transform: translateY(0); }
    to   { transform: translateY(-6px); }
  }

  /* ========== 舞台：固定 1672×940，缩放平移聚焦 ========== */
  .friends-letter-stage {
    position: absolute;
    top: 0;
    left: 0;
    width: 1672px;
    height: 940px;
    transform-origin: 0 0;
  }

  .friends-letter-img {
    position: absolute;
    inset: 0;
    width: 1672px;
    height: 940px;
    object-fit: cover;
    pointer-events: none;
  }

  /* ========== 字迹层：matrix3d 贴合信封书写区透视 ========== */
  .friends-letter-ink {
    position: absolute;
    top: 0;
    left: 0;
    width: 470px;
    height: 190px;
    transform-origin: 0 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 10px 30px 12px;
    font-family: "Kaiti SC", "STKaiti", KaiTi, "DFKai-SB", "Noto Serif SC", serif;
    color: #43382d;
  }

  .friends-letter-head {
    margin: 0 0 7px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.42em;
    text-indent: 0.42em;
    text-align: center;
    color: rgba(112, 86, 55, 0.85);
    animation: inkIn 0.7s ease-out 0.1s both;
  }

  .friends-letter-row {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 9px;
    width: 100%;
    padding: 3.5px 22px 3.5px 8px;
    border: none;
    border-radius: 7px;
    background: transparent;
    cursor: copy;
    text-align: left;
    font-family: inherit;
    animation: inkIn 0.7s ease-out var(--stagger) both;
    transition: background 0.18s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .friends-letter-row:hover {
    background: rgba(112, 86, 55, 0.09);
  }

  .friends-letter-row.copied {
    background: rgba(112, 86, 55, 0.14);
  }

  .friends-letter-row-label {
    flex-shrink: 0;
    font-size: 11px;
    letter-spacing: 0.14em;
    font-weight: 600;
    color: #8a6a1e;
    min-width: 62px;
  }

  .friends-letter-row.copied .friends-letter-row-label {
    color: #6d8b57;
  }

  .friends-letter-row-value {
    flex: 1;
    min-width: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.45;
    color: #43382d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .friends-letter-row-icon {
    position: absolute;
    right: 4px;
    top: 50%;
    width: 12px;
    height: 12px;
    transform: translateY(-50%);
    color: rgba(112, 86, 55, 0.7);
    opacity: 0;
    transition: opacity 0.18s ease;
  }

  .friends-letter-row:hover .friends-letter-row-icon {
    opacity: 0.6;
  }

  @keyframes inkIn {
    from {
      opacity: 0;
      filter: blur(1.5px);
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      filter: blur(0);
      transform: translateY(0);
    }
  }

  /* ========== 提示 ========== */
  .friends-letter-hint {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.62);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    animation: letterOverlayIn 0.5s ease-out 0.45s both;
  }

  @media (prefers-reduced-motion: reduce) {
    .friends-letter-float,
    .friends-letter-ink,
    .friends-letter-head,
    .friends-letter-row,
    .friends-letter-hint {
      animation: none;
    }
  }
</style>
