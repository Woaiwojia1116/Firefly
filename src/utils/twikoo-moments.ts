// 动态（Moments）：把 Twikoo 评论当作动态数据源
// ---------------------------------------------------------------------------
// 站点是纯静态构建，动态数据存在自建 Twikoo（见 commentConfig.twikoo.envId）。
// 「动态」与「评论」彻底分流：
//   - 博主动态存于隐藏路径 /moments-master（MOMENTS_FEED_PATH），
//     由写动态弹窗直接调 COMMENT_SUBMIT 发布，任何公开评论框都不挂此路径，
//     因此动态永远不会出现在页面评论区里；
//   - 读者留言走页面底部评论区（路径 /moments，与普通文章评论同一套机制）。
// 动态流客户端实时拉取渲染，发完即见、无需重建站点。
//
// 身份判定（防冒名）：
//   1. 首选服务端 master 标记 —— 在 Twikoo 管理面板登录过的浏览器发布的评论，
//      服务端会写入 master=true，前端不可伪造；
//   2. 兜底「昵称 + 邮箱哈希」双匹配 —— 邮箱明文不出现在前端产物，
//      构建时传 md5/sha256 摘要进来（自建实例的 mailMd5 字段实测为 sha256，
//      旧版部署为 md5，两种都比对）。未配置邮箱时退化为仅昵称匹配。
//      写动态弹窗里填写的邮箱必须与 commentConfig.masterTag.email 一致。
//
// 本模块不 import 任何 config，envId / 博主标识一律由调用方传参，
// 避免把配置整包打进客户端 bundle。/moments/ 页面孤岛与首页手写便签共用。

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
// dayjs 的 locale 需要 import 注册后 dayjs.locale() 才生效
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-tw";
import "dayjs/locale/ja";
import "dayjs/locale/ru";

dayjs.extend(relativeTime);

/** 动态页公开评论区的 Twikoo 路径（读者留言用，与动态数据完全隔离） */
export const MOMENTS_PATH = "/moments";

/**
 * 博主动态的 Twikoo 路径。刻意与公开评论区(MOMENTS_PATH)分开：
 * 任何公开评论框都不会挂在这个路径下，博主动态永远不会出现在评论区里。
 */
export const MOMENTS_FEED_PATH = "/moments-master";

/** 心情约定：正文以「🌧️｜」开头，｜为全角或半角竖线 */
const MOOD_RE =
	/^\s*(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*[｜|]\s*/u;

/** COMMENT_GET 返回的单条评论（字段已在自建实例上实测） */
export interface TwikooComment {
	id: string;
	nick: string;
	mailMd5?: string;
	avatar?: string;
	link?: string;
	comment: string; // 服务端渲染好的 HTML
	commentText?: string; // 纯文本（GET_RECENT_COMMENTS 提供，COMMENT_GET 不一定有）
	created: number; // 毫秒时间戳
	like?: number;
	master?: boolean;
	isOwner?: boolean;
	os?: string;
	browser?: string;
	ipRegion?: string;
	replies?: TwikooComment[];
}

/** 解析后的动态 */
export interface MomentItem {
	id: string;
	nick: string;
	html: string; // 去掉心情前缀、抽出图片后的正文 HTML
	text: string; // 纯文本正文（首页便签用）
	mood: string; // 心情 emoji，如 "🌧️"，无则空串
	images: string[]; // 从正文抽出的图片地址（九宫格用）
	created: number;
	like: number;
	os?: string;
	browser?: string;
	replies: { nick: string; text: string; created: number }[];
}

/** 拉取结果：more 表示 Twikoo 还有更早的评论；oldestCreated 用于续翻游标 */
export interface MomentsFetchResult {
	moments: MomentItem[];
	more: boolean;
	oldestCreated?: number;
}

export interface MomentsAuthorFilter {
	/** 博主昵称（masterTag.nickname） */
	masterNick: string;
	/** 博主邮箱摘要（构建时算好），空数组表示不启用邮箱校验 */
	mailHashes: string[];
}

/** 站点语言 → dayjs 相对时间 locale */
export function toDayjsLocale(lang: string): string {
	switch (lang) {
		case "zh_CN":
			return "zh-cn";
		case "zh_TW":
			return "zh-tw";
		case "ja":
			return "ja";
		case "ru":
			return "ru";
		default:
			return "en";
	}
}

/** Twikoo REST 调用。自建部署实测信封为 { data, count, more }，无 code 包裹 */
export async function twikooCall<T = unknown>(
	envId: string,
	event: string,
	payload: Record<string, unknown> = {},
): Promise<{ data?: T; count?: number; more?: boolean; id?: string; code?: number; message?: string }> {
	const res = await fetch(envId, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ event, ...payload }),
	});
	if (!res.ok) {
		throw new Error(`Twikoo ${event} HTTP ${res.status}`);
	}
	return (await res.json()) as { data?: T; count?: number; more?: boolean };
}

/** 这条评论是博主的吗：master 标记优先，昵称+邮箱摘要兜底 */
export function isAuthorComment(
	c: TwikooComment,
	author: MomentsAuthorFilter,
): boolean {
	if (c.master === true || c.isOwner === true) return true;
	if (c.nick !== author.masterNick) return false;
	if (author.mailHashes.length === 0) return true;
	return !!c.mailMd5 && author.mailHashes.includes(c.mailMd5);
}

/**
 * 解析单条博主动态：抽心情徽章、抽图片、平文本。
 * DOMParser 只在浏览器环境可用——本模块的两处调用方都是客户端脚本。
 */
export function parseMoment(c: TwikooComment): MomentItem {
	const doc = new DOMParser().parseFromString(
		`<body>${c.comment}</body>`,
		"text/html",
	);
	const body = doc.body;

	// 抽图片进九宫格：img 节点收集 src 后移除；仅包着图片的 <a> 一并移除
	const images: string[] = [];
	for (const img of Array.from(body.querySelectorAll("img"))) {
		const src = img.getAttribute("src");
		if (src) images.push(src);
		const anchor = img.closest("a");
		if (anchor && anchor.textContent?.trim() === "") anchor.remove();
		else img.remove();
	}

	// 心情前缀写在第一个非空文本节点开头
	let mood = "";
	const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode() as Text | null;
	while (node) {
		const trimmed = node.nodeValue ?? "";
		if (trimmed.trim()) {
			const match = trimmed.match(MOOD_RE);
			if (match) {
				mood = match[1];
				node.nodeValue = trimmed.slice(match[0].length);
			}
			break;
		}
		node = walker.nextNode() as Text | null;
	}

	const text = (c.commentText || body.textContent || "")
		.replace(MOOD_RE, "")
		.trim();

	const replies = (c.replies ?? []).map((r) => ({
		nick: r.nick,
		text: (r.commentText || r.comment || "").replace(/<[^>]+>/g, "").trim(),
		created: r.created,
	}));

	return {
		id: c.id,
		nick: c.nick,
		html: body.innerHTML.trim(),
		text,
		mood,
		images,
		created: c.created,
		like: c.like ?? 0,
		os: c.os,
		browser: c.browser,
		replies,
	};
}

/**
 * 拉取一页动态。注意：过滤发生在分页之后，调用方需用返回的 more/oldestCreated
 * 续翻（before 取整批评论——含被过滤掉的访客评论——的最小 created）。
 */
export async function fetchMoments(options: {
	envId: string;
	author: MomentsAuthorFilter;
	before?: number;
	pageSize?: number;
}): Promise<MomentsFetchResult> {
	const { envId, author, before, pageSize = 10 } = options;
	const res = await twikooCall<TwikooComment[]>(envId, "COMMENT_GET", {
		url: MOMENTS_FEED_PATH,
		pageSize,
		...(before !== undefined ? { before } : {}),
	});
	const list = res.data ?? [];
	const moments = list
		.filter((c) => isAuthorComment(c, author))
		.map(parseMoment);
	const oldestCreated = list.length
		? Math.min(...list.map((c) => c.created))
		: undefined;
	return { moments, more: res.more === true, oldestCreated };
}

/** 点赞（实测事件名 COMMENT_LIKE，type:"up" 为赞） */
export function likeMoment(envId: string, id: string): Promise<unknown> {
	return twikooCall(envId, "COMMENT_LIKE", { id, type: "up" });
}

/**
 * 博主发布动态（独立写入口）：直接调 COMMENT_SUBMIT 写入 MOMENTS_FEED_PATH，
 * 与页面底部公开评论区(MOMENTS_PATH)完全无关。
 * 身份 = 昵称 + 博主邮箱（邮箱与 commentConfig.masterTag.email 一致时才会进动态流）。
 * 心情以「emoji｜」前缀写入正文；图片链接以 Markdown 图片追加。
 */
export async function submitMoment(options: {
	envId: string;
	nick: string;
	mail: string;
	text: string;
	mood?: string;
	imageUrl?: string;
}): Promise<void> {
	const moodPrefix = options.mood ? `${options.mood}｜` : "";
	const body = options.text.trim();
	const image = options.imageUrl?.trim()
		? `\n\n![](${options.imageUrl.trim()})`
		: "";
	const res = await twikooCall(options.envId, "COMMENT_SUBMIT", {
		url: MOMENTS_FEED_PATH,
		ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
		nick: options.nick,
		mail: options.mail,
		comment: `${moodPrefix}${body}${image}`,
	});
	if (res.code !== undefined && res.code !== 0) {
		throw new Error(res.message || `Twikoo 错误 ${res.code}`);
	}
	if (!res.id) {
		throw new Error("Twikoo 未返回动态 id，发布可能失败");
	}
}

/** 相对时间（“3 天前”），locale 由站点语言映射 */
export function formatRelativeTime(ts: number, lang: string): string {
	return dayjs(ts).locale(toDayjsLocale(lang)).fromNow();
}

/** 日期分组标签（“2026年10月”式），用于动态流的月份分隔 */
export function formatMonthLabel(ts: number, lang: string): string {
	return dayjs(ts).locale(toDayjsLocale(lang)).format("YYYY年MM月");
}

/**
 * 给首页手写便签用：拿最新一条博主动态。
 * 最多翻 2 页就放弃（作者动态通常都在最前面），失败返回 null 由调用方回退默认文案。
 */
export async function fetchLatestMoment(options: {
	envId: string;
	author: MomentsAuthorFilter;
}): Promise<MomentItem | null> {
	let before: number | undefined;
	for (let page = 0; page < 2; page++) {
		try {
			const res = await fetchMoments({
				envId: options.envId,
				author: options.author,
				before,
				pageSize: 20,
			});
			if (res.moments.length > 0) return res.moments[0];
			if (!res.more || res.oldestCreated === undefined) return null;
			before = res.oldestCreated;
		} catch {
			return null;
		}
	}
	return null;
}
