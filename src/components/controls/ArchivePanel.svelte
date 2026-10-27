<script lang="ts">
import { onMount } from "svelte";

import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { getPostUrlBySlug } from "@/utils/url-utils";

interface Post {
	id: string;
	data: {
		title: string;
		tags: string[];
		category?: string | null;
		published: Date;
	};
}

interface Props {
	tags?: string[];
	categories?: string[];
	sortedPosts?: Post[];
}

let { sortedPosts = [] }: Props = $props();

// 仅在客户端解析 URL 参数（归档页同时承担分类 / 标签筛选入口）
let parsedTags = $state<string[]>([]);
let parsedCategories = $state<string[]>([]);
let uncategorized = $state<string | null>(null);

if (typeof window !== "undefined") {
	const params = new URLSearchParams(window.location.search);
	parsedTags = params.has("tag") ? params.getAll("tag") : [];
	parsedCategories = params.has("category") ? params.getAll("category") : [];
	uncategorized = params.get("uncategorized");
}

interface MonthGroup {
	month: number; // 1–12
	posts: Post[];
}

interface Group {
	year: number;
	months: MonthGroup[];
	total: number;
}

interface ActiveFilter {
	labelKey: I18nKey;
	values: string[];
}

const CALENDAR_MONTH_KEYS: Record<number, I18nKey> = {
	1: I18nKey.calendarJanuary,
	2: I18nKey.calendarFebruary,
	3: I18nKey.calendarMarch,
	4: I18nKey.calendarApril,
	5: I18nKey.calendarMay,
	6: I18nKey.calendarJune,
	7: I18nKey.calendarJuly,
	8: I18nKey.calendarAugust,
	9: I18nKey.calendarSeptember,
	10: I18nKey.calendarOctober,
	11: I18nKey.calendarNovember,
	12: I18nKey.calendarDecember,
};

let groups: Group[] = $state([]);
let activeFilters: ActiveFilter[] = $state([]);
let filteredPostCount = $state(0);

// 滑动高亮层：鼠标划过文章行时，单个高亮背景在行间平滑滑动（magic highlight）
let archiveEl: HTMLDivElement | undefined = $state();
let hlEnabled = $state(false);
let hlVisible = $state(false);
let hlTop = $state(0);
let hlHeight = $state(0);

function moveHighlight(e: MouseEvent) {
	if (!hlEnabled || !archiveEl) return;
	const row = (e.target as HTMLElement | null)?.closest?.(
		".ip-arc-row",
	) as HTMLElement | null;
	if (!row || !archiveEl.contains(row)) return;
	// 相对容器坐标：页面滚动时两边矩形同步偏移，差值恒定，无需监听滚动
	const rowRect = row.getBoundingClientRect();
	const baseRect = archiveEl.getBoundingClientRect();
	hlTop = rowRect.top - baseRect.top;
	hlHeight = rowRect.height;
	hlVisible = true;
}

function hideHighlight() {
	hlVisible = false;
}

function formatDay(date: Date) {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${month}-${day}`;
}

function formatFilterValues(filter: ActiveFilter) {
	const prefix = filter.labelKey === I18nKey.tags ? "#" : "";
	return filter.values.map((value) => `${prefix}${value}`).join(" / ");
}

function formatFilterSummary(filters: ActiveFilter[]) {
	return filters
		.map((filter) => `${i18n(filter.labelKey)}: ${formatFilterValues(filter)}`)
		.join("  ·  ");
}

onMount(() => {
	// 仅在支持 hover 的指针设备上启用滑动高亮（触屏没有 mouseover 流）
	hlEnabled = window.matchMedia("(hover: hover)").matches;

	// published 从 Astro 传过来时可能是字符串，这里统一成 Date
	let filteredPosts: Post[] = sortedPosts.map((post) => ({
		...post,
		data: {
			...post.data,
			published:
				post.data.published instanceof Date
					? post.data.published
					: new Date(post.data.published),
		},
	}));

	const currentFilters: ActiveFilter[] = [];
	if (parsedCategories.length > 0) {
		currentFilters.push({
			labelKey: I18nKey.categories,
			values: parsedCategories,
		});
	}
	if (uncategorized) {
		currentFilters.push({
			labelKey: I18nKey.categories,
			values: [i18n(I18nKey.uncategorized)],
		});
	}
	if (parsedTags.length > 0) {
		currentFilters.push({ labelKey: I18nKey.tags, values: parsedTags });
	}
	activeFilters = currentFilters;

	if (parsedTags.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) =>
				Array.isArray(post.data.tags) &&
				post.data.tags.some((tag) => parsedTags.includes(tag)),
		);
	}
	if (parsedCategories.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) =>
				post.data.category && parsedCategories.includes(post.data.category),
		);
	}
	if (uncategorized) {
		filteredPosts = filteredPosts.filter((post) => !post.data.category);
	}

	// 按发布时间倒序，不受置顶影响
	filteredPosts = filteredPosts
		.slice()
		.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());

	filteredPostCount = filteredPosts.length;

	// 年份 → 月份 → 文章
	const yearMap = new Map<number, Map<number, Post[]>>();
	for (const post of filteredPosts) {
		const year = post.data.published.getFullYear();
		const month = post.data.published.getMonth() + 1;
		if (!yearMap.has(year)) yearMap.set(year, new Map());
		const monthMap = yearMap.get(year)!;
		if (!monthMap.has(month)) monthMap.set(month, []);
		monthMap.get(month)!.push(post);
	}

	groups = [...yearMap.entries()]
		.sort((a, b) => b[0] - a[0])
		.map(([year, monthMap]) => {
			const months: MonthGroup[] = [...monthMap.entries()]
				.sort((a, b) => b[0] - a[0])
				.map(([month, posts]) => ({ month, posts }));
			return {
				year,
				months,
				total: months.reduce((sum, m) => sum + m.posts.length, 0),
			};
		});
});
</script>

<div
	class="ip-archive"
	bind:this={archiveEl}
	onmouseover={moveHighlight}
	onmouseleave={hideHighlight}
>
	{#if hlEnabled}
		<div
			class="ip-arc-highlight"
			class:is-visible={hlVisible}
			style:transform={`translateY(${hlTop}px)`}
			style:height={`${hlHeight}px`}
		></div>
	{/if}
	{#if activeFilters.length > 0}
		<div class="ip-meta mb-5">
			<span>{formatFilterSummary(activeFilters)}</span>
			<span class="ip-sep">·</span>
			<span>
				{filteredPostCount}
				{i18n(filteredPostCount === 1 ? I18nKey.postCount : I18nKey.postsCount)}
			</span>
		</div>
	{/if}

	{#if groups.length === 0}
		<p class="ip-empty">{i18n(I18nKey.searchNoResults)}</p>
	{:else}
		{#each groups as group}
			<section class="ip-arc-section" id={`year-${group.year}`}>
				<div class="ip-year-head">
					<span class="ip-year-num">{group.year}</span>
					<span class="ip-year-count">
						{group.total}
						{i18n(group.total === 1 ? I18nKey.postCount : I18nKey.postsCount)}
					</span>
				</div>

				{#each group.months as monthGroup}
					<div class="ip-month-head">
						<span>{i18n(CALENDAR_MONTH_KEYS[monthGroup.month])}</span>
						<span>
							· {monthGroup.posts.length}
						</span>
					</div>

					{#each monthGroup.posts as post}
						<a
							href={getPostUrlBySlug(post.id)}
							aria-label={post.data.title}
							class="ip-arc-row"
						>
							<span class="ip-arc-date">{formatDay(post.data.published)}</span>
							<span class="ip-arc-title">{post.data.title}</span>
							<span class="ip-arc-tags">
								{post.data.category
									? post.data.category
									: i18n(I18nKey.uncategorized)}
								{#if post.data.tags && post.data.tags.length > 0}
									{"  "}
									{post.data.tags
										.slice(0, 3)
										.map((t) => `#${t}`)
										.join(" ")}
								{/if}
							</span>
						</a>
					{/each}
				{/each}
			</section>
		{/each}
	{/if}
</div>
