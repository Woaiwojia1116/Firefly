import gsap from "gsap";

/**
 * 内页入场动画（GSAP）
 *
 * 只处理内页的页头与列表项：上移 + 淡入，位移克制。
 * 首页（CinematicHome）、文章详情页、时间轴页各自已有专用动效，
 * 文章列表卡片也已有 CSS + IntersectionObserver 的滚动渐显，
 * 这些区域一律跳过，避免两套动画互相覆盖。
 */

const ITEM_SELECTOR = [
	".ip-arc-row",
	".friend-card",
	".album-card",
	".gallery-photo-card",
	".bangumi-item",
].join(",");

// 首屏最多动 24 项，其余直接呈现，避免长列表整体延迟
const MAX_ITEMS = 24;

const animated = new WeakSet<Element>();
let retryTimers: number[] = [];

function shouldAnimate(root: HTMLElement): boolean {
	if (document.body.classList.contains("homepage")) return false;
	if (root.closest(".ip-timeline, .ip-post")) return false;
	if (document.querySelector("#content-wrapper.post-narrow")) return false;
	return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function play(root: HTMLElement) {
	if (!shouldAnimate(root)) return;

	const head = root.querySelector<HTMLElement>(".ip-head");
	const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
		.filter((el) => !animated.has(el))
		.slice(0, MAX_ITEMS);

	if (head && !animated.has(head)) {
		animated.add(head);
		gsap.from(head, {
			y: 16,
			opacity: 0,
			duration: 0.55,
			ease: "power3.out",
			clearProps: "opacity,transform",
		});
	}

	if (items.length > 0) {
		for (const el of items) animated.add(el);
		gsap.from(items, {
			y: 18,
			opacity: 0,
			duration: 0.5,
			delay: head ? 0.06 : 0,
			stagger: 0.045,
			ease: "power2.out",
			clearProps: "opacity,transform",
		});
	}

	// 关于、动态、404 这类没有页头也没有列表项的页面：内容块整体淡入
	if (!head && items.length === 0 && !animated.has(root)) {
		const blocks = Array.from(root.children) as HTMLElement[];
		if (blocks.length === 0) return;
		animated.add(root);
		gsap.from(blocks, {
			y: 20,
			opacity: 0,
			duration: 0.55,
			stagger: 0.06,
			ease: "power3.out",
			clearProps: "opacity,transform",
		});
	}
}

function schedule(root: HTMLElement) {
	for (const id of retryTimers) window.clearTimeout(id);
	retryTimers = [];

	play(root);

	// 归档面板等 client:only 组件会在 page-load 之后才挂载，
	// 追加两次补跑，只处理新出现的元素（WeakSet 去重）
	for (const delay of [180, 500]) {
		retryTimers.push(window.setTimeout(() => play(root), delay));
	}
}

function run() {
	const root =
		document.querySelector<HTMLElement>("#content-wrapper .ip") ??
		(document.querySelector("#content-wrapper .gallery-photo-card")
			? document.querySelector<HTMLElement>("#content-wrapper")
			: null);

	if (root) schedule(root);
}

export function initPageEntrance() {
	document.addEventListener("astro:page-load", run);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", run, { once: true });
	} else {
		run();
	}
}
