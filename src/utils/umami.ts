/**
 * Umami 公开分享 API 客户端（仅供 /stats 统计页使用）
 *
 * Umami Cloud（新版 v3 网关）的分享流程为两段式：
 *  1. GET {base}/api/share/{slug}            → 换取短时 JWT（含 websiteId）
 *  2. GET {base}/api/websites/{id}/...       → 携带 x-umami-share-token 请求数据
 *
 * JWT 约 30 分钟有效，会缓存在 sessionStorage；数据结果缓存 10 分钟。
 * Umami Cloud 的公开 API 允许任意来源跨域（Access-Control-Allow-Origin: *）。
 */

export interface UmamiShareConfig {
	/** Umami 服务地址，如 "https://cloud.umami.is" 或自建地址 */
	apiBase: string;
	/** Dashboard → Share URL 中的分享 slug */
	shareId: string;
}

export interface UmamiSummary {
	pageviews: number;
	visitors: number;
	visits: number;
}

export interface UmamiPoint {
	x: string;
	y: number;
}

const DATA_CACHE_PREFIX = "umami-share-cache:";
const DATA_CACHE_TTL = 10 * 60 * 1000;
const TOKEN_CACHE_PREFIX = "umami-share-token:";
const TOKEN_CACHE_TTL = 25 * 60 * 1000;

interface TokenCacheEntry {
	t: number;
	token: string;
	websiteId: string;
	base: string;
}

interface DataCacheEntry {
	t: number;
	json: unknown;
}

/** Umami Cloud 的 API 挂在 /analytics/us 子路径下，自建实例则在根路径 */
function getApiBaseCandidates(apiBase: string): string[] {
	const origin = apiBase.replace(/\/+$/, "");
	if (new URL(origin).hostname === "cloud.umami.is") {
		return [`${origin}/analytics/us`, origin];
	}
	return [origin];
}

async function resolveShareToken(
	cfg: UmamiShareConfig,
): Promise<TokenCacheEntry> {
	const cacheKey = TOKEN_CACHE_PREFIX + cfg.shareId;
	try {
		const raw = sessionStorage.getItem(cacheKey);
		if (raw) {
			const entry = JSON.parse(raw) as TokenCacheEntry;
			if (Date.now() - entry.t < TOKEN_CACHE_TTL) return entry;
		}
	} catch {
		// sessionStorage 不可用则每次重新换取
	}

	for (const base of getApiBaseCandidates(cfg.apiBase)) {
		const res = await fetch(
			`${base}/api/share/${encodeURIComponent(cfg.shareId)}`,
			{ headers: { Accept: "application/json" } },
		);
		if (!res.ok) continue;
		const data = (await res.json()) as {
			token?: string;
			websiteId?: string;
		};
		if (!data.token) continue;

		const entry: TokenCacheEntry = {
			t: Date.now(),
			token: data.token,
			websiteId: data.websiteId || "",
			base,
		};
		try {
			sessionStorage.setItem(cacheKey, JSON.stringify(entry));
		} catch {
			// 缓存写失败不影响结果
		}
		return entry;
	}

	throw new Error("Umami share token resolve failed");
}

async function request<T>(
	cfg: UmamiShareConfig,
	path: string,
	params: Record<string, string | number>,
): Promise<T> {
	const share = await resolveShareToken(cfg);

	const query = new URLSearchParams(
		Object.entries(params).map(([k, v]) => [k, String(v)]),
	).toString();
	const url = `${share.base}/api/websites/${share.websiteId}/${path}?${query}`;

	try {
		const raw = sessionStorage.getItem(DATA_CACHE_PREFIX + url);
		if (raw) {
			const entry = JSON.parse(raw) as DataCacheEntry;
			if (Date.now() - entry.t < DATA_CACHE_TTL) return entry.json as T;
		}
	} catch {
		// sessionStorage 不可用时直接请求
	}

	const res = await fetch(url, {
		headers: {
			Accept: "application/json",
			"x-umami-share-token": share.token,
			// 现版 Umami 鉴权要求分享令牌请求附带该上下文头
			"x-umami-share-context": "1",
		},
	});
	if (!res.ok) {
		throw new Error(`Umami API ${res.status}: ${path}`);
	}
	const json = (await res.json()) as T;

	try {
		sessionStorage.setItem(
			DATA_CACHE_PREFIX + url,
			JSON.stringify({ t: Date.now(), json } satisfies DataCacheEntry),
		);
	} catch {
		// 缓存写失败不影响结果
	}

	return json;
}

/** 汇总统计（PV / UV / 访次），兼容新旧两种返回结构 */
export async function fetchSummary(
	cfg: UmamiShareConfig,
	startAt: number,
	endAt: number,
): Promise<UmamiSummary> {
	const data = await request<{
		pageviews: number | { value: number };
		visitors: number | { value: number };
		visits: number | { value: number };
	}>(cfg, "stats", { startAt, endAt });

	const num = (v: number | { value: number } | undefined) =>
		typeof v === "number" ? v : (v?.value ?? 0);

	return {
		pageviews: num(data.pageviews),
		visitors: num(data.visitors),
		visits: num(data.visits),
	};
}

/** 按天的时间序列，用于趋势图 */
export async function fetchTimeseries(
	cfg: UmamiShareConfig,
	startAt: number,
	endAt: number,
	unit: "day" | "hour" = "day",
): Promise<UmamiPoint[]> {
	const data = await request<{ pageviews: UmamiPoint[] }>(cfg, "pageviews", {
		startAt,
		endAt,
		unit,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
	});
	return data.pageviews ?? [];
}

/** 指标排行（type: path / referrer / browser / country），返回 [{ x, y }] */
export async function fetchMetrics(
	cfg: UmamiShareConfig,
	type: "path" | "referrer" | "browser" | "country",
	startAt: number,
	endAt: number,
	limit = 10,
): Promise<UmamiPoint[]> {
	const list = await request<UmamiPoint[]>(cfg, "metrics", {
		type,
		startAt,
		endAt,
		limit,
	});
	return Array.isArray(list) ? list : [];
}
