<script lang="ts">
/**
 * 动态流孤岛（/moments/）
 * ---------------------------------------------------------------------------
 * 数据来自 Twikoo 隐藏路径 /moments-master 的博主动态（详见
 * src/utils/twikoo-moments.ts），页面不再挂读者评论区。
 *
 * 写动态是独立弹窗，直接调 COMMENT_SUBMIT，不共用评论区；入口对读者隐藏：
 *   1. URL 锚点 #write（博主可加书签）
 *   2. 双击页头 ⚡ 图标
 * 弹窗里填的邮箱需与 commentConfig.masterTag.email 一致，发布的内容才会
 * 通过「昵称 + 邮箱哈希」校验进入动态流。
 * 按 AdvancedSearch.svelte 的先例使用 legacy Svelte 语法 + client:load。
 */
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import {
	fetchMoments,
	formatRelativeTime,
	likeMoment,
	submitMoment,
	type MomentItem,
	type MomentsAuthorFilter,
} from "@/utils/twikoo-moments";

// --- Props（由 moments.astro 在服务端注入，避免把 config 打进 bundle） ---
export let envId: string;
export let masterNick: string;
export let mailHashes: string[] = [];
export let authorName = "";
export let authorAvatar = "";
export let lang = "zh_CN";

const author: MomentsAuthorFilter = { masterNick, mailHashes };

/** 弹窗心情候选 */
const MOOD_EMOJIS = [
	"🌧️",
	"☀️",
	"🌙",
	"🎧",
	"📚",
	"💻",
	"🎮",
	"🍵",
	"🍜",
	"😴",
	"🚴",
	"✨",
];

const LIKED_KEY = "firefly:moments:liked";
const MAIL_KEY = "firefly:moments:mail";

// --- State ---
let moments: MomentItem[] = [];
let loading = true;
let loadingMore = false;
let more = false;
let error = false;
let cursor: number | undefined;
let likedIds = new Set<string>();

// --- 写动态弹窗 ---
let composerOpen = false;
let mailInput = "";
let moodInput = "";
let textInput = "";
let imageInput = "";
let publishing = false;
let composerError = "";

// --- 轻量灯箱 ---
let lightbox: { images: string[]; index: number } | null = null;

// --- 数据加载 ---
async function load(reset: boolean) {
	if (reset) {
		loading = true;
		cursor = undefined;
	} else {
		loadingMore = true;
	}
	error = false;
	try {
		const res = await fetchMoments({
			envId,
			author,
			before: reset ? undefined : cursor,
		});
		moments = reset ? res.moments : [...moments, ...res.moments];
		more = res.more;
		cursor = res.oldestCreated;
	} catch (e) {
		console.error("[Moments] 拉取失败:", e);
		if (reset) moments = [];
		error = true;
	} finally {
		loading = false;
		loadingMore = false;
	}
}

function refresh() {
	if (!loading && !loadingMore) void load(true);
}

// --- 点赞（只允许赞一次，重复点击忽略，避免刷计数） ---
function toggleLike(m: MomentItem) {
	if (likedIds.has(m.id)) return;
	const next = new Set(likedIds);
	next.add(m.id);
	likedIds = next;
	m.like += 1;
	moments = moments;
	try {
		localStorage.setItem(LIKED_KEY, JSON.stringify([...next]));
	} catch {
		/* 隐私模式下 localStorage 可能不可用，忽略 */
	}
	likeMoment(envId, m.id).catch((e) => console.error("[Moments] 点赞失败:", e));
}

// --- 写动态弹窗 ---
function openComposer() {
	composerError = "";
	composerOpen = true;
}

function closeComposer() {
	composerOpen = false;
	// 清掉 #write 锚点，否则下次 hash 变化不会重新触发 hashchange
	if (window.location.hash === "#write") {
		window.history.replaceState(
			null,
			"",
			window.location.pathname + window.location.search,
		);
	}
}

async function publish() {
	if (publishing || !textInput.trim() || !mailInput.trim()) return;
	publishing = true;
	composerError = "";
	try {
		await submitMoment({
			envId,
			nick: masterNick,
			mail: mailInput.trim(),
			text: textInput,
			mood: moodInput,
			imageUrl: imageInput,
		});
		try {
			localStorage.setItem(MAIL_KEY, mailInput.trim());
		} catch {
			/* 忽略存储失败 */
		}
		textInput = "";
		imageInput = "";
		moodInput = "";
		closeComposer();
		await load(true);
	} catch (e) {
		composerError =
			e instanceof Error ? e.message : "发布失败，请检查网络后重试";
	} finally {
		publishing = false;
	}
}

// --- 灯箱 ---
function openLightbox(images: string[], index: number) {
	lightbox = { images, index };
}

function stepLightbox(delta: number) {
	if (!lightbox) return;
	const n = lightbox.images.length;
	lightbox.index = (lightbox.index + delta + n) % n;
}

function onKeydown(e: KeyboardEvent) {
	if (lightbox) {
		if (e.key === "Escape") lightbox = null;
		else if (e.key === "ArrowLeft") stepLightbox(-1);
		else if (e.key === "ArrowRight") stepLightbox(1);
	} else if (composerOpen && e.key === "Escape") {
		closeComposer();
	}
}

onMount(() => {
	try {
		likedIds = new Set(JSON.parse(localStorage.getItem(LIKED_KEY) ?? "[]"));
	} catch {
		likedIds = new Set();
	}
	try {
		mailInput = localStorage.getItem(MAIL_KEY) ?? "";
	} catch {
		mailInput = "";
	}
	void load(true);

	// 隐藏入口 1：#write 锚点（首次进入与 hash 变化都检查）
	const checkHash = () => {
		if (window.location.hash === "#write") openComposer();
	};
	checkHash();
	window.addEventListener("hashchange", checkHash);

	// 隐藏入口 2：双击页头 ⚡ 图标
	const icon = document.querySelector(".ip-moments .ip-page-title__icon");
	const onIconDbl = () => openComposer();
	icon?.addEventListener("dblclick", onIconDbl);

	return () => {
		window.removeEventListener("hashchange", checkHash);
		icon?.removeEventListener("dblclick", onIconDbl);
	};
});
</script>

<svelte:window on:keydown={onKeydown} />

<div class="moments">
	<!-- 动态流 -->
	{#if loading}
		<!-- SSR/首屏骨架 -->
		{#each [0, 1, 2] as i (i)}
			<div class="moment-card skeleton">
				<div class="moment-avatar placeholder"></div>
				<div class="moment-main">
					<div class="sk-line w-2/5"></div>
					<div class="sk-line"></div>
					<div class="sk-line w-4/5"></div>
				</div>
			</div>
		{/each}
	{:else if moments.length === 0}
		<div class="moments-empty">
			<span class="moments-empty-emoji">🌙</span>
			<p>{i18n(I18nKey.momentsEmpty)}</p>
			{#if error}
				<button type="button" class="tool-btn" on:click={refresh}>
					<Icon icon="material-symbols:refresh" size="sm" />
					<span>{i18n(I18nKey.momentsRetry)}</span>
				</button>
			{/if}
		</div>
	{:else}
		<div class="moments-feed">
			{#each moments as m (m.id)}
				<article class="moment-card">
					<div class="moment-avatar-wrap">
						{#if authorAvatar}
							<img class="moment-avatar" src={authorAvatar} alt={authorName || m.nick} loading="lazy" />
						{:else}
							<div class="moment-avatar placeholder">{(authorName || m.nick).slice(0, 1)}</div>
						{/if}
					</div>
					<div class="moment-main">
						<div class="moment-head">
							<span class="moment-nick">{authorName || m.nick}</span>
							{#if m.mood}
								<span class="moment-mood" title="心情">{m.mood}</span>
							{/if}
							<time class="moment-time" datetime={new Date(m.created).toISOString()}>
								{formatRelativeTime(m.created, lang)}
							</time>
						</div>

						{#if m.html}
							<div class="moment-content">
								<!-- Twikoo 服务端已对提交内容做过清洗，此处为渲染后的博主动态 HTML -->
								{@html m.html}
							</div>
						{/if}

						{#if m.images.length > 0}
							<div class="moment-imgs" class:single={m.images.length === 1}>
								{#each m.images as src, i (src)}
									<button
										type="button"
										class="moment-img-btn"
										on:click={() => openLightbox(m.images, i)}
										aria-label="查看图片"
									>
										<img src={src} loading="lazy" alt="" />
									</button>
								{/each}
							</div>
						{/if}

						<div class="moment-foot">
							<span class="moment-dev">
								{#if m.os}{m.os}{/if}{#if m.os && m.browser} · {/if}{#if m.browser}{m.browser}{/if}
							</span>
							<div class="moment-actions">
								<button
									type="button"
									class="moment-action"
									class:liked={likedIds.has(m.id)}
									on:click={() => toggleLike(m)}
								>
									<Icon icon="material-symbols:favorite" size="sm" />
									<span>{m.like}</span>
								</button>
							</div>
						</div>
					</div>
				</article>
			{/each}
		</div>

		{#if more}
			<div class="moments-more">
				<button type="button" class="tool-btn" disabled={loadingMore} on:click={() => load(false)}>
					{#if loadingMore}
						<Icon icon="svg-spinners:ring-resize" size="sm" />
					{:else}
						<Icon icon="material-symbols:chevron-right" size="sm" />
					{/if}
					<span>{i18n(I18nKey.more)}</span>
				</button>
			</div>
		{/if}
	{/if}
</div>

<!-- 写动态弹窗（独立于评论区，入口对读者隐藏） -->
{#if composerOpen}
	<div
		class="moment-composer"
		role="dialog"
		aria-modal="true"
		aria-label={i18n(I18nKey.momentsCompose)}
		on:click|self={closeComposer}
	>
		<div class="composer-card card-base">
			<div class="composer-head">
				<span class="composer-title">{i18n(I18nKey.momentsCompose)}</span>
				<button type="button" class="composer-close" on:click={closeComposer} aria-label="关闭">✕</button>
			</div>

			<input
				class="composer-input"
				type="email"
				bind:value={mailInput}
				placeholder={i18n(I18nKey.momentsMail)}
				autocomplete="off"
			/>

			<div class="composer-moods" role="group" aria-label="心情">
				{#each MOOD_EMOJIS as emoji (emoji)}
					<button
						type="button"
						class="mood-chip"
						class:active={moodInput === emoji}
						title={emoji}
						on:click={() => (moodInput = moodInput === emoji ? "" : emoji)}
					>
						{emoji}
					</button>
				{/each}
			</div>

			<textarea
				class="composer-text"
				bind:value={textInput}
				rows="3"
				maxlength="500"
				placeholder={i18n(I18nKey.momentsPlaceholder)}
			></textarea>

			<input
				class="composer-input"
				type="url"
				bind:value={imageInput}
				placeholder={i18n(I18nKey.momentsImage)}
				autocomplete="off"
			/>

			{#if composerError}
				<p class="composer-error">{composerError}</p>
			{/if}

			<div class="composer-btns">
				<button type="button" class="tool-btn" on:click={closeComposer}>
					<span>{i18n(I18nKey.momentsCancel)}</span>
				</button>
				<button
					type="button"
					class="tool-btn primary"
					disabled={publishing || !textInput.trim() || !mailInput.trim()}
					on:click={publish}
				>
					{#if publishing}
						<Icon icon="svg-spinners:ring-resize" size="sm" />
					{/if}
					<span>{i18n(I18nKey.momentsPublish)}</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 灯箱 -->
{#if lightbox}
	<div
		class="moment-lightbox"
		role="dialog"
		aria-modal="true"
		on:click|self={() => (lightbox = null)}
	>
		<button type="button" class="lightbox-close" on:click={() => (lightbox = null)} aria-label="关闭">✕</button>
		{#if lightbox.images.length > 1}
			<button type="button" class="lightbox-nav prev" on:click={() => stepLightbox(-1)} aria-label="上一张">‹</button>
			<button type="button" class="lightbox-nav next" on:click={() => stepLightbox(1)} aria-label="下一张">›</button>
		{/if}
		<img src={lightbox.images[lightbox.index]} alt="" />
		{#if lightbox.images.length > 1}
			<span class="lightbox-index">{lightbox.index + 1} / {lightbox.images.length}</span>
		{/if}
	</div>
{/if}

<style>
	.moments {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* ── 骨架 ───────────────────────────────────────────────── */
	.moment-card.skeleton {
		display: flex;
		gap: 0.85rem;
		padding: 1rem;
	}

	.skeleton .moment-avatar.placeholder {
		flex-shrink: 0;
	}

	.skeleton .moment-main {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
	}

	.sk-line {
		height: 0.85rem;
		border-radius: 999px;
		background: var(--btn-regular-bg);
		animation: moments-pulse 1.4s ease-in-out infinite;
	}

	.w-2\/5 {
		width: 40%;
	}

	.w-4\/5 {
		width: 80%;
	}

	@keyframes moments-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
	}

	/* ── 空状态 ─────────────────────────────────────────────── */
	.moments-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--content-meta);
	}

	.moments-empty-emoji {
		font-size: 2.25rem;
	}

	.moments-empty p {
		margin: 0;
	}

	/* ── 动态卡片 ───────────────────────────────────────────── */
	.moments-feed {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: relative;
	}

	/* 动态卡片：不用 card-base，无边框无卡片底色，文字直接融进页面背景 */
	.moment-card {
		display: flex;
		gap: 0.85rem;
		padding: 1rem 1.1rem;
	}

	.moment-avatar-wrap {
		flex-shrink: 0;
	}

	.moment-avatar {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.85rem;
		object-fit: cover;
		border: 1px solid var(--btn-regular-bg);
	}

	.moment-avatar.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		font-weight: 600;
	}

	.moment-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.moment-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.moment-nick {
		font-weight: 600;
		color: var(--btn-content);
	}

	.moment-mood {
		font-size: 0.95rem;
		line-height: 1;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: var(--btn-regular-bg);
	}

	.moment-time {
		font-size: 0.78rem;
		color: var(--content-meta);
		opacity: 0.7;
	}

	.moment-content {
		font-size: 0.95rem;
		line-height: 1.75;
		color: var(--btn-content);
		overflow-wrap: break-word;
	}

	.moment-content :global(p) {
		margin: 0 0 0.4em;
	}

	.moment-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.moment-content :global(a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.moment-content :global(img) {
		max-width: 100%;
		border-radius: 0.6rem;
	}

	.moment-content :global(code) {
		background: var(--inline-code-bg);
		color: var(--inline-code-color);
		padding: 0.1em 0.4em;
		border-radius: 0.35rem;
		font-size: 0.85em;
	}

	/* ── 图片九宫格 ─────────────────────────────────────────── */
	.moment-imgs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
		max-width: 26rem;
	}

	.moment-imgs.single {
		grid-template-columns: minmax(0, 22rem);
	}

	.moment-img-btn {
		padding: 0;
		border: 1px solid var(--btn-regular-bg);
		background: none;
		cursor: zoom-in;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 0.6rem;
	}

	.moment-imgs.single .moment-img-btn {
		aspect-ratio: auto;
		max-height: 24rem;
	}

	.moment-img-btn img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ── 底部操作 ───────────────────────────────────────────── */
	.moment-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.moment-dev {
		font-size: 0.75rem;
		color: var(--content-meta);
		opacity: 0.65;
	}

	.moment-actions {
		display: flex;
		gap: 0.4rem;
	}

	.moment-action {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.55rem;
		font-size: 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--btn-regular-bg);
		background: transparent;
		color: var(--content-meta);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.moment-action:hover {
		background: var(--btn-regular-bg-hover);
	}

	.moment-action.liked {
		color: var(--primary);
		border-color: var(--primary);
	}

	/* ── 加载更多 ───────────────────────────────────────────── */
	.moments-more {
		display: flex;
		justify-content: center;
		padding: 0.5rem 0;
	}

	.tool-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.8rem;
		font-size: 0.875rem;
		border-radius: 0.6rem;
		border: 1px solid var(--btn-regular-bg);
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.tool-btn:hover {
		background: var(--btn-regular-bg-hover);
	}

	.tool-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.tool-btn.primary {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}

	.tool-btn.primary:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	/* ── 写动态弹窗 ─────────────────────────────────────────── */
	.moment-composer {
		position: fixed;
		inset: 0;
		z-index: 110;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgb(0 0 0 / 0.55);
		backdrop-filter: blur(4px);
		animation: moments-fade 0.18s ease;
	}

	.composer-card {
		/* 弹窗要小而紧凑：视口 92% 宽、上限 420px 双保险 */
		width: 92vw;
		max-width: 420px;
		padding: 0.85rem 0.95rem 0.95rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		animation: composer-rise 0.22s ease;
	}

	@keyframes composer-rise {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.composer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.composer-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--btn-content);
	}

	.composer-close {
		width: 1.6rem;
		height: 1.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		border-radius: 0.45rem;
		border: none;
		background: var(--btn-regular-bg);
		color: var(--content-meta);
		cursor: pointer;
	}

	.composer-close:hover {
		background: var(--btn-regular-bg-hover);
	}

	/* 固定 1.7rem 小格、6 列两行，比一长条更紧凑 */
	.composer-moods {
		display: grid;
		grid-template-columns: repeat(6, 1.7rem);
		justify-content: space-between;
		gap: 0.28rem;
	}

	.mood-chip {
		width: 1.7rem;
		height: 1.7rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.95rem;
		border-radius: 0.55rem;
		border: 1px solid var(--btn-regular-bg);
		background: var(--btn-regular-bg);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.mood-chip:hover {
		transform: translateY(-2px) scale(1.08);
	}

	.mood-chip.active {
		border-color: var(--primary);
		background: var(--btn-regular-bg-hover);
		transform: scale(1.1);
	}

	.composer-input,
	.composer-text {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.85rem;
		border-radius: 0.55rem;
		border: 1px solid var(--btn-regular-bg);
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		outline: none;
		transition: border-color 0.15s ease;
	}

	.composer-input:focus,
	.composer-text:focus {
		border-color: var(--primary);
	}

	.composer-text {
		resize: vertical;
		min-height: 4rem;
		line-height: 1.6;
		font-family: inherit;
	}

	.composer-error {
		margin: 0;
		font-size: 0.78rem;
		color: #e05656;
	}

	.composer-btns {
		display: flex;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	/* ── 灯箱 ───────────────────────────────────────────────── */
	.moment-lightbox {
		position: fixed;
		inset: 0;
		z-index: 120;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(0 0 0 / 0.85);
		backdrop-filter: blur(6px);
		animation: moments-fade 0.18s ease;
	}

	@keyframes moments-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.moment-lightbox img {
		max-width: min(92vw, 64rem);
		max-height: 86vh;
		border-radius: 0.6rem;
		object-fit: contain;
	}

	.lightbox-close {
		position: absolute;
		top: 1rem;
		right: 1.25rem;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 999px;
		border: none;
		background: rgb(255 255 255 / 0.12);
		color: white;
		font-size: 1.1rem;
		cursor: pointer;
	}

	.lightbox-close:hover {
		background: rgb(255 255 255 / 0.24);
	}

	.lightbox-nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 2.8rem;
		height: 2.8rem;
		border-radius: 999px;
		border: none;
		background: rgb(255 255 255 / 0.12);
		color: white;
		font-size: 1.6rem;
		line-height: 1;
		cursor: pointer;
	}

	.lightbox-nav:hover {
		background: rgb(255 255 255 / 0.24);
	}

	.lightbox-nav.prev {
		left: 1rem;
	}

	.lightbox-nav.next {
		right: 1rem;
	}

	.lightbox-index {
		position: absolute;
		bottom: 1.1rem;
		left: 50%;
		transform: translateX(-50%);
		color: rgb(255 255 255 / 0.8);
		font-size: 0.85rem;
	}

	@media (max-width: 640px) {
		.moment-card {
			padding: 0.85rem 0.9rem;
		}

		.moment-imgs {
			max-width: 100%;
		}
	}
</style>
