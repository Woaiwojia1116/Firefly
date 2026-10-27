import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * 首页 · 萤火 · 夜航 —— 滚动编排与氛围特效
 *
 * 设计原则：
 * - 桌面端「一条连续镜头」：首屏拱窗灯笼展开铺满（pin + clip-path 展宽），
 *   压暗后收窗成「关于我」的横窗。收窗目标每帧读取真实窗体的
 *   getBoundingClientRect，滚到哪儿窗就在哪儿 —— 首屏和关于我是同一个镜头。
 * - 「最新文章」为静态的主卡 + 行卡布局：滚入视口时一次性进场 ——
 *   标题遮罩上移 → 主卡显影（模糊暗场 → 对焦）→ 文字逐层落定 →
 *   行卡错峰上浮、分隔线从左向右展开。
 * - 「分类与入口」Q 弹落子：elastic 过冲 + 随机错峰，只播一次不复位。
 * - 氛围层：雨丝（三层景深）+ 星空不规则微闪 + 稀有流星（仅夜色、仅首屏附近），
 *   窗玻璃水珠只画在窗内 canvas 上 —— 被遮罩约束，绝不全屏乱飘。
 * - 不碰布局属性：portal 恒为满屏，收缩只动 clip-path（paint）；
 *   reduce-motion / 无 JS / 移动端窄屏时舞台隐藏，内容按文档流静态呈现。
 * - 清理：astro:before-swap 时 revert 全部 context / matchMedia，
 *   由 Swup 重新渲染后再初始化，避免重复绑定与 pin-spacer 残留。
 */

const DESKTOP_QUERY = "(min-width: 900px)";
const MOBILE_QUERY = "(max-width: 899px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const TAU = Math.PI * 2;

let ctx: gsap.Context | null = null;
let mm: gsap.MatchMedia | null = null;
let cleanups: Array<() => void> = [];
let refreshToken = 0;

function addCleanup(fn: () => void) {
	cleanups.push(fn);
}

function rand(a: number, b: number) {
	return a + Math.random() * (b - a);
}

/* ══ 氛围层：雨 + 星空 + 流星 + 窗玻璃水珠 ═════════════════════════════ */

type Drop = {
	x: number;
	y: number;
	sp: number;
	len: number;
	a: number;
	far: boolean;
};

type Star = {
	x: number;
	y: number;
	r: number;
	ph: number;
	f: number;
	b: number;
};

type GlassDrop = {
	u: number;
	y: number;
	sp: number;
	ph: number;
	r: number;
};

function startAmbient(root: HTMLElement, reduced: boolean): () => void {
	const canvas = root.querySelector<HTMLCanvasElement>(
		"[data-fyh-ambient]",
	);
	if (!canvas) return () => {};
	const g2d = canvas.getContext("2d");
	if (!g2d) return () => {};

	const glassCanvas = root.querySelector<HTMLCanvasElement>(
		"[data-fyh-glass]",
	);
	const glass2d = glassCanvas?.getContext("2d") ?? null;

	let W = 0;
	let H = 0;
	let drops: Drop[] = [];
	let stars: Star[] = [];
	let glass: GlassDrop[] = [];
	let isDark = document.documentElement.classList.contains("dark");

	const makeField = () => {
		const scale = window.innerWidth < 900 ? 0.5 : 1;
		const defs = [
			{
				n: Math.max(18, Math.round(((W * H) / 9000) * scale)),
				sp: [110, 150],
				len: [9, 14],
				a: [0.05, 0.11],
				far: true,
			},
			{
				n: Math.max(10, Math.round(((W * H) / 17000) * scale)),
				sp: [190, 240],
				len: [16, 22],
				a: [0.1, 0.18],
				far: false,
			},
			{
				n: Math.max(6, Math.round(((W * H) / 32000) * scale)),
				sp: [300, 360],
				len: [26, 34],
				a: [0.16, 0.26],
				far: false,
			},
		];
		drops = [];
		for (const d of defs) {
			for (let i = 0; i < d.n; i++) {
				drops.push({
					x: rand(-40, W + 40),
					y: rand(-H, H),
					sp: rand(d.sp[0], d.sp[1]),
					len: rand(d.len[0], d.len[1]),
					a: rand(d.a[0], d.a[1]),
					far: d.far,
				});
			}
		}
		stars = [];
		const sn = Math.max(30, Math.round((W * H) / 6500));
		for (let i = 0; i < sn; i++) {
			stars.push({
				x: rand(0, W),
				y: rand(0, H * 0.9),
				r: rand(0.4, 1.1),
				ph: rand(0, TAU),
				f: rand(0.4, 1.6),
				b: rand(0.35, 0.8),
			});
		}
		glass = [];
		for (let i = 0; i < 4; i++) {
			glass.push({
				u: rand(0.06, 0.94),
				y: rand(0, 0.6),
				sp: rand(0.03, 0.07),
				ph: rand(0, TAU),
				r: rand(1.6, 3),
			});
		}
	};

	const size = () => {
		W = window.innerWidth;
		H = window.innerHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (glassCanvas) {
			const r = glassCanvas.getBoundingClientRect();
			glassCanvas.width = Math.max(2, Math.round(r.width));
			glassCanvas.height = Math.max(2, Math.round(r.height));
		}
		makeField();
	};

	/* 星空只在首屏附近出现：向下滚动后整体淡出 */
	const heroGate = () =>
		Math.max(0, 1 - window.scrollY / Math.max(1, H * 1.4));

	const starFalloff = (y: number) => {
		if (y < H * 0.55) return 1;
		return Math.max(0, 1 - (y - H * 0.55) / (H * 0.45));
	};

	let meteor: {
		x: number;
		y: number;
		vx: number;
		vy: number;
		life: number;
		max: number;
	} | null = null;
	let nextMeteor = 2600 + Math.random() * 4200;

	const drawGlass = (t: number, dt: number, rgb: string) => {
		if (!glassCanvas || !glass2d) return;
		const w = glassCanvas.width;
		const h = glassCanvas.height;
		glass2d.clearRect(0, 0, w, h);
		for (const q of glass) {
			q.y += q.sp * dt;
			if (q.y > 1.1) {
				q.y = -0.05;
				q.u = rand(0.06, 0.94);
			}
			const gx = (q.u + Math.sin(t * 0.001 + q.ph) * 0.012) * w;
			const gy = q.y * h;
			const grad = glass2d.createLinearGradient(gx, gy - 18, gx, gy);
			grad.addColorStop(0, `rgba(${rgb},0)`);
			grad.addColorStop(1, `rgba(${rgb},0.10)`);
			glass2d.strokeStyle = grad;
			glass2d.lineWidth = 1;
			glass2d.beginPath();
			glass2d.moveTo(gx, gy - 18);
			glass2d.lineTo(gx, gy);
			glass2d.stroke();
			glass2d.fillStyle = `rgba(${rgb},0.30)`;
			glass2d.beginPath();
			glass2d.arc(gx, gy, q.r, 0, TAU);
			glass2d.fill();
		}
	};

	const drawFrame = (t: number, dt: number) => {
		const rgb = isDark ? "236,229,234" : "42,35,44";
		g2d.clearRect(0, 0, W, H);

		/* 星空与流星：仅夜色、仅首屏附近 */
		if (isDark) {
			const gate = heroGate();
			if (gate > 0.02) {
				for (const s of stars) {
					const a =
						s.b *
						(0.42 +
							0.58 *
								Math.abs(
									Math.sin(t * 0.001 * s.f + s.ph) *
										Math.sin(
											t * 0.00061 * s.f * 1.7 + s.ph * 2,
										),
								)) *
						starFalloff(s.y) *
						gate;
					if (a < 0.015) continue;
					g2d.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
					g2d.beginPath();
					g2d.arc(s.x, s.y, s.r, 0, TAU);
					g2d.fill();
				}
				if (!meteor && gate > 0.3 && t > nextMeteor) {
					const ang = Math.PI * rand(0.7, 0.8);
					meteor = {
						x: W * rand(0.25, 0.95),
						y: H * rand(0.04, 0.28),
						vx: Math.cos(ang) * 540,
						vy: Math.sin(ang) * 540,
						life: 0,
						max: 0.85,
					};
				}
				if (meteor) {
					meteor.life += dt;
					meteor.x += meteor.vx * dt;
					meteor.y += meteor.vy * dt;
					const k = 1 - meteor.life / meteor.max;
					if (k <= 0) {
						meteor = null;
						nextMeteor = t + 7000 + Math.random() * 7000;
					} else {
						const tx = meteor.x - meteor.vx * 0.15;
						const ty = meteor.y - meteor.vy * 0.15;
						const grad = g2d.createLinearGradient(
							meteor.x,
							meteor.y,
							tx,
							ty,
						);
						grad.addColorStop(
							0,
							`rgba(${rgb},${(0.85 * k * gate).toFixed(3)})`,
						);
						grad.addColorStop(1, `rgba(${rgb},0)`);
						g2d.strokeStyle = grad;
						g2d.lineWidth = 1.4;
						g2d.beginPath();
						g2d.moveTo(meteor.x, meteor.y);
						g2d.lineTo(tx, ty);
						g2d.stroke();
					}
				}
			}
		}

		/* 雨丝：远中近三层景深 + 缓慢摆动的风 */
		const wind = Math.sin(t * 0.0004) * 20 + 16;
		for (const d of drops) {
			d.y += d.sp * dt;
			d.x += wind * dt * (d.far ? 0.5 : 1);
			if (d.y > H + 40) {
				d.y = rand(-80, -30);
				d.x = rand(-40, W + 40);
			}
			g2d.strokeStyle = `rgba(${rgb},${d.a.toFixed(3)})`;
			g2d.lineWidth = d.far ? 1 : 1.2;
			g2d.beginPath();
			g2d.moveTo(d.x, d.y);
			g2d.lineTo(d.x - wind * 0.05 * (d.len / 16), d.y - d.len);
			g2d.stroke();
		}

		drawGlass(t, dt, rgb);
	};

	size();

	if (reduced) {
		/* 静帧：雨丝与星空定格一帧，流星不发生 */
		drawFrame(4000, 0);
		const mo = new MutationObserver(() => {
			isDark = document.documentElement.classList.contains("dark");
			drawFrame(4000, 0);
		});
		mo.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => mo.disconnect();
	}

	let raf = 0;
	let running = false;
	let last = performance.now();

	const play = () => {
		if (running) return;
		running = true;
		last = performance.now();
		raf = requestAnimationFrame(stepLoop);
	};
	const pause = () => {
		running = false;
		cancelAnimationFrame(raf);
	};
	const stepLoop = (t: number) => {
		if (!running) return;
		const dt = Math.min(0.05, (t - last) / 1000);
		last = t;
		if (!document.hidden) drawFrame(t, dt);
		raf = requestAnimationFrame(stepLoop);
	};

	const onVisibility = () => {
		if (document.hidden) pause();
		else play();
	};
	const onResize = () => {
		size();
		if (document.hidden) drawFrame(performance.now(), 0);
	};
	const mo = new MutationObserver(() => {
		isDark = document.documentElement.classList.contains("dark");
	});
	mo.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	window.addEventListener("resize", onResize);
	document.addEventListener("visibilitychange", onVisibility);
	play();

	return () => {
		pause();
		mo.disconnect();
		window.removeEventListener("resize", onResize);
		document.removeEventListener("visibilitychange", onVisibility);
	};
}

/* ══ 01→02 · 一条连续镜头：展开铺满 → 压暗 → 收窗交接 ═════════════════ */

function buildHero(root: HTMLElement) {
	const hero = root.querySelector<HTMLElement>("[data-fyh-hero]");
	const portal = root.querySelector<HTMLElement>("[data-fyh-portal]");
	const portalOver = root.querySelector<HTMLElement>(
		"[data-fyh-portal-over]",
	);
	const dim = root.querySelector<HTMLElement>("[data-fyh-dim]");
	const heroWin = root.querySelector<HTMLElement>("[data-fyh-hero-win]");
	const heroText = hero?.querySelector<HTMLElement>(".fyh-hero__text");
	const scrollHint = hero?.querySelector<HTMLElement>(".fyh-hero__scroll");
	const about = root.querySelector<HTMLElement>("[data-fyh-about]");
	const aboutWin = root.querySelector<HTMLElement>("[data-fyh-about-win]");
	const rim =
		portalOver?.querySelector<HTMLElement>("[data-fyh-rim]") ?? null;
	const sheen =
		portalOver?.querySelector<HTMLElement>("[data-fyh-sheen]") ?? null;
	const halo = root.querySelector<HTMLElement>("[data-fyh-halo]");
	const caption = hero?.querySelector<HTMLElement>(".fyh-hero__winlabel");
	if (
		!hero ||
		!portal ||
		!dim ||
		!heroWin ||
		!about ||
		!aboutWin ||
		!heroText
	) {
		return;
	}

	const overImg = portalOver?.querySelector("img") ?? null;
	const underWrap = root.querySelector<HTMLElement>(
		".fyh-stage__img:not(.fyh-stage__img--over)",
	);
	const underImg = underWrap?.querySelector("img") ?? null;

	const imgRatio = (img: HTMLImageElement | null) =>
		img && img.naturalWidth > 0
			? img.naturalWidth / img.naturalHeight
			: 16 / 9;

	type Box = { x: number; y: number; w: number; h: number };

	/* 元素内框（去掉 1px 边框）在视口中的实时矩形 */
	const innerRect = (el: HTMLElement): Box => {
		const r = el.getBoundingClientRect();
		return {
			x: r.left + 1,
			y: r.top + 1,
			w: Math.max(2, r.width - 2),
			h: Math.max(2, r.height - 2),
		};
	};

	/* 竖窗在 pin 状态下的视口矩形：纵向取文档偏移差，横向不受滚动影响。
	   竖窗已无边框（羽化遮罩负责轮廓），直接取外框矩形 */
	const winRectAtPin = (): Box => {
		const docTop = (el: HTMLElement) =>
			el.getBoundingClientRect().top + window.scrollY;
		return {
			x: heroWin.getBoundingClientRect().left,
			y: docTop(heroWin) - docTop(hero),
			w: Math.max(2, heroWin.offsetWidth),
			h: Math.max(2, heroWin.offsetHeight),
		};
	};

	const viewRect = (): Box => ({
		x: 0,
		y: 0,
		w: window.innerWidth,
		h: window.innerHeight,
	});

	/* 按比例把图片适配进一个矩形：contain 完整显示 / cover 铺满；
	   focus 为裁切焦点（object-position 语义），铺满竖窗时对准人物 */
	const fitBox = (
		rect: Box,
		ratio: number,
		mode: "contain" | "cover",
		focusX = 0.5,
		focusY = 0.5,
	) => {
		const w =
			mode === "contain"
				? Math.min(rect.w, rect.h * ratio)
				: Math.max(rect.w, rect.h * ratio);
		const h = w / ratio;
		return {
			left: rect.x + (rect.w - w) * focusX,
			top: rect.y + (rect.h - h) * focusY,
			width: w,
			height: h,
		};
	};

	const insetOf = (rect: Box, radius: number | string) => {
		const W = window.innerWidth;
		const H = window.innerHeight;
		const top = Math.max(0, rect.y);
		const right = Math.max(0, W - rect.x - rect.w);
		const bottom = Math.max(0, H - rect.y - rect.h);
		const left = Math.max(0, rect.x);
		const r =
			typeof radius === "number"
				? radius > 0.5
					? `${radius.toFixed(1)}px`
					: ""
				: radius;
		return `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px${r ? ` round ${r}` : ""})`;
	};

	/* 拱窗圆角：上两角为半圆拱，下两角小圆角；k 随展开收敛到 0 */
	const archRadius = (w: number, k: number): string => {
		const r = (w / 2) * k;
		return `${r.toFixed(1)}px ${r.toFixed(1)}px ${(14 * k).toFixed(1)}px ${(14 * k).toFixed(1)}px`;
	};

	/* 读取 img 的 object-position 百分比（ImageWrapper 以内联样式写入） */
	const imgFocus = (img: HTMLImageElement | null) => {
		if (!img) return { fx: 0.5, fy: 0.5 };
		const pos =
			img.style.objectPosition || getComputedStyle(img).objectPosition || "";
		const m = pos.match(/([\d.]+)%\s+([\d.]+)%/);
		return m
			? { fx: parseFloat(m[1]) / 100, fy: parseFloat(m[2]) / 100 }
			: { fx: 0.5, fy: 0.5 };
	};

	/* 拱窗描边与玻璃高光：矩形 / 圆角 / 透明度与 clip 逐帧同步 */
	const placeRim = (box: Box, radius: string, opacity = 1) => {
		const css = {
			left: `${box.x.toFixed(1)}px`,
			top: `${box.y.toFixed(1)}px`,
			width: `${box.w.toFixed(1)}px`,
			height: `${box.h.toFixed(1)}px`,
			borderRadius: radius,
			opacity: opacity.toFixed(3),
		};
		if (rim) Object.assign(rim.style, css);
		if (sheen) Object.assign(sheen.style, css);
	};

	const setBox = (
		img: HTMLImageElement | null,
		box: { left: number; top: number; width: number; height: number },
	) => {
		if (!img) return;
		img.style.left = `${box.left.toFixed(1)}px`;
		img.style.top = `${box.top.toFixed(1)}px`;
		img.style.width = `${box.width.toFixed(1)}px`;
		img.style.height = `${box.height.toFixed(1)}px`;
	};

	root.classList.add("fyh-live");

	const focus = imgFocus(overImg);
	const haloBase = halo
		? parseFloat(getComputedStyle(halo).opacity || "0.8") || 0.8
		: 0;

	const winClipStart = () => {
		const rect = winRectAtPin();
		return insetOf(rect, archRadius(rect.w, 1));
	};
	/* 窗内初始画面：cover 铺满拱窗（与静态拱窗一致），焦点对准人物 */
	const heroStartBox = () =>
		fitBox(winRectAtPin(), imgRatio(overImg), "cover", focus.fx, focus.fy);
	/* 展开铺满：焦点随展开缓慢回到正中（一次轻微的推镜） */
	const heroCoverBox = (e: number) =>
		fitBox(
			viewRect(),
			imgRatio(overImg),
			"cover",
			focus.fx + (0.5 - focus.fx) * e,
			focus.fy + (0.5 - focus.fy) * e,
		);

	gsap.set(portal, { clipPath: winClipStart() });
	setBox(overImg, heroStartBox());
	placeRim(winRectAtPin(), archRadius(winRectAtPin().w, 1));

	/* 阶段 A：窗内完整显示整张照片 → 展开铺满。
	   clip / 图片盒 / 压暗改为直写（不经 scrub 补间），并用 bProgress 守卫：
	   阶段 B 一旦接管（快速滚动时两个触发器同帧跨越），阶段 A 不再回写，
	   否则 A 的平滑补间会把 B 已写好的收拢状态覆盖回全屏，留下整屏残影。 */
	let bProgress = 0;

	const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;
	const lerpBox = (
		a: { left: number; top: number; width: number; height: number },
		b: { left: number; top: number; width: number; height: number },
		t: number,
	) => ({
		left: lerpNum(a.left, b.left, t),
		top: lerpNum(a.top, b.top, t),
		width: lerpNum(a.width, b.width, t),
		height: lerpNum(a.height, b.height, t),
	});

	const applyPhaseA = (progress: number) => {
		if (bProgress > 0) return;
		const p = Math.min(1, Math.max(0, progress));
		const e0 = Math.min(1, Math.max(0, p / 0.55));
		const e = e0 * e0 * (3 - 2 * e0);
		const from = winRectAtPin();
		const to = viewRect();
		const box = {
			x: lerpNum(from.x, to.x, e),
			y: lerpNum(from.y, to.y, e),
			w: lerpNum(from.w, to.w, e),
			h: lerpNum(from.h, to.h, e),
		};
		portal.style.clipPath = insetOf(box, archRadius(box.w, 1 - e));
		setBox(overImg, lerpBox(heroStartBox(), heroCoverBox(e), e));
		/* 拱窗描边与玻璃高光跟随窗框，展开到近满屏时淡出 */
		placeRim(
			box,
			archRadius(box.w, 1 - e),
			Math.min(1, Math.max(0, 1 - (e - 0.82) / 0.18)),
		);
		/* 灯晕随展开淡出：窗变成世界，光晕便不再需要 */
		if (halo) {
			halo.style.opacity = (haloBase * (1 - Math.min(1, p / 0.7))).toFixed(3);
		}
		dim.style.opacity = (
			0.62 * Math.min(1, Math.max(0, (p - 0.58) / 0.3))
		).toFixed(3);
	};

	gsap
		.timeline({
			defaults: { ease: "none" },
			scrollTrigger: {
				trigger: hero,
				start: "top top",
				end: "+=130%",
				scrub: 0.6,
				pin: true,
				anticipatePin: 1,
				invalidateOnRefresh: true,
				onUpdate: (self) => applyPhaseA(self.progress),
				onRefresh: (self) => {
					if (self.progress > 0) applyPhaseA(self.progress);
				},
			},
		})
		.to(scrollHint ?? {}, { opacity: 0, duration: 0.08 }, 0)
		.to(caption ?? {}, { opacity: 0, duration: 0.2 }, 0.05)
		.to(
			heroText,
			{ yPercent: -14, opacity: 0, duration: 0.24, ease: "power1.in" },
			0.05,
		);

	/* 阶段 B：收窗 —— 从满屏对当前窗体矩形做插值收缩（目标实时跟随窗体），
	   底层窗图始终按当前窗框 cover 适配，与真窗像素重合时交叉淡入；
	   反向滚动全程可逆 */
	const applyPhaseB = (progress: number) => {
		const p = Math.min(1, Math.max(0, progress));
		bProgress = p;
		const e = p * p * (3 - 2 * p);
		const r = innerRect(aboutWin);
		const W = window.innerWidth;
		const H = window.innerHeight;
		const x = e * r.x;
		const y = e * r.y;
		const w = W + e * (r.w - W);
		const h = H + e * (r.h - H);
		portal.style.clipPath = insetOf({ x, y, w, h }, e * 8);
		setBox(underImg, fitBox({ x, y, w, h }, imgRatio(underImg), "cover"));
		if (underWrap) underWrap.style.opacity = p > 0.02 ? "1" : "0";
		dim.style.opacity = (0.62 - 0.44 * e).toFixed(3);
		if (portalOver) {
			portalOver.style.opacity =
				p > 0.72
					? Math.max(0, 1 - (p - 0.72) / 0.18).toFixed(3)
					: "1";
		}
		aboutWin.style.opacity =
			p > 0.86 ? Math.min(1, (p - 0.86) / 0.14).toFixed(3) : "0";
	};

	const tlB = gsap.timeline({
		scrollTrigger: {
			trigger: about,
			start: "top bottom",
			end: "top 12%",
			scrub: 0.55,
			invalidateOnRefresh: true,
			onUpdate: (self) => applyPhaseB(self.progress),
			onRefresh: (self) => {
				if (self.progress > 0) applyPhaseB(self.progress);
			},
		},
	});
	tlB.to({}, { duration: 1, ease: "none" });

	/* 收窗完成后「关于我」还会继续上移：粘贴触发器让 portal 每帧跟随真实窗体，
	   直到整段离开视口（clip 随窗体上移自然收拢为空）。
	   没有这一层，固定的 portal 会冻在最后一次的位置，在后续板块背景上留下残影；
	   深链接直接落在文章区时（scroll 恢复在页面下部），onRefresh 也会把状态粘贴对。 */
	ScrollTrigger.create({
		trigger: about,
		start: "top 10%",
		end: "bottom top",
		onEnter: () => applyPhaseB(1),
		onEnterBack: () => applyPhaseB(1),
		onUpdate: () => applyPhaseB(1),
		onRefresh: (self) => {
			if (self.isActive || self.progress === 1) applyPhaseB(1);
		},
	});
}

/* ══ 入场：一段编排好的「浮现」—— 眉标 → 标题逐行 → 图片从模糊中显影 ══ */

function buildIntro(root: HTMLElement) {
	const hero = root.querySelector<HTMLElement>("[data-fyh-hero]");
	if (!hero) return;

	const eyebrow = hero.querySelector<HTMLElement>(".fyh-eyebrow");
	const lines = gsap.utils.toArray<HTMLElement>(".fyh-hero__line-in", hero);
	const sub = hero.querySelector<HTMLElement>(".fyh-hero__sub");
	const scrollHint = hero.querySelector<HTMLElement>(".fyh-hero__scroll");
	const extras = gsap.utils.toArray<HTMLElement>(".fyh-extra", hero);
	const stageOver = root.querySelector<HTMLElement>(
		"[data-fyh-portal-over]",
	);
	const win = root.querySelector<HTMLElement>("[data-fyh-hero-win]");
	const halo = root.querySelector<HTMLElement>("[data-fyh-halo]");

	/* 桌面端动画作用于 portal 的图片层（真正可见的那个），移动端作用于窗体 */
	const media =
		root.classList.contains("fyh-live") && stageOver ? stageOver : win;

	const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
	if (eyebrow) {
		tl.fromTo(
			eyebrow,
			{ opacity: 0, y: 8 },
			{ opacity: 1, y: 0, duration: 0.5 },
			0.1,
		);
	}
	if (lines.length > 0) {
		tl.fromTo(
			lines,
			{ yPercent: 112 },
			{ yPercent: 0, duration: 0.85, stagger: 0.09, ease: "power3.out" },
			0.2,
		);
	}
	if (media) {
		/* 点灯：画面从夜里慢慢显影（暗 → 亮、模糊 → 聚焦），而不是「贴上来」 */
		tl.fromTo(
			media,
			{ opacity: 0, scale: 1.045, filter: "blur(16px) brightness(0.3)" },
			{
				opacity: 1,
				scale: 1,
				filter: "blur(0px) brightness(1)",
				duration: 1.25,
			},
			0.32,
		);
	}
	if (halo && window.scrollY < 80) {
		/* 灯晕随点灯绽放，之后回到呼吸态 */
		const base =
			parseFloat(getComputedStyle(halo).opacity || "0.8") || 0.8;
		tl.fromTo(
			halo,
			{ opacity: 0, scale: 0.86 },
			{ opacity: base, scale: 1, duration: 1.6, ease: "power2.out" },
			0.42,
		);
	}
	if (sub) {
		tl.fromTo(
			sub,
			{ opacity: 0, y: 10 },
			{ opacity: 1, y: 0, duration: 0.6 },
			0.62,
		);
	}
	if (extras.length > 0) {
		/* 其余首屏元素（CTA / 便签 / 拍立得 / 窗注 / 快捷卡片）错峰浮现 */
		tl.fromTo(
			extras,
			{ opacity: 0, y: 16 },
			{ opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power2.out" },
			0.85,
		);
	}
	if (scrollHint) {
		tl.fromTo(
			scrollHint,
			{ opacity: 0 },
			{ opacity: 1, duration: 0.6 },
			1.0,
		);
	}
}

/* ══ 03 · 最新文章：主卡显影，行卡错峰登记 ═════════════════════════════
   与首屏「点灯」同一手法：封面从模糊暗场里显影，标题遮罩上移，
   日期 / 标题 / 分类逐层落定；行卡错峰上浮，分隔线从左向右展开。
   初始隐藏态用 gsap.set 预置（时间轴后段的 from 状态不保证立即渲染）。 */

function buildArticles(root: HTMLElement) {
	const section = root.querySelector<HTMLElement>("[data-fyh-articles]");
	if (!section) return;

	const titleIn = section.querySelector<HTMLElement>(".fyh-mask__in");
	const desc = section.querySelector<HTMLElement>(".fyh-head-desc");
	const more = section.querySelector<HTMLElement>(".fyh-more");
	const lead = section.querySelector<HTMLElement>(".fyh-lead");
	const cover = lead?.querySelector<HTMLElement>(
		".fyh-lead__cover img, .fyh-lead__fallback",
	);
	const bandItems = lead
		? Array.from(
				lead.querySelectorAll<HTMLElement>(
					".fyh-lead__date, .fyh-lead__title, .fyh-lead__cat",
				),
			)
		: [];
	const rows = Array.from(
		section.querySelectorAll<HTMLElement>(".fyh-side__row"),
	);

	/* 预置初始态：被编排的元素先藏好，滚动到位后按序落定 */
	if (titleIn) gsap.set(titleIn, { yPercent: 110 });
	if (desc) gsap.set(desc, { opacity: 0, y: 12 });
	if (more) gsap.set(more, { opacity: 0, y: 10 });
	if (lead) gsap.set(lead, { opacity: 0, y: 28 });
	if (cover) {
		gsap.set(cover, {
			scale: 1.08,
			filter: "blur(14px) brightness(0.4)",
		});
	}
	if (bandItems.length > 0) {
		gsap.set(bandItems, { opacity: 0, y: 14 });
	}
	if (rows.length > 0) {
		gsap.set(rows, { opacity: 0, y: 26, "--fy-rule-x": 0 });
	}

	const tl = gsap.timeline({
		defaults: { ease: "power3.out" },
		scrollTrigger: {
			trigger: section,
			start: "top 74%",
			once: true,
		},
	});

	if (titleIn) {
		tl.to(titleIn, { yPercent: 0, duration: 0.7 }, 0);
	}
	if (desc) {
		tl.to(desc, { opacity: 1, y: 0, duration: 0.6 }, 0.18);
	}
	if (more) {
		tl.to(more, { opacity: 1, y: 0, duration: 0.6 }, 0.26);
	}
	if (lead) {
		/* 主卡显影：整卡上浮，封面从夜色模糊里对焦点亮 */
		tl.to(lead, { opacity: 1, y: 0, duration: 0.8 }, 0.1);
		if (cover) {
			tl.to(
				cover,
				{
					scale: 1,
					filter: "blur(0px) brightness(1)",
					duration: 1.15,
					ease: "power2.out",
					/* 清掉行内样式，把 transform 还给 CSS 的 hover 缩放；
					   只清这两项 —— object-position 是服务端写入的裁切焦点，不能动 */
					onComplete: () =>
						gsap.set(cover, { clearProps: "transform,filter" }),
				},
				0.1,
			);
		}
		if (bandItems.length > 0) {
			tl.to(
				bandItems,
				{ opacity: 1, y: 0, duration: 0.6, stagger: 0.1 },
				0.55,
			);
		}
	}
	if (rows.length > 0) {
		tl.to(
			rows,
			{ opacity: 1, y: 0, duration: 0.66, stagger: 0.12 },
			0.34,
		);
		tl.to(
			rows,
			{ "--fy-rule-x": 1, duration: 0.7, stagger: 0.12, ease: "power2.out" },
			0.42,
		);
	}
}

/* ══ 04 · 夜航站牌：翻牌入场，只播一次不复位 ═════════════════════════ */

function buildEntries(root: HTMLElement) {
	const section = root.querySelector<HTMLElement>("[data-fyh-entries]");
	const rows = Array.from(
		root.querySelectorAll<HTMLElement>("[data-fyh-tile]"),
	);
	if (!section || rows.length === 0) return;

	ScrollTrigger.create({
		trigger: section,
		start: "top 78%",
		once: true,
		onEnter: () => {
			gsap.fromTo(
				rows,
				{
					rotationX: -82,
					autoAlpha: 0,
					transformPerspective: 700,
					transformOrigin: "50% 0%",
				},
				{
					rotationX: 0,
					autoAlpha: 1,
					duration: 0.55,
					ease: "power3.out",
					stagger: 0.09,
					overwrite: "auto",
				},
			);
		},
	});
}

/* ══ 通用：正文要素的轻量进场（一次性，反向不复位） ═══════════════════ */

function buildRises(root: HTMLElement) {
	const els = gsap.utils.toArray<HTMLElement>("[data-fyh-rise]", root);
	for (const el of els) {
		gsap.fromTo(
			el,
			{ y: 22, autoAlpha: 0 },
			{
				y: 0,
				autoAlpha: 1,
				duration: 0.64,
				ease: "power3.out",
				scrollTrigger: { trigger: el, start: "top 88%", once: true },
			},
		);
	}
}

/* ══ 拱窗灯晕定位：跟随真实窗体（布局坐标，与滚动无关） ═════════════════ */

function positionHalo(root: HTMLElement) {
	const halo = root.querySelector<HTMLElement>("[data-fyh-halo]");
	const hero = root.querySelector<HTMLElement>("[data-fyh-hero]");
	const win = root.querySelector<HTMLElement>("[data-fyh-hero-win]");
	if (!halo || !hero || !win) return;
	const w = win.offsetWidth;
	const h = win.offsetHeight;
	if (!w || !h) return;
	const size = Math.max(w, h) * 2.3;
	halo.style.width = `${size.toFixed(0)}px`;
	halo.style.height = `${size.toFixed(0)}px`;
	halo.style.left = `${(hero.offsetLeft + win.offsetLeft + w / 2 - size / 2).toFixed(0)}px`;
	halo.style.top = `${(hero.offsetTop + win.offsetTop + h / 2 - size / 2).toFixed(0)}px`;
}

/* ══ 舞台行内样式清理 ═══════════════════════════════════════════════
   阶段 A/B 会直写一批行内样式（clip / 盒子 / 透明度），context 不管理它们；
   图片元素只清盒子四项 —— SSR 写入的 object-position 是裁切焦点的数据源，
   整个 removeAttribute 会把它一起抹掉，导致首屏裁切焦点失效。 */
function clearStageInlineStyles(root: HTMLElement, includeHalo: boolean) {
	const selectors = [
		"[data-fyh-portal]",
		"[data-fyh-dim]",
		"[data-fyh-portal-over]",
		"[data-fyh-about-win]",
		"[data-fyh-rim]",
		"[data-fyh-sheen]",
		".fyh .fyh-stage__img",
	];
	if (includeHalo) selectors.push("[data-fyh-halo]");
	root.querySelectorAll(selectors.join(", ")).forEach((el) =>
		(el as HTMLElement).removeAttribute("style"),
	);
	root.querySelectorAll<HTMLElement>(".fyh .fyh-stage__img img").forEach(
		(img) => {
			img.style.left = "";
			img.style.top = "";
			img.style.width = "";
			img.style.height = "";
		},
	);
}

/* ══ 初始化 / 清理 ═══════════════════════════════════════════════════ */

function destroy() {
	for (const fn of cleanups) fn();
	cleanups = [];
	refreshToken += 1;

	mm?.revert();
	mm = null;
	ctx?.revert();
	ctx = null;

	const root = document.querySelector<HTMLElement>("[data-fyh]");
	if (root) {
		root.classList.remove("fyh-live");
		clearStageInlineStyles(root, true);
	}
}

function refreshWhenReady(root: HTMLElement) {
	const token = ++refreshToken;
	const images = Array.from(root.querySelectorAll("img"));
	const pending = images
		.filter((img) => !img.complete)
		.map(
			(img) =>
				new Promise<void>((resolve) => {
					img.addEventListener("load", () => resolve(), {
						once: true,
					});
					img.addEventListener("error", () => resolve(), {
						once: true,
					});
				}),
		);

	const fontsReady = document.fonts?.ready ?? Promise.resolve();

	Promise.all([Promise.all(pending), fontsReady]).then(() => {
		if (token !== refreshToken) return;
		if (!root.isConnected) return;
		ScrollTrigger.refresh();
		positionHalo(root);
	});
}

function init() {
	destroy();

	const root = document.querySelector<HTMLElement>("[data-fyh]");
	if (!root) return;

	const reduce = window.matchMedia(REDUCED_QUERY).matches;

	/* 氛围层常开：reduce 时渲染静帧 */
	addCleanup(startAmbient(root, reduce));

	/* 灯晕定位：布局坐标，窗口尺寸变化与字体/图片就绪后都要重算 */
	const onHaloResize = () => positionHalo(root);
	window.addEventListener("resize", onHaloResize);
	addCleanup(() => window.removeEventListener("resize", onHaloResize));
	positionHalo(root);

	if (reduce) return;

		ctx = gsap.context(() => {
			mm = gsap.matchMedia();
			mm.add(DESKTOP_QUERY, () => {
				buildHero(root);
				buildArticles(root);
				buildRises(root);
				buildEntries(root);
				buildIntro(root);
				/* 跨过 900px 断点时清干净现场：
				   fyh-live / 直写样式不随 context 自动还原，
				   残留会让移动端的真窗一直隐藏、舞台残影错位 */
				return () => {
					root.classList.remove("fyh-live");
					clearStageInlineStyles(root, false);
				};
			});
			mm.add(MOBILE_QUERY, () => {
				buildArticles(root);
				buildRises(root);
				buildEntries(root);
				buildIntro(root);
			});
		}, root);

	refreshWhenReady(root);
}

export function initHomeCinematic() {
	const win = window as Window & { __fyhCinematicBound?: boolean };

	if (!win.__fyhCinematicBound) {
		win.__fyhCinematicBound = true;
		document.addEventListener("astro:page-load", init);
		document.addEventListener("astro:before-swap", destroy);
	}

	init();
}
