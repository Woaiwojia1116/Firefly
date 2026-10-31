<script lang="ts">
/**
 * 友链申请模板 —— 整段复制。
 * 模板内容由 MDX 以 lines 传入，展示与复制共用同一份数据，
 * 保证换行、空格与页面所见完全一致。
 */

import { copyText, selectText } from "../../utils/clipboard";

interface Props {
	lines: string[];
}

let { lines }: Props = $props();

const template = $derived(lines.join("\n"));

let state = $state<"idle" | "ok" | "error">("idle");
let preEl: HTMLPreElement | undefined = $state();
let timer: ReturnType<typeof setTimeout> | undefined;

$effect(() => {
	return () => {
		if (timer) clearTimeout(timer);
	};
});

async function handleCopy() {
	let ok = false;
	try {
		ok = await copyText(template);
	} catch {
		ok = false;
	}

	state = ok ? "ok" : "error";
	if (!ok) selectText(preEl);

	if (timer) clearTimeout(timer);
	timer = setTimeout(
		() => {
			state = "idle";
		},
		ok ? 2000 : 3000,
	);
}
</script>

<div class="friends-template">
  <pre class="friends-template__text" bind:this={preEl}>{template}</pre>

  <div class="friends-template__actions">
    <button
      class="friends-template__copy"
      class:is-error={state === "error"}
      type="button"
      onclick={handleCopy}
      aria-label="复制整段友链申请模板"
    >
      {#if state === "ok"}
        <svg class="friends-template__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
      {:else if state === "error"}
        <svg class="friends-template__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86l-8.2 14.2A2 2 0 003.83 21h16.34a2 2 0 001.74-2.94l-8.2-14.2a2 2 0 00-3.42 0z"/>
        </svg>
      {:else}
        <svg class="friends-template__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      {/if}
      <span>复制整段模板</span>
    </button>

    <span
      class="friends-template__status"
      class:is-ok={state === "ok"}
      class:is-error={state === "error"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {state === "ok" ? "已复制" : state === "error" ? "复制失败，请手动复制" : ""}
    </span>
  </div>
</div>

<style>
  .friends-template {
    border-radius: var(--ip-radius-sm);
    border: 1px solid var(--ip-line-soft);
    background: var(--ip-surface-2);
    padding: 1rem 1rem 0.75rem;
    font-family: var(--ip-mono);
    color: var(--ip-ink-soft);
  }

  .friends-template__text {
    margin: 0;
    font-family: inherit;
    font-size: 0.7rem;
    line-height: 1.85;
    white-space: pre;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    user-select: text;
    -webkit-user-select: text;
  }

  .friends-template__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin-top: 0.8rem;
    padding-top: 0.7rem;
    border-top: 1px dashed var(--ip-line-soft);
  }

  .friends-template__copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--ip-line);
    border-radius: 0.5rem;
    background: var(--ip-surface);
    color: var(--ip-warm);
    font-family: inherit;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      background 0.2s ease;
  }

  .friends-template__copy:hover {
    color: var(--ip-ink);
    border-color: var(--ip-warm);
  }

  .friends-template__copy:active {
    transform: translateY(1px);
  }

  .friends-template__copy:focus-visible {
    outline: 2px solid var(--ip-warm);
    outline-offset: 2px;
  }

  .friends-template__copy.is-error {
    border-color: var(--ip-warm);
  }

  .friends-template__icon {
    width: 0.95rem;
    height: 0.95rem;
    flex-shrink: 0;
  }

  .friends-template__status {
    min-height: 1.2em;
    margin-left: auto;
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    color: var(--ip-ink-faint);
  }

  .friends-template__status.is-ok {
    color: var(--ip-ink);
  }

  .friends-template__status.is-error {
    color: var(--ip-warm);
  }

  @media (max-width: 480px) {
    .friends-template__copy {
      width: 100%;
    }

    .friends-template__status {
      margin-left: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .friends-template__copy {
      transition: none;
    }
  }
</style>
