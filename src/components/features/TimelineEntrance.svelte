<script lang="ts">
import { onMount, tick } from "svelte";

/* ================================================================
     Swup 类型
     ================================================================ */
interface SwupHooks {
	on(event: string, cb: (...args: any[]) => void): void;
	off(event: string, cb: (...args: any[]) => void): void;
}

/* ================================================================
     状态 —— Svelte 5 $state runes
     ================================================================ */
// 覆盖层立即显示（opacity: 1），仅通过 leaving 触发淡出
let show = $state(false);
let leaving = $state(false);

// ── 阶段状态 ──
let spinnerVisible = $state(true);
let riverActive = $state(false);
let lineExtending = $state(false);
let lineFading = $state(false);
let charExpandActive = $state(false);
let yearAnimating = $state(false);
let currentYear = $state(2000);
let yearStr = $state("2000");

// 字符拆分：预计算每个位置的字号（1.8rem ~ 3.2rem 随机，动画期间不变）
let charSizes: number[] = $state([]);
function rollCharSizes(len: number) {
	charSizes = Array.from({ length: len }, () => 2.0 + Math.random() * 0.6);
}

const START_YEAR = 2000;
const END_YEAR = new Date().getFullYear();

// 翻页钟
let clockVisible = $state(false);
let digits = $state(["0", "0", ":", "0", "0", ":", "0", "0"]);
let beat = $state(false);
let colonBlink = $state(false);

/* ================================================================
     定时器 & sleep
     ================================================================ */
let timers: ReturnType<typeof setTimeout>[] = [];

function schedule(ms: number, fn: () => void) {
	const id = setTimeout(fn, ms);
	timers.push(id);
	return id;
}

function clearTimers() {
	for (const id of timers) clearTimeout(id);
	timers = [];
}

const sleep = (ms: number) => new Promise<void>((r) => schedule(ms, r));

/* ================================================================
     共享尺寸
     ================================================================ */
let W = 0;
let H = 0;

function updateSize() {
	W = window.innerWidth;
	H = window.innerHeight;
}

/* ═══════════════════════════════════════════════════════════════
     Canvas 1 —— 连续渐变旋涡 Spinner（530 粒子）
     ═══════════════════════════════════════════════════════════════ */
let vortexCanvas: HTMLCanvasElement | undefined;
let vortexCtx: CanvasRenderingContext2D | null = null;
let vortexRaf: number | null = null;
let vortexAlpha = $state(1);

// ── 统一旋涡粒子：所有属性按半径连续插值 ──
interface VortexParticle {
	angle: number;
	radius: number;
	angularSpeed: number;
	radialSpeed: number;
	radialPhase: number;
	size: number;
	color: string;
	alpha: number;
	trail: { x: number; y: number }[];
	maxTrail: number;
	spiralStrength: number;
}

// ── 外围雾状粒子 ──
interface MistParticle {
	angle: number;
	radius: number;
	angularSpeed: number;
	size: number;
	color: string;
	alpha: number;
}

let vortexParticles: VortexParticle[] = [];
let mistParticles: MistParticle[] = [];

const VORTEX_COUNT = 380;
const MIST_COUNT = 150;
const VORTEX_ARMS = 3;

// 径向颜色加权选取（nr = 归一化半径，0=中心 1=边缘）
function pickColor(nr: number): string {
	const r = Math.random();
	if (nr < 0.15) {
		// 中心：金/白为主
		return r < 0.4
			? "#FCD34D"
			: r < 0.6
				? "#FFFFFF"
				: r < 0.75
					? "#FDE68A"
					: r < 0.9
						? "#FBBF24"
						: "#38BDF8";
	}
	if (nr < 0.4) {
		// 过渡带：金/青蓝/银白均匀混合
		return r < 0.25
			? "#38BDF8"
			: r < 0.45
				? "#FCD34D"
				: r < 0.65
					? "#E2E8F0"
					: r < 0.8
						? "#FDE68A"
						: "#7DD3FC";
	}
	if (nr < 0.7) {
		// 旋臂区：青蓝/银白为主，少量金/紫
		return r < 0.3
			? "#38BDF8"
			: r < 0.5
				? "#7DD3FC"
				: r < 0.65
					? "#E2E8F0"
					: r < 0.8
						? "#0EA5E9"
						: r < 0.92
							? "#FCD34D"
							: "#C4B5FD";
	}
	// 外围：青蓝/淡紫为主，少量银白/金
	return r < 0.3
		? "#7DD3FC"
		: r < 0.5
			? "#BAE6FD"
			: r < 0.65
				? "#C4B5FD"
				: r < 0.8
					? "#38BDF8"
					: r < 0.92
						? "#E2E8F0"
						: "#FDE68A";
}

function initVortexParticles() {
	vortexParticles = [];
	mistParticles = [];
	const maxR = Math.min(W, H) * 0.32;

	// ═══════════════════════════════════════════════════════════
	// 统一旋涡粒子（0 ~ maxR*0.65）：密度指数衰减，属性连续插值
	// ═══════════════════════════════════════════════════════════
	for (let i = 0; i < VORTEX_COUNT; i++) {
		// 密度指数衰减：越靠近中心粒子越密
		const nr = 1 - Math.random() ** 0.35;

		// 螺旋结构强度：中心弱（无旋臂），中间强，外围弱
		const spiralStrength =
			nr < 0.12
				? (nr / 0.12) * 0.15
				: nr < 0.6
					? 0.15 + ((nr - 0.12) / 0.48) * 0.85
					: 1.0 - ((nr - 0.6) / 0.4) * 0.6;

		// 螺旋角度偏移
		const armBase = ((i % VORTEX_ARMS) / VORTEX_ARMS) * Math.PI * 2;
		const twist = nr * Math.PI * 3.0 * spiralStrength;
		const scatter =
			(1 - spiralStrength) * (Math.random() - 0.5) * Math.PI * 1.5;
		const angle = armBase + twist + scatter;

		const r = nr * maxR * 0.65;

		// 角速度：中心快 → 边缘慢
		const angularSpeed = 0.05 * (1 - nr) + 0.01 * nr;

		// 径向速度：中心呼吸式微动，外围向外扩散
		const radialSpeed = nr < 0.15 ? 0 : 0.05 + nr * 0.7;

		// 尺寸：中心较大 → 中段较小 → 边缘较大（U 形）
		const size = nr < 0.2 ? 1.3 - nr * 2.5 : 0.6 + nr * 0.7;

		// 透明度：中心亮 → 边缘暗
		const alpha = 0.85 - nr * 0.6;

		// 拖尾长度：中心无 → 中段短 → 边缘长
		const maxTrail = nr < 0.1 ? 0 : nr < 0.3 ? 3 : nr < 0.5 ? 5 : 7;

		vortexParticles.push({
			angle,
			radius: r,
			angularSpeed,
			radialSpeed,
			radialPhase: Math.random() * Math.PI * 2,
			size,
			color: pickColor(nr),
			alpha: alpha * (0.6 + Math.random() * 0.4),
			trail: [],
			maxTrail,
			spiralStrength,
		});
	}

	// ═══════════════════════════════════════════════════════════
	// 外围雾状粒子（maxR*0.45 ~ maxR）
	// ═══════════════════════════════════════════════════════════
	const mistMin = maxR * 0.45;
	for (let i = 0; i < MIST_COUNT; i++) {
		const r = mistMin + Math.random() * (maxR - mistMin);
		const nr = r / maxR;
		mistParticles.push({
			angle: Math.random() * Math.PI * 2,
			radius: r,
			angularSpeed: 0.004 + Math.random() * 0.01,
			size: 1.0 + Math.random() * 1.5,
			color: pickColor(nr),
			alpha: 0.08 + Math.random() * 0.12,
		});
	}
}

function drawVortexFrame() {
	if (!vortexCtx || !vortexCanvas) return;

	vortexCtx.fillStyle = "rgba(6, 4, 16, 0.12)";
	vortexCtx.fillRect(0, 0, W, H);

	const cx = W * 0.5;
	const cy = H * 0.5;
	const maxR = Math.min(W, H) * 0.32;

	// ═══════════════════════════════════════════════════════════
	// 统一旋涡粒子：按半径降序排列（外→内），单遍渲染，无缝过渡
	// ═══════════════════════════════════════════════════════════
	const sorted = [...vortexParticles].sort((a, b) => b.radius - a.radius);

	for (const p of sorted) {
		const nr = Math.max(0, Math.min(1, p.radius / (maxR * 0.65)));

		// ── 运动更新 ──
		p.angle += p.angularSpeed;

		if (nr < 0.15) {
			// 中心区：径向呼吸
			p.radialPhase += 0.04;
			const breathe = 1 + Math.sin(p.radialPhase) * 0.06;
			const baseR = p.radius / breathe; // 反推基准半径
			p.radius = (baseR || p.radius) * breathe;
		} else {
			// 外围区：向外螺旋扩散
			p.radius += p.radialSpeed;
		}

		// 边界重生
		const vMax = maxR * 0.65;
		if (p.radius > vMax || p.radius < 0.5) {
			const newNr = Math.random() ** 0.35;
			p.radius = (1 - newNr) * vMax * 0.02 + newNr * vMax;
			p.angle = Math.random() * Math.PI * 2;
			p.trail = [];
		}

		const x = cx + Math.cos(p.angle) * p.radius;
		const y = cy + Math.sin(p.angle) * p.radius * 0.55;

		// ── 拖尾 ──
		if (p.maxTrail > 0) {
			p.trail.push({ x, y });
			if (p.trail.length > p.maxTrail) p.trail.shift();
		}

		// ── alpha：中心亮 → 边缘暗（连续渐变）──
		const edgeFade = nr < 0.75 ? 1 : Math.max(0, 1 - (nr - 0.75) / 0.25);
		const alpha = p.alpha * edgeFade * vortexAlpha;
		if (alpha < 0.008) continue;

		// ── 拖尾渲染 ──
		if (p.trail.length > 2) {
			vortexCtx.beginPath();
			vortexCtx.moveTo(p.trail[0].x, p.trail[0].y);
			for (let j = 1; j < p.trail.length; j++) {
				vortexCtx.lineTo(p.trail[j].x, p.trail[j].y);
			}
			vortexCtx.strokeStyle = p.color;
			vortexCtx.lineWidth = p.size * 0.4;
			vortexCtx.globalAlpha = alpha * 0.28;
			vortexCtx.lineCap = "round";
			vortexCtx.stroke();
		}

		// ── 辉光（靠近中心更亮）──
		const glowMult = 3.0 - nr * 1.5;
		vortexCtx.globalAlpha = alpha * (0.35 - nr * 0.2);
		vortexCtx.fillStyle = p.color;
		vortexCtx.beginPath();
		vortexCtx.arc(x, y, p.size * glowMult, 0, Math.PI * 2);
		vortexCtx.fill();

		// ── 核心 ──
		vortexCtx.globalAlpha = alpha;
		vortexCtx.beginPath();
		vortexCtx.arc(x, y, p.size, 0, Math.PI * 2);
		vortexCtx.fill();
	}

	// ═══════════════════════════════════════════════════════════
	// 外围雾状粒子（笼罩光晕）
	// ═══════════════════════════════════════════════════════════
	for (const m of mistParticles) {
		m.angle += m.angularSpeed;
		const mx = cx + Math.cos(m.angle) * m.radius;
		const my = cy + Math.sin(m.angle) * m.radius * 0.55;
		vortexCtx.globalAlpha = m.alpha * vortexAlpha;
		vortexCtx.fillStyle = m.color;
		vortexCtx.beginPath();
		vortexCtx.arc(mx, my, m.size, 0, Math.PI * 2);
		vortexCtx.fill();
		vortexCtx.globalAlpha = m.alpha * 0.35 * vortexAlpha;
		vortexCtx.beginPath();
		vortexCtx.arc(mx, my, m.size * 2.5, 0, Math.PI * 2);
		vortexCtx.fill();
	}

	// ═══════════════════════════════════════════════════════════
	// 中心核：多层同心圆渐变（亮白 → 淡金 → 青蓝）
	// ═══════════════════════════════════════════════════════════
	const coreLayers = [
		{ r: 5, color: "rgba(255, 255, 255, 0.8)" },
		{ r: 10, color: "rgba(255, 250, 230, 0.5)" },
		{ r: 20, color: "rgba(252, 211, 77, 0.3)" },
		{ r: 35, color: "rgba(56, 189, 248, 0.12)" },
		{ r: 55, color: "rgba(56, 189, 248, 0.05)" },
	];
	for (const layer of coreLayers) {
		const g = vortexCtx.createRadialGradient(cx, cy, 0, cx, cy, layer.r);
		g.addColorStop(0, layer.color);
		g.addColorStop(1, "rgba(6, 4, 16, 0)");
		vortexCtx.fillStyle = g;
		vortexCtx.fillRect(cx - layer.r, cy - layer.r, layer.r * 2, layer.r * 2);
	}

	vortexCtx.globalAlpha = 1;
	vortexRaf = requestAnimationFrame(drawVortexFrame);
}

/* ═══════════════════════════════════════════════════════════════
     Canvas 2 —— 银河河流（1200 粒子，纯水平流动）
     ═══════════════════════════════════════════════════════════════ */
let riverCanvas: HTMLCanvasElement | undefined;
let riverCtx: CanvasRenderingContext2D | null = null;
let riverRaf: number | null = null;
let riverFadeIn = 0; // 0→1，河流渐显

interface RiverParticle {
	x: number;
	y: number;
	originY: number;
	size: number;
	color: string;
	baseAlpha: number;
	trail: { x: number; y: number }[];
}

let riverParticles: RiverParticle[] = [];
const RIVER_COUNT = 1200;
const MAX_TRAIL = 40;

// 中心区颜色：淡金+青蓝为主；边缘区：银白+淡青蓝
const RIVER_COLORS_CENTER = [
	"#38BDF8",
	"#0EA5E9",
	"#FCD34D",
	"#FDE68A",
	"#FBBF24",
	"#7DD3FC",
];
const RIVER_COLORS_EDGE = [
	"#E2E8F0",
	"#F1F5F9",
	"#CBD5E1",
	"#7DD3FC",
	"#38BDF8",
];

function initRiverParticles() {
	riverParticles = [];
	for (let i = 0; i < RIVER_COUNT; i++) {
		// 高斯分布：中心 H*0.5，集中在 30% ~ 70% 高度
		const gauss = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
		const rawY = H * 0.5 + gauss * H * 0.2;
		const y = Math.max(H * 0.3, Math.min(H * 0.7, rawY));
		const originY = y / H;

		// Y 轴位置归一化（0=30%边, 0.5=中心, 1=70%边）
		const ny = (originY - 0.3) / 0.4;
		const distFromCenter = Math.abs(ny - 0.5) * 2; // 0=中心, 1=边缘

		// 密度梯度：中心区域粒子更大更亮，边缘更小更暗
		const isCenter = distFromCenter < 0.5;
		const sizeMin = isCenter ? 0.6 : 0.3;
		const sizeMax = isCenter ? 1.2 : 0.7;
		const alphaMin = isCenter ? 0.3 : 0.15;
		const alphaMax = isCenter ? 0.55 : 0.35;

		// 颜色按 Y 轴渐变
		const colorPool = isCenter ? RIVER_COLORS_CENTER : RIVER_COLORS_EDGE;

		const x = Math.random() * (W + 80) - 40;

		riverParticles.push({
			x,
			y,
			originY,
			size: sizeMin + Math.random() * (sizeMax - sizeMin),
			color: colorPool[Math.floor(Math.random() * colorPool.length)],
			baseAlpha: alphaMin + Math.random() * (alphaMax - alphaMin),
			trail: [],
		});
	}
}

function drawRiverFrame() {
	if (!riverCtx || !riverCanvas) return;

	// 长拖尾清除
	riverCtx.fillStyle = "rgba(6, 4, 16, 0.055)";
	riverCtx.fillRect(0, 0, W, H);

	// 河流渐显
	if (riverFadeIn < 1) {
		riverFadeIn = Math.min(1, riverFadeIn + 0.025);
	}

	// 银河盘面星云
	riverCtx.save();
	riverCtx.translate(W * 0.5, H * 0.5);
	riverCtx.rotate(Math.PI / 7);
	riverCtx.scale(1, 0.35);
	const nebR = Math.max(W, H) * 0.55;
	const nebGrad = riverCtx.createRadialGradient(0, 0, 0, 0, 0, nebR);
	nebGrad.addColorStop(0, "rgba(56, 189, 248, 0.035)");
	nebGrad.addColorStop(0.5, "rgba(30, 27, 75, 0.018)");
	nebGrad.addColorStop(0.85, "rgba(20, 15, 50, 0.005)");
	nebGrad.addColorStop(1, "rgba(6, 4, 16, 0)");
	riverCtx.fillStyle = nebGrad;
	riverCtx.fillRect(-W, -H, W * 2, H * 2);
	riverCtx.restore();

	// 粒子
	for (const p of riverParticles) {
		p.trail.push({ x: p.x, y: p.y });
		if (p.trail.length > MAX_TRAIL) p.trail.shift();

		const nx = Math.max(0, Math.min(1, p.x / W));
		const speedMultiplier = 0.02 + nx * 14.0;

		p.x += 0.08 * speedMultiplier;

		if (p.x > W + 50) {
			p.x = -35;
			p.y = p.originY * H;
			p.trail = [];
		}

		const leftBrightness = 1.0 - nx * 0.45;

		// 拖尾
		if (p.trail.length > 4) {
			const tStart = Math.max(0, p.trail.length - MAX_TRAIL);
			riverCtx.beginPath();
			riverCtx.moveTo(p.trail[tStart].x, p.trail[tStart].y);
			for (let j = tStart + 1; j < p.trail.length; j++) {
				riverCtx.lineTo(p.trail[j].x, p.trail[j].y);
			}
			riverCtx.lineTo(p.x, p.y);

			const trailAlpha = p.baseAlpha * 0.18 * leftBrightness * riverFadeIn;
			riverCtx.strokeStyle = p.color;
			riverCtx.lineWidth = p.size * 0.4;
			riverCtx.globalAlpha = trailAlpha;
			riverCtx.lineCap = "round";
			riverCtx.lineJoin = "round";
			riverCtx.stroke();
		}

		// 核心
		const alpha = p.baseAlpha * leftBrightness * riverFadeIn;
		riverCtx.globalAlpha = alpha;
		riverCtx.fillStyle = p.color;
		riverCtx.beginPath();
		riverCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
		riverCtx.fill();
	}
	riverCtx.globalAlpha = 1;

	// Vignette
	const vig = riverCtx.createRadialGradient(
		W * 0.5,
		H * 0.5,
		Math.min(W, H) * 0.35,
		W * 0.5,
		H * 0.5,
		Math.max(W, H) * 0.8,
	);
	vig.addColorStop(0, "rgba(0, 0, 0, 0)");
	vig.addColorStop(0.55, "rgba(4, 3, 10, 0.04)");
	vig.addColorStop(0.82, "rgba(4, 3, 10, 0.2)");
	vig.addColorStop(1, "rgba(2, 1, 6, 0.55)");
	riverCtx.fillStyle = vig;
	riverCtx.fillRect(0, 0, W, H);

	riverRaf = requestAnimationFrame(drawRiverFrame);
}

/* ================================================================
     Canvas resize
     ================================================================ */
function resizeCanvases() {
	updateSize();
	if (vortexCanvas) {
		vortexCanvas.width = W;
		vortexCanvas.height = H;
	}
	if (riverCanvas) {
		riverCanvas.width = W;
		riverCanvas.height = H;
	}
}

/* ═══════════════════════════════════════════════════════════════
     主动画序列
     ═══════════════════════════════════════════════════════════════ */
async function playAnimation() {
	// 清理前次
	clearTimers();
	if (vortexRaf !== null) {
		cancelAnimationFrame(vortexRaf);
		vortexRaf = null;
	}
	if (riverRaf !== null) {
		cancelAnimationFrame(riverRaf);
		riverRaf = null;
	}

	// 覆盖层立即全屏显示（CSS 默认 opacity: 1）
	show = true;
	leaving = false;
	// 隐藏下方页面内容，防止闪烁
	document.documentElement.classList.add("tl-entrance-active");
	spinnerVisible = true;
	riverActive = false;
	riverFadeIn = 0;
	vortexAlpha = 1;
	lineExtending = false;
	lineFading = false;
	charExpandActive = false;
	yearAnimating = false;
	currentYear = START_YEAR;
	yearStr = String(START_YEAR);
	rollCharSizes(yearStr.length);
	clockVisible = false;
	colonBlink = false;
	digits = ["0", "0", ":", "0", "0", ":", "0", "0"];

	await tick();

	// 初始化尺寸
	resizeCanvases();

	// 初始化旋涡
	if (vortexCanvas) {
		vortexCtx = vortexCanvas.getContext("2d");
		if (vortexCtx) {
			vortexCtx.clearRect(0, 0, W, H);
			initVortexParticles();
		}
	}

	// ── 阶段 1：旋涡立即开始（覆盖层已完全不透明）──
	vortexRaf = requestAnimationFrame(drawVortexFrame);

	// ── 阶段 2：1.5s 后旋涡收缩淡出 ──
	await sleep(1500);
	spinnerVisible = false;

	// 等待 CSS 过渡完成
	await sleep(350);

	// 停止旋涡 Canvas
	if (vortexRaf !== null) {
		cancelAnimationFrame(vortexRaf);
		vortexRaf = null;
	}

	// ── 阶段 3：1.6s（相对），粒子河流开始 ──
	// 初始化河流粒子（全部从左侧出发）
	if (riverCanvas) {
		riverCtx = riverCanvas.getContext("2d");
		if (riverCtx) {
			riverCtx.clearRect(0, 0, W, H);
			initRiverParticles();
		}
	}
	riverActive = true;
	riverRaf = requestAnimationFrame(drawRiverFrame);

	// ── 阶段 4：竖线延展（0.4s）──
	await sleep(200);
	lineExtending = true;
	await sleep(400);

	// ── 阶段 5：字符从竖线中心"分裂"出来（0.4s），竖线同时渐隐 ──
	charExpandActive = true;
	lineFading = true;
	await sleep(400);

	// ── 阶段 6：竖线收缩消失（0.35s），完成后年份开始跳动 ──
	lineExtending = false;
	lineFading = false;
	charExpandActive = false;
	yearAnimating = true;

	// 年份跳动 2000 → 当前年（120ms/跳）
	for (let y = START_YEAR + 1; y <= END_YEAR; y++) {
		await sleep(120);
		currentYear = y;
		yearStr = String(y);
	}

	// ── 翻页钟 ──
	clockVisible = true;
	colonBlink = true;

	const now = new Date();
	const timeStr = now.toTimeString().slice(0, 8);
	for (let i = 0; i < timeStr.length; i++) {
		schedule(i * 80, () => {
			digits[i] = timeStr[i];
		});
	}
	schedule(timeStr.length * 80 + 100, () => {
		beat = true;
		schedule(200, () => {
			beat = false;
		});
	});

	// ── 停留后整体淡出 ──
	await sleep(600);
	leaving = true;

	await sleep(900);
	show = false;
	document.documentElement.classList.remove("tl-entrance-active");
	if (riverRaf !== null) {
		cancelAnimationFrame(riverRaf);
		riverRaf = null;
	}
	colonBlink = false;
}

function stopAnimation() {
	clearTimers();
	if (vortexRaf !== null) {
		cancelAnimationFrame(vortexRaf);
		vortexRaf = null;
	}
	if (riverRaf !== null) {
		cancelAnimationFrame(riverRaf);
		riverRaf = null;
	}
	colonBlink = false;
	if (!show) return;
	leaving = true;
	// 快速退出：0.4s 淡出 + 微缩放
	schedule(400, () => {
		show = false;
		leaving = false;
		document.documentElement.classList.remove("tl-entrance-active");
	});
}

/* ================================================================
     生命周期 + Swup
     ================================================================ */
onMount(() => {
	if (window.location.pathname.includes("/timeline")) {
		playAnimation();
	}

	const swup = (window as any).swup;

	// Swup 即将离开当前页面时：立即触发退出动画 + 进度条
	const onVisitStart = () => {
		if (show && !leaving) {
			stopAnimation();
		}
	};

	const onPageView = () => {
		if (window.location.pathname.includes("/timeline")) {
			playAnimation();
		} else {
			stopAnimation();
		}
	};

	if (swup?.hooks) {
		swup.hooks.on("visit:start", onVisitStart);
		swup.hooks.on("page:view", onPageView);
	}

	window.addEventListener("resize", resizeCanvases);

	return () => {
		if (swup?.hooks) {
			swup.hooks.off("visit:start", onVisitStart);
			swup.hooks.off("page:view", onPageView);
		}
		window.removeEventListener("resize", resizeCanvases);
		clearTimers();
		if (vortexRaf !== null) cancelAnimationFrame(vortexRaf);
		if (riverRaf !== null) cancelAnimationFrame(riverRaf);
	};
});
</script>

{#if show}
<div
  class="tl-entrance"
  class:fade-out={leaving}
>
  <!-- 纹理 + 星云底层 -->
  <div class="noise-layer" />
  <div class="nebula-mist" />

  <!-- Canvas 1：螺旋旋涡 Spinner -->
  <canvas
    bind:this={vortexCanvas}
    class="vortex-canvas"
    class:vortex-fading={!spinnerVisible}
  />

  <!-- Canvas 2：银河河流 -->
  <canvas
    bind:this={riverCanvas}
    class="river-canvas"
    class:river-on={riverActive}
  />

  <!-- ═══════════════════════════════════════════════════════════
       竖线 + 年份（字符拆分展开）
       ═══════════════════════════════════════════════════════════ -->
  <div class="center-stage">
    <div
      class="center-line"
      class:line-extend={lineExtending}
      class:line-fading={lineFading}
      class:line-retract={!lineExtending && !lineFading && !spinnerVisible}
    />
    <div class="year-display" class:year-animating={yearAnimating}>
      {#if charExpandActive || yearAnimating}
        {#key yearStr}
        {#each [...yearStr] as char, i}
          <span
            class="year-char char-{i % 2 === 0 ? 'left' : 'right'}"
            class:char-expand={charExpandActive}
            class:char-bounce={yearAnimating}
            style="font-size: {charSizes[i] ?? 2.4}rem; animation-delay: {i * 0.05}s;"
          >{char}</span>
        {/each}
        {/key}
      {/if}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════
       底部时间标尺
       ═══════════════════════════════════════════════════════════ -->
  <div class="bottom-rail" class:rail-visible={riverActive && !lineExtending}>
    <div class="rail-line" />
    {#each Array(9) as _, i}
      <div
        class="rail-mark"
        class:major={i === 0 || i === 4 || i === 8}
        style="left: {i * 12.5}%; animation-delay: {0.3 + i * 0.08}s;"
      >
        <div class="mark-diamond" />
      </div>
    {/each}
  </div>

  <!-- ═══════════════════════════════════════════════════════════
       顶部进度条（页面切换时 0%→100%，0.3s）
       ═══════════════════════════════════════════════════════════ -->
  <div class="top-progress" class:progress-active={leaving}>
    <div class="progress-bar" />
  </div>

  <!-- ═══════════════════════════════════════════════════════════
       翻页钟
       ═══════════════════════════════════════════════════════════ -->
  <div class="flip-clock" class:clock-visible={clockVisible}>
    {#each digits as d, i}
      <span
        class="flip-digit"
        class:colon={d === ":"}
        class:beat={beat && i === 0}
        class:blink={colonBlink && d === ":"}
      >{d}</span>
    {/each}
  </div>
</div>
{/if}

<style>
  :root {
    --tle-cyan: #38BDF8;
    --tle-bright-gold: #FCD34D;
    --tle-silver: #E2E8F0;
  }

  /* ── 容器 ── */
  .tl-entrance {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: radial-gradient(
      ellipse at 50% 45%,
      #0d1a2d 0%,
      #080c18 35%,
      #060410 60%,
      #020108 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    pointer-events: none;
    overflow: hidden;
  }
  .tl-entrance.fade-out {
    opacity: 0;
    transform: scale(0.98);
    transition: opacity 0.4s cubic-bezier(0.6, 0, 0.2, 1),
                transform 0.4s cubic-bezier(0.6, 0, 0.2, 1);
  }

  /* ── 噪点纹理 ── */
  .noise-layer {
    position: absolute;
    inset: 0;
    opacity: 0.06;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 180px 180px;
    mix-blend-mode: overlay;
    z-index: 1;
  }

  /* ── 星云辅助 ── */
  .nebula-mist {
    position: absolute;
    inset: -10%;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 40% 42%, rgba(56, 189, 248, 0.04) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 55%, rgba(15, 25, 60, 0.05) 0%, transparent 45%);
    z-index: 0;
    filter: blur(4px);
  }

  /* ── 旋涡 Canvas ── */
  .vortex-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 3;
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.5s cubic-bezier(0.6, 0, 0.2, 1),
                transform 0.5s cubic-bezier(0.6, 0, 0.2, 1);
  }
  .vortex-canvas.vortex-fading {
    opacity: 0;
    transform: scale(0.4);
  }

  /* ── 河流 Canvas ── */
  .river-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2;
    pointer-events: none;
    opacity: 0;
  }
  .river-canvas.river-on {
    opacity: 1;
  }

  /* ═════════════════════════════════════════════════════════════
     竖线 + 年份
     ═════════════════════════════════════════════════════════════ */
  .center-stage {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .center-line {
    width: 2px;
    height: 0;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(252, 211, 77, 0.7) 15%,
      #FCD34D 50%,
      rgba(252, 211, 77, 0.7) 85%,
      transparent 100%
    );
    border-radius: 1px;
    transition: height 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
    box-shadow: 0 0 8px rgba(252, 211, 77, 0.3);
  }
  .center-line.line-extend { height: 120px; }
  .center-line.line-fading {
    opacity: 0.25;
    transition: opacity 0.4s ease;
  }
  .center-line.line-retract {
    height: 0;
    transition: height 0.35s cubic-bezier(0.55, 0, 1, 0.45);
  }

  .year-display {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 0;
  }

  /* ── 单个字符 ── */
  .year-char {
    font-family: "Crimson Text", "Playfair Display", "Noto Serif SC", Georgia, serif;
    font-weight: 700;
    color: var(--tle-bright-gold);
    display: inline-block;
    text-shadow:
      0 0 20px rgba(252, 211, 77, 0.35),
      0 0 50px rgba(56, 189, 248, 0.2),
      0 0 8px rgba(255, 255, 255, 0.2),
      0 2px 6px rgba(0, 0, 0, 0.7);
    filter: drop-shadow(0 0 15px rgba(252, 211, 77, 0.3))
            drop-shadow(0 0 40px rgba(56, 189, 248, 0.2));
  }

  /* ── 偶数位：向左展开 ── */
  .year-char.char-left {
    opacity: 1;
    padding-right: 0.08em;
    transition: none;
  }
  .year-char.char-left.char-expand {
    opacity: 0;
    padding-right: 0;
    animation: char-expand-left 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  }
  @keyframes char-expand-left {
    0%   { opacity: 0; padding-right: 0; filter: blur(3px); }
    50%  { opacity: 1; filter: blur(0); }
    100% { opacity: 1; padding-right: 0.08em; filter: blur(0); }
  }

  /* ── 奇数位：向右展开 ── */
  .year-char.char-right {
    opacity: 1;
    padding-left: 0.08em;
    transition: none;
  }
  .year-char.char-right.char-expand {
    opacity: 0;
    padding-left: 0;
    animation: char-expand-right 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  }
  @keyframes char-expand-right {
    0%   { opacity: 0; padding-left: 0; filter: blur(3px); }
    50%  { opacity: 1; filter: blur(0); }
    100% { opacity: 1; padding-left: 0.08em; filter: blur(0); }
  }

  /* ── 跳动微缩放 ── */
  .year-char.char-bounce {
    animation: char-bounce 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes char-bounce {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  /* ═════════════════════════════════════════════════════════════
     底部时间标尺
     ═════════════════════════════════════════════════════════════ */
  .bottom-rail {
    position: absolute;
    bottom: 2rem;
    left: 3rem;
    right: 3rem;
    height: 30px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.6s cubic-bezier(0.6, 0, 0.2, 1);
  }
  .bottom-rail.rail-visible { opacity: 1; }

  .rail-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(56, 189, 248, 0.1) 10%,
      rgba(226, 232, 240, 0.12) 50%,
      rgba(56, 189, 248, 0.1) 90%,
      transparent
    );
    transform: translateY(-50%);
  }

  .rail-mark {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    animation: mark-appear 0.35s cubic-bezier(0.6, 0, 0.2, 1) forwards;
  }

  .mark-diamond {
    width: 4px;
    height: 4px;
    background: rgba(56, 189, 248, 0.25);
    transform: rotate(45deg);
    box-shadow: 0 0 5px rgba(56, 189, 248, 0.1);
  }

  .rail-mark.major .mark-diamond {
    width: 6px;
    height: 6px;
    background: rgba(252, 211, 77, 0.45);
    box-shadow: 0 0 10px rgba(252, 211, 77, 0.18), 0 0 3px rgba(255, 255, 255, 0.12);
    animation: mark-glow 3s ease-in-out infinite;
  }

  @keyframes mark-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(252, 211, 77, 0.1); }
    50%      { box-shadow: 0 0 14px rgba(252, 211, 77, 0.25); }
  }

  @keyframes mark-appear {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  /* ═════════════════════════════════════════════════════════════
     翻页钟
     ═════════════════════════════════════════════════════════════ */
  .flip-clock {
    position: absolute;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    gap: 2px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.7s cubic-bezier(0.6, 0, 0.2, 1);
  }
  .flip-clock.clock-visible { opacity: 1; }

  .flip-digit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 2.1rem;
    font-family: "IBM Plex Mono", "Special Elite", "Courier New", monospace;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--tle-bright-gold);
    background: linear-gradient(180deg, #141e2e 0%, #0d1522 49.5%, #070a12 50.5%, #101824 100%);
    border: 1px solid rgba(56, 189, 248, 0.1);
    border-radius: 3px;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.5),
      0 1px 0 rgba(56, 189, 248, 0.05),
      0 0 8px rgba(56, 189, 248, 0.06);
    text-shadow: 0 0 8px rgba(252, 211, 77, 0.35);
    position: relative;
    overflow: hidden;
  }

  .flip-digit::after {
    content: "";
    position: absolute;
    left: 0; right: 0; top: 49%;
    height: 1px;
    background: rgba(0, 0, 0, 0.5);
  }

  .flip-digit.colon {
    width: 0.9rem;
    background: transparent;
    border: none;
    box-shadow: none;
    font-size: 1rem;
    color: var(--tle-cyan);
    opacity: 0.5;
  }
  .flip-digit.colon::after { display: none; }
  .flip-digit.colon.blink { animation: colon-flicker 1s step-end infinite; }

  @keyframes colon-flicker {
    0%, 49%  { opacity: 0.5; }
    50%, 100% { opacity: 0.1; }
  }

  .flip-digit.beat { animation: digit-clack 0.15s ease-out; }

  @keyframes digit-clack {
    0%  { transform: translateY(0); }
    40% { transform: translateY(-2px); }
    100% { transform: translateY(0); }
  }

  /* ═════════════════════════════════════════════════════════════
     顶部进度条（页面切换时触发）
     ═════════════════════════════════════════════════════════════ */
  .top-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    z-index: 10001;
    pointer-events: none;
    opacity: 0;
  }
  .top-progress.progress-active {
    opacity: 1;
  }
  .progress-bar {
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, #FCD34D, #38BDF8, #E2E8F0);
  }
  .top-progress.progress-active .progress-bar {
    animation: progress-run 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  @keyframes progress-run {
    0%   { width: 0%; }
    100% { width: 100%; }
  }
</style>
