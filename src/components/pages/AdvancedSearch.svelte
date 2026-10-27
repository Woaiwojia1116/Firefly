<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import { url as formatUrl } from "@/utils/url-utils";

// --- Props ---
// 示例查询：search.astro 在服务端取最新几篇真实文章标题传入，
// 空状态的邀请胶囊和输入框的 placeholder 轮播共用这一份
export let examples: string[] = [];

// --- State ---
let keyword = "";
let results: SearchResult[] = [];
let isSearching = false;
let elapsedMs = 0;
let initialized = false;
let searchInput: HTMLInputElement | undefined = undefined;
let shortcutLabel = "Ctrl+K";

// placeholder 轮播：4.5s 换一篇真实文章标题，输入中无感知（placeholder 只在空值时可见）
let placeholderIdx = 0;
let currentPlaceholder = i18n(I18nKey.search);
const rotatePlaceholder = (): void => {
	const pool = examples.length ? examples : [i18n(I18nKey.search)];
	placeholderIdx = (placeholderIdx + 1) % pool.length;
	currentPlaceholder = pool[placeholderIdx];
};

// 在客户端获取 URL 参数
const getInitialKeyword = (): string => {
	if (typeof window !== "undefined") {
		const searchParams = new URLSearchParams(window.location.search);
		return searchParams.get("q") || "";
	}
	return "";
};

// --- Mocks for Dev Mode ---
const fakeResult: SearchResult[] = [
	{
		url: formatUrl("/"),
		meta: { title: "Dev Mode Search Result 1" },
		excerpt: "This is a <mark>mock</mark> result for development.",
	},
	{
		url: formatUrl("/"),
		meta: { title: "Dev Mode Search Result 2" },
		excerpt: "Pagefind only works in <mark>production</mark> build.",
	},
];

// --- Core Search Logic ---
const search = async () => {
	if (!initialized || !keyword.trim()) {
		results = [];
		return;
	}
	isSearching = true;
	const startedAt = performance.now();

	try {
		if (import.meta.env.PROD && window.pagefind) {
			const response = await window.pagefind.search(keyword);
			const rawResults = await Promise.all(
				response.results.map((item) => item.data()),
			);
			results = rawResults;
		} else if (import.meta.env.DEV) {
			// 开发模式下的模拟结果
			results = fakeResult.filter(
				(item) =>
					item.excerpt.toLowerCase().includes(keyword.toLowerCase()) ||
					item.meta.title.toLowerCase().includes(keyword.toLowerCase()),
			);
		}
	} catch (error) {
		console.error("Search error:", error);
		results = [];
	} finally {
		elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
		isSearching = false;
	}
};

// --- Initialization onMount ---
onMount(() => {
	// Mac 上键帽显示 ⌘（与导航栏工具面板的口径一致）
	if (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
		shortcutLabel = "⌘K";
	}

	const placeholderTimer = setInterval(rotatePlaceholder, 4500);

	// Ctrl/Cmd+K 在搜索页只做「聚焦 / 失焦输入框」切换。
	// 必须用捕获阶段拦截并 stopPropagation，否则导航栏的全局监听
	// 会照常触发，把已经在本页的用户又跳转（刷新）一次 /search/
	const onGlobalKey = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			event.stopPropagation();
			if (document.activeElement === searchInput) searchInput?.blur();
			else searchInput?.focus();
		}
	};
	document.addEventListener("keydown", onGlobalKey, true);

	const initialize = async () => {
		initialized = true;

		// 从 URL 获取初始关键词
		const initialKeyword = getInitialKeyword();
		if (initialKeyword) {
			keyword = initialKeyword;
		}

		// 如果有关键词，自动执行搜索
		if (keyword.trim()) {
			await search();
		}
	};

	// 开发环境直接初始化
	if (import.meta.env.DEV) {
		initialize();
	} else {
		// 生产环境等待 Pagefind 加载
		if (window.pagefind) {
			initialize();
		} else {
			document.addEventListener("pagefindready", initialize, {
				once: true,
			});
		}
	}

	return () => {
		document.removeEventListener("keydown", onGlobalKey, true);
		clearInterval(placeholderTimer);
	};
});

let debounceTimer: NodeJS.Timeout;
const handleInput = () => {
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		search();
	}, 300);
};

// 输入框内键位：Enter 立即搜索（跳过防抖），Esc 清空并失焦
const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === "Enter") {
		event.preventDefault();
		clearTimeout(debounceTimer);
		search();
	} else if (event.key === "Escape") {
		event.preventDefault();
		keyword = "";
		results = [];
		searchInput?.blur();
	}
};

// 点示例查询胶囊：填入关键词立即检索，并把焦点还回输入框
const runExample = (query: string) => {
	keyword = query;
	clearTimeout(debounceTimer);
	search();
	searchInput?.focus();
};
</script>

<!-- 检索条：真正的胶囊（surface-2 玻璃底 + 细线边框），聚焦时一圈萤火暖光 -->
<div class="ip-search-bar">
    <input
        type="text"
        class="ip-search-input"
        placeholder={currentPlaceholder}
        aria-label={i18n(I18nKey.search)}
        bind:value={keyword}
        bind:this={searchInput}
        on:input={handleInput}
        on:keydown={handleKeydown}
    >
    <Icon icon="material-symbols:search" class="ip-search-icon" />
</div>

<!-- 键位提示：紧贴检索条下方；整页没有「关闭」概念，ESC 是清空 -->
<div class="ip-search-hints">
    <span class="ip-hint"><kbd>ESC</kbd>{i18n(I18nKey.searchClear)}</span>
    <span class="ip-hint"><kbd>ENTER</kbd>{i18n(I18nKey.search)}</span>
    <span class="ip-hint"><kbd>{shortcutLabel}</kbd>{i18n(I18nKey.searchFocus)}</span>
</div>

<!-- 结果区：等宽统计行 + 编号索引记录流；空态是邀请而非死胡同 -->
<div class="ip-results">
    {#if isSearching}
        <div class="ip-search-loading">
            <Icon icon="svg-spinners:ring-resize" class="text-4xl text-(--ip-warm)" />
        </div>
    {:else if results.length > 0}
        <p class="ip-search-stats">{results.length} HITS · {elapsedMs} MS</p>
        <ol class="ip-result-list">
            {#each results as result, i}
                <li class="ip-result">
                    <a href={result.url}>
                        <span class="ip-result-idx" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                        <span class="ip-result-body">
                            <span class="ip-result-title">
                                {@html result.meta.title}
                                <Icon icon="fa7-solid:chevron-right" class="ip-result-arrow" />
                            </span>
                            {#if result.excerpt.includes('<mark>')}
                                <span class="ip-result-excerpt">{@html result.excerpt}</span>
                            {/if}
                            {#if result.content && result.content.includes('<mark>')}
                                <span class="ip-result-content">
                                    <em class="ip-result-badge">{i18n(I18nKey.searchContent)}</em>{@html result.content}
                                </span>
                            {/if}
                        </span>
                    </a>
                </li>
            {/each}
        </ol>
    {:else}
        <div class="ip-search-empty">
            {#if !keyword.trim()}
                <i class="ip-search-firefly" aria-hidden="true"></i>
            {/if}
            <p class="ip-search-empty-text">
                {keyword ? i18n(I18nKey.searchNoResults) : i18n(I18nKey.searchTypeSomething)}
            </p>
            {#if examples.length}
                <div class="ip-search-examples">
                    {#each examples.slice(0, 4) as example}
                        <button type="button" class="ip-search-example" on:click={() => runExample(example)}>
                            {example}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>
