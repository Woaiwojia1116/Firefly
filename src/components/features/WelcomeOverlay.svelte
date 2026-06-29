<script lang="ts">
import { onMount } from "svelte";

interface Props {
	avatarSrc: string;
}

let { avatarSrc }: Props = $props();

let show = $state(true);
let leaving = $state(false);

const signature = "I'm ysdy Ciallo～ (∠・ω<)⌒☆";
const welcomeMsg = "欢迎来到我的小站 ✨";

let rafId: number | null = null;
let mx = 50,
	my = 50;
let cx = 50,
	cy = 50;

function handlePointerMove(e: MouseEvent | TouchEvent) {
	let px: number, py: number;
	if ("touches" in e && e.touches.length > 0) {
		px = e.touches[0].clientX;
		py = e.touches[0].clientY;
	} else if ("clientX" in e) {
		px = e.clientX;
		py = e.clientY;
	} else return;

	mx = (px / window.innerWidth) * 100;
	my = (py / window.innerHeight) * 100;
}

function tickSpotlight() {
	cx += (mx - cx) * 0.08;
	cy += (my - cy) * 0.08;

	const overlay = document.querySelector(
		".welcome-overlay",
	) as HTMLElement | null;
	if (overlay) {
		overlay.style.setProperty("--spotlight-x", `${cx}%`);
		overlay.style.setProperty("--spotlight-y", `${cy}%`);
	}

	rafId = requestAnimationFrame(tickSpotlight);
}

function dismiss() {
	document.documentElement.classList.remove("welcome-overlay-active");
}

function cleanup() {
	window.removeEventListener("mousemove", handlePointerMove);
	window.removeEventListener("touchmove", handlePointerMove);
	if (rafId !== null) cancelAnimationFrame(rafId);
	rafId = null;
}

onMount(() => {
	const STORAGE_KEY = "firefly-welcome-shown";
	const isTimeline = window.location.pathname.includes("/timeline");

	// 移除 fallback 遮罩层，Svelte 组件已接管
	const fallback = document.getElementById("welcome-overlay-fallback");
	if (fallback) fallback.remove();

	// 如果已标记过（本次会话内已展示过动画，或曾停留在时间轴页面），直接跳过
	if (sessionStorage.getItem(STORAGE_KEY) === "1") {
		show = false;
		dismiss();
		return;
	}

	// 时间轴页面：跳过动画并标记，这样从时间轴跳转到其他页面时全页加载也不会重播
	if (isTimeline) {
		sessionStorage.setItem(STORAGE_KEY, "1");
		show = false;
		dismiss();
		return;
	}

	// 标记为已展示，防止后续全页导航重播
	sessionStorage.setItem(STORAGE_KEY, "1");

	window.addEventListener("mousemove", handlePointerMove);
	window.addEventListener("touchmove", handlePointerMove, { passive: true });
	rafId = requestAnimationFrame(tickSpotlight);

	setTimeout(() => {
		leaving = true;
		setTimeout(() => {
			show = false;
			cleanup();
			dismiss();
		}, 400);
	}, 2200);
});
</script>

{#if show}
<div
  class="welcome-overlay"
  class:fade-out={leaving}
>
  <!-- 星云背景 -->
  <div class="nebula nebula-1" />
  <div class="nebula nebula-2" />
  <div class="nebula nebula-3" />

  <!-- 鼠标聚光灯 -->
  <div class="spotlight" />

  <!-- 几何装饰：四角线条 -->
  <div class="corner corner-tl" />
  <div class="corner corner-tr" />
  <div class="corner corner-bl" />
  <div class="corner corner-br" />

  <!-- 水波纹 -->
  <div class="ripple-container">
    <div class="ripple-ring" style="animation-delay: 0s" />
    <div class="ripple-ring" style="animation-delay: 0.6s" />
    <div class="ripple-ring" style="animation-delay: 1.2s" />
    <div class="ripple-ring" style="animation-delay: 1.8s" />
    <div class="ripple-ring" style="animation-delay: 2.4s" />
  </div>

  <!-- 粒子光点 -->
  <div class="particle" style="left:15%;top:25%;width:4px;height:4px;animation-delay:0s" />
  <div class="particle" style="left:75%;top:20%;width:3px;height:3px;animation-delay:0.4s" />
  <div class="particle" style="left:50%;top:12%;width:5px;height:5px;animation-delay:0.8s" />
  <div class="particle" style="left:25%;top:70%;width:3px;height:3px;animation-delay:1.2s" />
  <div class="particle" style="left:80%;top:65%;width:4px;height:4px;animation-delay:0.2s" />
  <div class="particle" style="left:10%;top:60%;width:3px;height:3px;animation-delay:0.6s" />
  <div class="particle" style="left:65%;top:78%;width:5px;height:5px;animation-delay:1.0s" />
  <div class="particle" style="left:40%;top:82%;width:3px;height:3px;animation-delay:1.4s" />

  <!-- 内容层 -->
  <div class="content">
    <div class="avatar-wrapper">
      <div class="avatar-glow">
        <img src={avatarSrc} alt="avatar" class="avatar-img" />
      </div>
    </div>

    <div class="divider-line" />

    <div class="site-title">YSDY</div>
    <div class="site-subtitle">ysdy's Blog</div>
    <div class="signature">{signature}</div>
    <div class="welcome-msg">{welcomeMsg}</div>
  </div>
</div>
{/if}

<style>
  .welcome-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(10, 10, 12, 0.94);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    pointer-events: auto;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .welcome-overlay.fade-out {
    opacity: 0;
    transition: opacity 0.4s ease-in;
    pointer-events: none;
  }

  /* ===== 星云背景 ===== */
  .nebula {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    pointer-events: none;
    will-change: transform;
  }
  .nebula-1 {
    width: 650px;
    height: 650px;
    top: -15%;
    left: -10%;
    background: var(--primary, oklch(0.70 0.14 165));
    opacity: 0.15;
    animation: nebula-drift-1 25s ease-in-out infinite alternate;
  }
  .nebula-2 {
    width: 500px;
    height: 500px;
    bottom: -12%;
    right: -10%;
    background: oklch(0.6 0.12 195);
    opacity: 0.12;
    animation: nebula-drift-2 30s ease-in-out infinite alternate;
  }
  .nebula-3 {
    width: 400px;
    height: 400px;
    top: 50%;
    left: 50%;
    background: oklch(0.65 0.1 145);
    opacity: 0.1;
    animation: nebula-drift-3 20s ease-in-out infinite alternate;
  }

  /* ===== 鼠标聚光灯 ===== */
  .spotlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    will-change: transform;
    transform: translateZ(0);
    background: radial-gradient(
      600px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%),
      color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 18%, transparent) 0%,
      color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 6%, transparent) 40%,
      transparent 70%
    );
    opacity: 0;
    animation: fade-in 1s ease-out 0.2s forwards;
  }

  /* ===== 四角装饰线 ===== */
  .corner {
    position: absolute;
    width: 40px;
    height: 40px;
    pointer-events: none;
    opacity: 0;
    animation: fade-in 0.5s ease-out both;
    animation-delay: 0.1s;
    border-color: var(--primary, oklch(0.70 0.14 165));
  }
  .corner-tl {
    top: 2rem;
    left: 2rem;
    border-top: 1px solid;
    border-left: 1px solid;
  }
  .corner-tr {
    top: 2rem;
    right: 2rem;
    border-top: 1px solid;
    border-right: 1px solid;
  }
  .corner-bl {
    bottom: 2rem;
    left: 2rem;
    border-bottom: 1px solid;
    border-left: 1px solid;
  }
  .corner-br {
    bottom: 2rem;
    right: 2rem;
    border-bottom: 1px solid;
    border-right: 1px solid;
  }

  /* ===== 水波纹 ===== */
  .ripple-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .ripple-ring {
    position: absolute;
    width: min(50vw, 380px);
    height: min(50vw, 380px);
    border: 1.5px solid var(--primary, oklch(0.70 0.14 165));
    border-radius: 50%;
    opacity: 0;
    box-shadow: 0 0 12px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 40%, transparent),
      inset 0 0 12px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 20%, transparent);
    animation: ripple 3s ease-out infinite;
  }

  /* ===== 粒子光点 ===== */
  .particle {
    position: absolute;
    border-radius: 50%;
    background: var(--primary, oklch(0.70 0.14 165));
    pointer-events: none;
    opacity: 0;
    filter: blur(1px);
    animation: float-particle 4s ease-in-out infinite;
  }

  /* ===== 内容层 ===== */
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    z-index: 1;
    padding: 2rem;
    text-align: center;
  }

  /* ===== 头像 + 流光 ===== */
  .avatar-wrapper {
    position: relative;
    overflow: hidden;
    border-radius: 50%;
    opacity: 0;
    animation: fade-in-scale 0.4s ease-out both;
    animation-delay: 0.1s;
  }

  .avatar-wrapper::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255, 255, 255, 0.5) 47%,
      rgba(255, 255, 255, 0.75) 50%,
      rgba(255, 255, 255, 0.5) 53%,
      transparent 70%
    );
    pointer-events: none;
    animation: shimmer 3s ease-in-out infinite;
    animation-delay: 0.8s;
  }

  .avatar-glow {
    border-radius: 50%;
    padding: 3px;
    display: inline-flex;
    box-shadow: 0 0 0 2px var(--primary, oklch(0.70 0.14 165)),
      0 0 25px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 60%, transparent);
    animation: glow-pulse 3s ease-in-out infinite 0.5s;
  }

  .avatar-img {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  @media (min-width: 768px) {
    .avatar-img {
      width: 6rem;
      height: 6rem;
    }
  }

  /* ===== 分隔线 ===== */
  .divider-line {
    width: 80px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--primary, oklch(0.70 0.14 165)),
      transparent
    );
    opacity: 0;
    animation: scale-x 0.4s ease-out both;
    animation-delay: 0.3s;
    margin: 0.25rem 0;
  }

  /* ===== 站点名 + 流光 ===== */
  .site-title {
    position: relative;
    font-family: 'Zhi Mang Xing', cursive;
    font-size: clamp(2.8rem, 12vw, 5rem);
    font-weight: 700;
    letter-spacing: 0.15em;
    color: white;
    opacity: 0;
    animation: fade-in-up 0.5s ease-out both, text-glow 2s ease-in-out infinite 0.5s;
    animation-delay: 0.3s;
    line-height: 1.1;
  }

  .site-title::after {
    content: "";
    position: absolute;
    inset: -20% -30%;
    background: linear-gradient(
      105deg,
      transparent 35%,
      rgba(255, 255, 255, 0.1) 47%,
      rgba(255, 255, 255, 0.18) 50%,
      rgba(255, 255, 255, 0.1) 53%,
      transparent 65%
    );
    pointer-events: none;
    animation: shimmer 4s ease-in-out infinite;
    animation-delay: 1.2s;
  }

  /* ===== 副标题 ===== */
  .site-subtitle {
    font-size: clamp(1rem, 3vw, 1.25rem);
    color: rgba(255, 255, 255, 0.75);
    opacity: 0;
    animation: fade-in 0.4s ease-out both;
    animation-delay: 0.5s;
    letter-spacing: 0.05em;
  }

  /* ===== 签名 ===== */
  .signature {
    font-size: clamp(0.8rem, 2vw, 0.95rem);
    color: rgba(255, 255, 255, 0.5);
    font-family: ui-monospace, "JetBrains Mono", monospace;
    opacity: 0;
    animation: fade-in 0.4s ease-out both;
    animation-delay: 0.65s;
  }

  /* ===== 欢迎语 ===== */
  .welcome-msg {
    font-size: clamp(0.75rem, 1.8vw, 0.85rem);
    color: rgba(255, 255, 255, 0.4);
    opacity: 0;
    animation: fade-in 0.4s ease-out both;
    animation-delay: 0.75s;
    margin-top: 0.25rem;
  }

  /* ========= Keyframes ========= */

  @keyframes shimmer {
    0% {
      transform: translateX(-100%) skewX(-15deg);
    }
    25% {
      transform: translateX(200%) skewX(-15deg);
    }
    100% {
      transform: translateX(200%) skewX(-15deg);
    }
  }

  @keyframes nebula-drift-1 {
    0% {
      transform: translate(0, 0) scale(1);
    }
    100% {
      transform: translate(12%, 8%) scale(1.15);
    }
  }

  @keyframes nebula-drift-2 {
    0% {
      transform: translate(0, 0) scale(1);
    }
    100% {
      transform: translate(-8%, -12%) scale(1.2);
    }
  }

  @keyframes nebula-drift-3 {
    0% {
      transform: translate(0, 0) scale(1);
    }
    100% {
      transform: translate(10%, -6%) scale(1.1);
    }
  }

  @keyframes ripple {
    0% {
      transform: scale(0.3);
      opacity: 0.45;
    }
    100% {
      transform: scale(1.5);
      opacity: 0;
    }
  }

  @keyframes float-particle {
    0% {
      transform: translateY(0) translateX(0);
      opacity: 0;
    }
    15% {
      opacity: 0.7;
    }
    50% {
      transform: translateY(-30px) translateX(10px);
      opacity: 0.9;
    }
    85% {
      opacity: 0.7;
    }
    100% {
      transform: translateY(-60px) translateX(-5px);
      opacity: 0;
    }
  }

  @keyframes glow-pulse {
    0% {
      box-shadow: 0 0 0 2px var(--primary, oklch(0.70 0.14 165)),
        0 0 25px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 60%, transparent);
    }
    50% {
      box-shadow: 0 0 0 3px var(--primary, oklch(0.70 0.14 165)),
        0 0 45px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 80%, transparent);
    }
    100% {
      box-shadow: 0 0 0 2px var(--primary, oklch(0.70 0.14 165)),
        0 0 25px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 60%, transparent);
    }
  }

  @keyframes text-glow {
    0% {
      text-shadow: 0 0 25px var(--primary, oklch(0.70 0.14 165)),
        0 0 50px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 50%, transparent);
    }
    50% {
      text-shadow: 0 0 40px var(--primary, oklch(0.70 0.14 165)),
        0 0 80px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 60%, transparent);
    }
    100% {
      text-shadow: 0 0 25px var(--primary, oklch(0.70 0.14 165)),
        0 0 50px color-mix(in srgb, var(--primary, oklch(0.70 0.14 165)) 50%, transparent);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fade-in-scale {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes scale-x {
    from {
      opacity: 0;
      transform: scaleX(0);
    }
    to {
      opacity: 1;
      transform: scaleX(1);
    }
  }
</style>
