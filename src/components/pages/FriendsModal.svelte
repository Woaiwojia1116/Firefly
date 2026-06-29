<script lang="ts">
/**
 * 友链页面交互组件
 * - 玻璃按钮 → 弹窗（站点信息 / 注意事项 / 站点信息列表）
 * 弹窗通过 Svelte action (use:portal) 挂载到 body，避免被 Swup 容器的 transform 裁剪
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

interface Site {
	name: string;
	desc: string;
	url: string;
	avatar: string;
	email: string;
}

interface Note {
	title: string;
	content: string;
}

interface Props {
	site: Site;
	notes: Note[];
}

let { site, notes }: Props = $props();

let isOpen = $state(false);
let panelEl: HTMLDivElement | undefined = $state();
let isMounted = $state(false);

onMount(() => {
	isMounted = true;
});

const copyFields = [
	{ label: "站点名称", value: site.name },
	{ label: "站点描述", value: site.desc },
	{ label: "站点链接", value: site.url },
	{
		label: "头像链接",
		value:
			"https://i.stardots.io/366046882645/StarDots-2026061016244768517.webp",
	},
];

function open() {
	isOpen = true;
	document.body.style.overflow = "hidden";
}

function close() {
	document.body.style.overflow = "";
	isOpen = false;
}

// 面板挂载到 body 后播放弹簧入场动画
$effect(() => {
	const el = panelEl;
	if (!el) return;
	el.animate(
		[
			{ transform: "scale(0.8)", opacity: "0" },
			{ transform: "scale(1.05)", opacity: "1", offset: 0.55 },
			{ transform: "scale(0.97)", opacity: "1", offset: 0.75 },
			{ transform: "scale(1.01)", opacity: "1", offset: 0.9 },
			{ transform: "scale(1)", opacity: "1", offset: 1 },
		],
		{
			duration: 400,
			easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
			fill: "forwards",
		},
	);
});

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

function copyValue(e: MouseEvent, value: string) {
	navigator.clipboard.writeText(value);
	const btn = e.currentTarget as HTMLButtonElement;
	const [copyIcon, checkIcon] = btn.querySelectorAll("svg");
	copyIcon.style.display = "none";
	checkIcon.style.display = "";
	setTimeout(() => {
		copyIcon.style.display = "";
		checkIcon.style.display = "none";
	}, 1500);
}
</script>

<!-- ==================== 玻璃按钮 ==================== -->
<button class="friends-glass-btn" onclick={open} type="button">
  <span class="friends-glass-btn-icon">
    <svg class="w-5 h-5" style="color:#ffb6c1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  </span>
  <span class="friends-glass-btn-title">查看友链信息</span>
  <span class="friends-glass-btn-sub">站点信息 · 注意事项 · 一键复制</span>
</button>

<!-- ==================== 弹窗（use:portal 挂载到 body 以避免 Swup transform 裁剪） ==================== -->
{#if isOpen && isMounted}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="friends-modal-overlay"
    use:portal
    onclick={onOverlayClick}
    role="dialog"
    aria-modal="true"
  >
      <div
        bind:this={panelEl}
        class="friends-modal-panel"
        style="opacity:0;transform:scale(0.8)"
        onclick={(e: MouseEvent) => e.stopPropagation()}
      >
        <!-- 关闭按钮 -->
        <button class="friends-modal-close" aria-label="关闭" onclick={close} type="button">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <!-- ====== 区块 1: 站点信息 ====== -->
        <section class="friends-modal-section">
          <h4 class="friends-modal-section-title">
            <svg class="w-4.5 h-4.5" style="color:#ffb6c1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            站点信息
          </h4>
          <div class="flex items-center gap-4 mb-4">
            <div class="relative shrink-0">
              <div class="w-14 h-14 rounded-xl overflow-hidden ring-2 ring-(--primary)/20">
                <img src="https://i.stardots.io/366046882645/StarDots-2026061016244768517.webp" alt={site.name} class="w-full h-full object-cover" />
              </div>
              <div class="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-(--primary) flex items-center justify-center shadow">
                <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </div>
            </div>
            <div class="min-w-0">
              <p class="font-bold text-base text-neutral-900 dark:text-neutral-100">{site.name}</p>
              <p class="text-xs mt-0.5 text-(--primary) truncate">{site.desc}</p>
            </div>
          </div>
          <div class="space-y-2.5">
            <div class="rounded-lg bg-black/5 dark:bg-white/5 px-3.5 py-2.5">
              <p class="text-[0.65rem] text-neutral-200 dark:text-neutral-700 mb-0.5">站点链接</p>
              <a href={site.url} target="_blank" rel="noopener" class="text-sm font-medium text-black dark:text-white hover:underline break-all">{site.url}</a>
            </div>
            <div class="rounded-lg bg-black/5 dark:bg-white/5 px-3.5 py-2.5">
              <p class="text-[0.65rem] text-neutral-200 dark:text-neutral-700 mb-0.5">联系邮箱</p>
              <p class="text-sm font-medium text-neutral-800 dark:text-neutral-200 break-all">{site.email}</p>
            </div>
          </div>
        </section>

        <div class="friends-modal-divider"></div>

        <!-- ====== 区块 2: 注意事项 ====== -->
        <section class="friends-modal-section">
          <h4 class="friends-modal-section-title">
            <svg class="w-4.5 h-4.5" style="color:#ffb6c1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            注意事项
          </h4>
          <div class="space-y-2.5 text-sm text-neutral-600 dark:text-neutral-400">
            {#each notes as note}
              <div class="flex items-baseline gap-2.5">
                <span class="w-1.5 h-1.5 rounded-full bg-(--primary) shrink-0 mt-[0.4rem]"></span>
                <p><strong class="text-neutral-800 dark:text-neutral-200">{note.title}</strong>：{note.content}</p>
              </div>
            {/each}
          </div>
        </section>

        <div class="friends-modal-divider"></div>

        <!-- ====== 区块 3: 站点信息列表 ====== -->
        <section class="friends-modal-section">
          <h4 class="friends-modal-section-title">
            <svg class="w-4.5 h-4.5" style="color:#ffb6c1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            站点信息列表
          </h4>
          <div class="space-y-2">
            {#each copyFields as field}
              <div class="flex items-center justify-between gap-2 rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2.5">
                <div class="min-w-0">
                  <p class="text-[0.65rem] text-neutral-200 dark:text-neutral-700 mb-0.5">{field.label}</p>
                  <p class="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">{field.value}</p>
                </div>
                <button
                  onclick={(e: MouseEvent) => copyValue(e, field.value)}
                  class="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-black/10 dark:bg-white/10 text-(--btn-content) hover:opacity-80 transition-opacity cursor-pointer"
                  type="button"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  <svg class="w-3.5 h-3.5 text-green-500" style="display:none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        </section>
      </div>
    </div>
{/if}

<style>
  /* ========== 玻璃按钮 ========== */
  .friends-glass-btn {
    position: relative;
    width: 100%;
    padding: 1.25rem 1rem 1.1rem;
    border-radius: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.10);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    transition:
      transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.38s cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 0.25s ease,
      background 0.25s ease;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.04);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    font-family: inherit;
  }

  .friends-glass-btn:active {
    transform: scale(0.93) translateY(3px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 0px 1px rgba(0, 0, 0, 0.02);
    transition:
      transform 0.05s ease-out,
      box-shadow 0.05s ease-out;
    background: rgba(255, 255, 255, 0.06);
  }

  .friends-glass-btn:hover {
    border-color: rgba(255, 255, 255, 0.45);
    box-shadow: 0 7px 26px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.16);
  }

  html.dark .friends-glass-btn {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  html.dark .friends-glass-btn:active {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 0px 1px rgba(0, 0, 0, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  html.dark .friends-glass-btn:hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 0 7px 26px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2);
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
    color: #1a1a1a;
    line-height: 1.2;
  }

  :global(html.dark) .friends-glass-btn-title {
    color: #fff;
  }

  .friends-glass-btn-sub {
    font-size: 0.7rem;
    color: #1a1a1a;
    line-height: 1.2;
  }

  :global(html.dark) .friends-glass-btn-sub {
    color: #fff;
  }

  /* ========== 弹窗遮罩 ========== */
  @keyframes friendsOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .friends-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: friendsOverlayIn 0.25s ease-out;
  }

  /* ========== 弹窗面板 ========== */
  .friends-modal-panel {
    position: relative;
    width: 100%;
    max-width: 460px;
    max-height: 85vh;
    overflow-y: auto;
    border-radius: 1.25rem;
    background: rgba(142, 172, 196, 0.85);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(255, 255, 255, 0.45);
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.12), 0 8px 20px rgba(0, 0, 0, 0.06);
    padding: 1.75rem;
  }

  :root.dark .friends-modal-panel {
    background: rgba(102, 183, 179, 0.72);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45), 0 8px 20px rgba(0, 0, 0, 0.25);
  }

  /* ========== 关闭按钮 ========== */
  .friends-modal-close {
    position: absolute;
    top: 0.875rem;
    right: 0.875rem;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    cursor: pointer;
    color: #888;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    z-index: 10;
  }

  .friends-modal-close:hover {
    background: rgba(0, 0, 0, 0.12);
    color: #333;
  }

  html.dark .friends-modal-close {
    background: rgba(255, 255, 255, 0.08);
    color: #999;
  }

  html.dark .friends-modal-close:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #eee;
  }

  /* ========== 区块标题 ========== */
  .friends-modal-section-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #ffb6c1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    margin-top: 0;
  }

  html.dark .friends-modal-section-title {
    color: #ffb6c1;
  }

  .friends-modal-section {
    padding: 0;
  }

  .friends-modal-divider {
    height: 1px;
    background: rgba(255, 182, 193, 0.15);
    margin: 1.25rem 0;
  }

  html.dark .friends-modal-divider {
    background: rgba(255, 182, 193, 0.1);
  }

  /* ========== 滚动条 ========== */
  .friends-modal-panel::-webkit-scrollbar {
    width: 4px;
  }

  .friends-modal-panel::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
    border-radius: 2px;
  }

  html.dark .friends-modal-panel::-webkit-scrollbar-thumb {
    background: rgba(128, 195, 166, 0.1);
  }

</style>
