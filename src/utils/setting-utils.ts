import {
	BANNER_HEIGHT_EXTEND,
	DARK_MODE,
	WALLPAPER_BANNER,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import type { LIGHT_DARK_MODE, WALLPAPER_MODE } from "@/types/config";
import { backgroundWallpaper, expressiveCodeConfig } from "../config";
import { isHomePage as checkIsHomePage } from "./layout-utils";

// Declare global functions
declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

export function getDefaultHue(): number {
	const fallback = "250";
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return Number.parseInt(fallback, 10);
	}
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getDefaultTheme(): LIGHT_DARK_MODE {
	// 站点已移除亮色主题，恒为暗色
	return DARK_MODE;
}

// 获取系统主题
export function getSystemTheme(): LIGHT_DARK_MODE {
	return DARK_MODE;
}

// 解析主题（站点为纯暗色，任何模式都解析为 dark）
export function resolveTheme(_theme: LIGHT_DARK_MODE): LIGHT_DARK_MODE {
	return DARK_MODE;
}

export function getHue(): number {
	// 先检查全局对象
	if (typeof window === "undefined" || !window.localStorage) {
		return getDefaultHue();
	}
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	// 先检查是否在浏览器环境
	if (
		typeof window === "undefined" ||
		!window.localStorage ||
		typeof document === "undefined"
	) {
		return;
	}
	localStorage.setItem("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(_theme: LIGHT_DARK_MODE) {
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return;
	}

	// 站点为纯暗色主题：无论传入什么模式，目标状态恒为 dark
	const currentIsDark = document.documentElement.classList.contains("dark");
	const currentTheme = document.documentElement.getAttribute("data-theme");
	const expectedTheme = expressiveCodeConfig.darkTheme;

	const needsThemeChange = !currentIsDark;
	const needsCodeThemeUpdate = currentTheme !== expectedTheme;

	if (!needsThemeChange && !needsCodeThemeUpdate) {
		return;
	}

	if (needsThemeChange) {
		document.documentElement.classList.add("dark");
	}

	if (needsCodeThemeUpdate) {
		document.documentElement.setAttribute("data-theme", expectedTheme);
	}
}

export function setTheme(_theme: LIGHT_DARK_MODE): void {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}

	// 站点为纯暗色主题：任何入参都落到 dark
	applyThemeToDocument(DARK_MODE);

	// 覆写 localStorage，清掉历史遗留的 light/system 值
	localStorage.setItem("theme", DARK_MODE);
}

// 系统主题监听器（亮色主题已移除，系统偏好不再影响站点，保持空实现）
export function setupSystemThemeListener() {}

export function getStoredTheme(): LIGHT_DARK_MODE {
	// 站点为纯暗色主题：忽略 localStorage 中的历史值
	return DARK_MODE;
}

// 初始化主题监听器（用于页面加载后）
// 亮色主题已移除，系统偏好不再影响站点，保持空实现
export function initThemeListener() {}

// Wallpaper mode functions
export function applyWallpaperModeToDocument(mode: WALLPAPER_MODE) {
	// 检查是否允许切换壁纸模式
	const isSwitchable = backgroundWallpaper.switchable ?? true;
	if (!isSwitchable) {
		// 如果不允许切换，直接返回，不执行任何操作
		return;
	}

	// 获取当前的壁纸模式
	const currentMode =
		(document.documentElement.getAttribute(
			"data-wallpaper-mode",
		) as WALLPAPER_MODE) || backgroundWallpaper.mode;

	// 如果模式没有变化，直接返回
	if (currentMode === mode) {
		// 即使是相同模式，也要确保UI状态正确
		ensureWallpaperState(mode);
		return;
	}

	// 添加过渡保护类
	document.documentElement.classList.add("is-wallpaper-transitioning");

	// 更新数据属性
	document.documentElement.setAttribute("data-wallpaper-mode", mode);

	// 使用 requestAnimationFrame 确保在下一帧执行，避免闪屏
	requestAnimationFrame(() => {
		const body = document.body;

		// 移除所有壁纸相关的CSS类
		body.classList.remove(
			"enable-banner",
			"wallpaper-transparent",
			"no-banner-layout",
		);

		// 根据模式添加相应的CSS类
		switch (mode) {
			case WALLPAPER_BANNER:
				body.classList.add("enable-banner");
				showBannerMode();
				break;
			case WALLPAPER_OVERLAY:
				body.classList.add("wallpaper-transparent");
				body.classList.add("no-banner-layout");
				showOverlayMode();
				break;
			case WALLPAPER_NONE:
				body.classList.add("no-banner-layout");
				hideAllWallpapers();
				break;
			default:
				body.classList.add("no-banner-layout");
				hideAllWallpapers();
				break;
		}

		// 更新导航栏透明模式
		updateNavbarTransparency(mode);

		// 在下一帧移除过渡保护类
		requestAnimationFrame(() => {
			document.documentElement.classList.remove("is-wallpaper-transitioning");
		});
	});
}

// 确保壁纸状态正确
function ensureWallpaperState(mode: WALLPAPER_MODE) {
	const body = document.body;

	// 移除所有壁纸相关的CSS类
	body.classList.remove(
		"enable-banner",
		"wallpaper-transparent",
		"no-banner-layout",
	);

	// 根据模式添加相应的CSS类
	switch (mode) {
		case WALLPAPER_BANNER:
			body.classList.add("enable-banner");
			showBannerMode();
			break;
		case WALLPAPER_OVERLAY:
			body.classList.add("wallpaper-transparent");
			body.classList.add("no-banner-layout");
			showOverlayMode();
			break;
		case WALLPAPER_NONE:
			body.classList.add("no-banner-layout");
			hideAllWallpapers();
			break;
	}

	// 更新导航栏透明模式
	updateNavbarTransparency(mode);
}

// 首页与文章详情页共用「不展示壁纸」的语义：这两类页面都不该出现 #wallpaper-wrapper。
// 必须先判断再写入 —— 一旦对文章页写下行内 display:block!important，其优先级高于
// 任何样式表 !important（也高于 Layout 中同级的行内守卫），会把所有隐藏规则压掉，
// 文章页的背景图就会重新露出来。
function isWallpaperHiddenPage(): boolean {
	return (
		!!document.body?.classList.contains("homepage") ||
		!!document.querySelector("#content-wrapper.post-narrow")
	);
}

function showBannerMode() {
	// 显示 wallpaper-wrapper 并切换为 banner 模式
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		// 移除 overlay 模式类
		wallpaperWrapper.classList.remove("wallpaper-overlay");

		// 恢复 banner 模式的 top 定位
		wallpaperWrapper.style.top = `-${BANNER_HEIGHT_EXTEND}vh`;

		// 检查当前是否为首页
		const isHomePage = checkIsHomePage(window.location.pathname);
		const isMobile = window.innerWidth < 1024;

		// 移动端非首页时，不显示banner；桌面端始终显示
		if (isMobile && !isHomePage) {
			wallpaperWrapper.style.display = "none";
			wallpaperWrapper.classList.add("mobile-hide-banner");
		} else if (isWallpaperHiddenPage()) {
			// 首页（沉浸式叙事页自带各章背景）与文章详情页都不展示壁纸。
			// 必须走「隐藏」分支并写入行内 none!important：若落到下面的 else，
			// 会写出行内 block!important，其优先级高于样式表 !important，
			// 把 CSS 隐藏规则与其他守卫一并压掉，文章页背景图就会重新出现。
			// 仅隐藏节点、保留 DOM，切回其他内页时壁纸仍能恢复。
			wallpaperWrapper.style.display = "none";
			wallpaperWrapper.style.setProperty("display", "none", "important");
		} else {
			// 首页或桌面端：先设置display，然后使用requestAnimationFrame确保渲染
			wallpaperWrapper.style.display = "block";
			wallpaperWrapper.style.setProperty("display", "block", "important");
			requestAnimationFrame(() => {
				wallpaperWrapper.classList.remove("hidden");
				wallpaperWrapper.classList.remove("opacity-0");
				wallpaperWrapper.classList.add("opacity-100");
				wallpaperWrapper.classList.remove("mobile-hide-banner");
			});
		}
	}

	// 显示横幅图片来源文本
	const creditDesktop = document.getElementById("banner-credit-desktop");
	const creditMobile = document.getElementById("banner-credit-mobile");
	if (creditDesktop) creditDesktop.style.display = "";
	if (creditMobile) creditMobile.style.display = "";

	// 显示横幅首页文本（如果启用且是首页）
	const bannerTextOverlay = document.querySelector(".banner-home-text-overlay");
	if (bannerTextOverlay) {
		// 检查是否启用 homeText
		const homeTextEnabled = backgroundWallpaper.banner?.homeText?.enable;

		// 检查当前是否为首页
		const isHomePage = checkIsHomePage(window.location.pathname);

		// 只有在启用且在首页时才显示
		if (homeTextEnabled && isHomePage) {
			bannerTextOverlay.classList.remove("hidden");
		} else {
			bannerTextOverlay.classList.add("hidden");
		}
	}

	// 调整主内容位置
	adjustMainContentPosition("banner");

	// 处理移动端非首页主内容区域位置
	const mainContentWrapper = document.querySelector(".absolute.w-full.z-30");
	if (mainContentWrapper) {
		const isHomePage = checkIsHomePage(window.location.pathname);
		const isMobile = window.innerWidth < 1024;
		// 只在移动端非首页时调整主内容位置
		if (isMobile && !isHomePage) {
			mainContentWrapper.classList.add("mobile-main-no-banner");
		} else {
			mainContentWrapper.classList.remove("mobile-main-no-banner");
		}
	}

	// 移除透明效果（横幅模式不使用半透明）
	adjustMainContentTransparency(false);

	// 调整导航栏透明度
	const navbar = document.getElementById("navbar");
	if (navbar) {
		// 获取导航栏透明模式配置（banner模式）
		const transparentMode =
			backgroundWallpaper.banner?.navbar?.transparentMode || "semi";
		navbar.setAttribute("data-transparent-mode", transparentMode);

		// 重新初始化半透明模式滚动检测（如果需要）
		if (
			transparentMode === "semifull" &&
			typeof window.initSemifullScrollDetection === "function"
		) {
			window.initSemifullScrollDetection();
		}
	}
}

function showOverlayMode() {
	// 切换 wallpaper-wrapper 为 overlay 模式
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		// 添加 overlay 模式类
		wallpaperWrapper.classList.add("wallpaper-overlay");
		// 首页（沉浸式叙事页自带各章背景）与文章详情页都不展示壁纸。
		// 这里写的是行内 !important：对文章页若写 block，会压过样式表里的
		// display:none!important（含 MainGridLayout 的 post-narrow 规则与本文件外的守卫），
		// 背景图就会重新露出来。仅隐藏、保留 DOM，切回其他内页时壁纸仍能恢复。
		const isHiddenPage = isWallpaperHiddenPage();
		wallpaperWrapper.style.display = isHiddenPage ? "none" : "block";
		wallpaperWrapper.style.setProperty(
			"display",
			isHiddenPage ? "none" : "block",
			"important",
		);
		wallpaperWrapper.style.top = "";
		requestAnimationFrame(() => {
			wallpaperWrapper.classList.remove("hidden");
			wallpaperWrapper.classList.remove("opacity-0");
			wallpaperWrapper.classList.add("opacity-100");
			wallpaperWrapper.classList.remove("mobile-hide-banner");
		});
	}

	// 隐藏横幅图片来源文本
	const creditDesktop = document.getElementById("banner-credit-desktop");
	const creditMobile = document.getElementById("banner-credit-mobile");
	if (creditDesktop) creditDesktop.style.display = "none";
	if (creditMobile) creditMobile.style.display = "none";

	// 只在非首页时隐藏横幅首页文本
	const isHomePageOverlay = checkIsHomePage(window.location.pathname);
	const bannerTextOverlay = document.querySelector(".banner-home-text-overlay");
	if (bannerTextOverlay) {
		if (isHomePageOverlay) {
			bannerTextOverlay.classList.remove("hidden");
		} else {
			bannerTextOverlay.classList.add("hidden");
		}
	}

	// 调整主内容透明度
	adjustMainContentTransparency(true);

	// 调整布局为紧凑模式
	adjustMainContentPosition("overlay");
}

function hideAllWallpapers() {
	// 隐藏壁纸
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");

	if (wallpaperWrapper) {
		wallpaperWrapper.style.display = "none";
		wallpaperWrapper.classList.add("hidden");
		wallpaperWrapper.classList.add("opacity-0");
		wallpaperWrapper.classList.remove("wallpaper-overlay");
	}

	// 隐藏横幅图片来源文本
	const creditDesktop = document.getElementById("banner-credit-desktop");
	const creditMobile = document.getElementById("banner-credit-mobile");
	if (creditDesktop) creditDesktop.style.display = "none";
	if (creditMobile) creditMobile.style.display = "none";

	// 隐藏横幅首页文本
	const bannerTextOverlay = document.querySelector(".banner-home-text-overlay");
	if (bannerTextOverlay) {
		bannerTextOverlay.classList.add("hidden");
	}

	// 调整主内容位置和透明度
	adjustMainContentPosition("none");
	adjustMainContentTransparency(false);
}

function updateNavbarTransparency(mode: WALLPAPER_MODE) {
	const navbar = document.getElementById("navbar");
	if (!navbar) return;

	let transparentMode: string;
	let enableBlur: boolean;
	let blurAmount: number;

	// 根据当前壁纸模式设置导航栏透明模式和模糊效果
	if (mode === WALLPAPER_OVERLAY) {
		// 全屏壁纸模式
		transparentMode = "none";
		enableBlur = false;
		blurAmount = 0;
	} else if (mode === WALLPAPER_NONE) {
		// 纯色背景模式
		transparentMode = "none";
		enableBlur = false;
		blurAmount = 0;
	} else {
		// Banner模式：使用配置的透明模式和模糊效果
		transparentMode =
			backgroundWallpaper.banner?.navbar?.transparentMode || "semi";
		enableBlur = backgroundWallpaper.banner?.navbar?.enableBlur ?? true;
		blurAmount = backgroundWallpaper.banner?.navbar?.blur ?? 20;
	}

	// 更新导航栏的透明模式属性
	navbar.setAttribute("data-transparent-mode", transparentMode);
	navbar.setAttribute("data-enable-blur", String(enableBlur));
	navbar.style.setProperty("--navbar-glass-blur", `${blurAmount}px`);

	// 移除现有的透明模式类
	navbar.classList.remove(
		"navbar-transparent-semi",
		"navbar-transparent-full",
		"navbar-transparent-semifull",
	);

	// 移除scrolled类
	navbar.classList.remove("scrolled");

	// 滚动检测功能
	if (
		transparentMode === "semifull" &&
		mode === WALLPAPER_BANNER &&
		typeof window.initSemifullScrollDetection === "function"
	) {
		// 仅在Banner模式的semifull下启用滚动检测
		window.initSemifullScrollDetection();
	} else if (window.semifullScrollHandler) {
		// 移除滚动监听器
		window.removeEventListener("scroll", window.semifullScrollHandler);
		delete window.semifullScrollHandler;
	}
}

function adjustMainContentPosition(
	mode: WALLPAPER_MODE | "banner" | "none" | "overlay",
) {
	const mainContent = document.querySelector(
		".absolute.w-full.z-30",
	) as HTMLElement;
	if (!mainContent) return;

	// 移除现有的位置类
	mainContent.classList.remove("mobile-main-no-banner", "no-banner-layout");

	switch (mode) {
		case "banner":
			// Banner模式：主内容在banner下方
			mainContent.style.top = "calc(var(--banner-height) - 3rem)";
			break;
		case "overlay":
			// Overlay模式：首页保持 100vh（由 CSS 控制），非首页从导航栏下方开始
			mainContent.classList.add("no-banner-layout");
			if (checkIsHomePage(window.location.pathname)) {
				mainContent.style.top = "100vh";
			} else {
				mainContent.style.top = "5.5rem";
			}
			break;
		case "none":
			// 无壁纸模式：主内容从导航栏下方开始
			mainContent.classList.add("no-banner-layout");
			mainContent.style.top = "5.5rem";
			break;
		default:
			mainContent.style.top = "5.5rem";
			break;
	}
}

function adjustMainContentTransparency(enable: boolean) {
	const mainContent = document.querySelector(".absolute.w-full.z-30");
	const body = document.body;

	if (enable) {
		if (mainContent) {
			mainContent.classList.add("wallpaper-transparent");
		}
		if (body) {
			body.classList.add("wallpaper-transparent");
		}
	} else {
		if (mainContent) {
			mainContent.classList.remove("wallpaper-transparent");
		}
		if (body) {
			body.classList.remove("wallpaper-transparent");
		}
	}
}

export function setWallpaperMode(mode: WALLPAPER_MODE): void {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("wallpaperMode", mode);
	applyWallpaperModeToDocument(mode);
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("wallpaperModeChange", {
				detail: { mode },
			}),
		);
	}
}

export function initWallpaperMode(): void {
	// 初始化透明模式参数（透明度/模糊度/卡片透明度）
	applyStoredOverlaySettingsToDocument();
	const storedMode = getStoredWallpaperMode();
	applyWallpaperModeToDocument(storedMode);
}

export function getStoredWallpaperMode(): WALLPAPER_MODE {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return backgroundWallpaper.mode;
	}

	const isSwitchable = backgroundWallpaper.switchable ?? true;
	if (!isSwitchable) {
		localStorage.removeItem("wallpaperMode");
		return backgroundWallpaper.mode;
	}

	return (
		(localStorage.getItem("wallpaperMode") as WALLPAPER_MODE) ||
		backgroundWallpaper.mode
	);
}

// Overlay settings functions
function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function getDefaultOverlayOpacity(): number {
	return backgroundWallpaper.overlay?.opacity ?? 0.8;
}

export function getDefaultOverlayBlur(): number {
	return backgroundWallpaper.overlay?.blur ?? 0;
}

export function getDefaultOverlayCardOpacity(): number {
	return backgroundWallpaper.overlay?.cardOpacity ?? 0.6;
}

export function getStoredOverlayOpacity(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayOpacity();
	}
	const stored = localStorage.getItem("overlayOpacity");
	if (stored === null) {
		return getDefaultOverlayOpacity();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayOpacity();
	}
	return clampNumber(parsed, 0, 1);
}

export function getStoredOverlayBlur(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayBlur();
	}
	const stored = localStorage.getItem("overlayBlur");
	if (stored === null) {
		return getDefaultOverlayBlur();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayBlur();
	}
	return clampNumber(parsed, 0, 20);
}

export function getStoredOverlayCardOpacity(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayCardOpacity();
	}
	const stored = localStorage.getItem("overlayCardOpacity");
	if (stored === null) {
		return getDefaultOverlayCardOpacity();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayCardOpacity();
	}
	return clampNumber(parsed, 0, 1);
}

export function applyOverlayOpacityToDocument(opacity: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeOpacity = clampNumber(opacity, 0, 1);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty(
			"--overlay-opacity",
			String(safeOpacity),
		);
	}
}

export function applyOverlayBlurToDocument(blur: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeBlur = clampNumber(blur, 0, 20);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty("--overlay-blur", `${safeBlur}px`);
	}
}

export function applyOverlayCardOpacityToDocument(cardOpacity: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	document.documentElement.style.setProperty(
		"--card-transparent-opacity",
		String(safeCardOpacity),
	);
}

export function setOverlayOpacity(opacity: number): void {
	const safeOpacity = clampNumber(opacity, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayOpacity", String(safeOpacity));
	}
	applyOverlayOpacityToDocument(safeOpacity);
}

export function setOverlayBlur(blur: number): void {
	const safeBlur = clampNumber(blur, 0, 20);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayBlur", String(safeBlur));
	}
	applyOverlayBlurToDocument(safeBlur);
}

export function setOverlayCardOpacity(cardOpacity: number): void {
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayCardOpacity", String(safeCardOpacity));
	}
	applyOverlayCardOpacityToDocument(safeCardOpacity);
}

export function applyStoredOverlaySettingsToDocument(): void {
	applyOverlayOpacityToDocument(getStoredOverlayOpacity());
	applyOverlayBlurToDocument(getStoredOverlayBlur());
	applyOverlayCardOpacityToDocument(getStoredOverlayCardOpacity());
}

// Waves animation functions
export function getDefaultWavesEnabled(): boolean {
	const wavesConfig = backgroundWallpaper.banner?.waves?.enable;
	if (typeof wavesConfig === "object") {
		// 如果是分设备配置，检查当前设备
		const isMobile =
			typeof window !== "undefined" ? window.innerWidth < 768 : false;
		return isMobile
			? (wavesConfig.mobile ?? false)
			: (wavesConfig.desktop ?? false);
	}
	return wavesConfig ?? false;
}

export function getStoredWavesEnabled(): boolean {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultWavesEnabled();
	}
	const stored = localStorage.getItem("wavesEnabled");
	if (stored === null) {
		return getDefaultWavesEnabled();
	}
	return stored === "true";
}

export function setWavesEnabled(enabled: boolean): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("wavesEnabled", String(enabled));
	applyWavesEnabledToDocument(enabled);
}

export function applyWavesEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	// 更新 html 属性，CSS 会立即生效
	document.documentElement.setAttribute("data-waves-enabled", String(enabled));
	// 同时更新元素样式（兼容性）
	const wavesElement = document.getElementById("header-waves");
	if (wavesElement) {
		if (enabled) {
			wavesElement.style.display = "";
			wavesElement.classList.remove("waves-disabled");
		} else {
			wavesElement.style.display = "none";
			wavesElement.classList.add("waves-disabled");
		}
	}
}

// Banner title functions
export function getDefaultBannerTitleEnabled(): boolean {
	return backgroundWallpaper.banner?.homeText?.enable ?? true;
}

export function getDefaultBannerCarouselEnabled(): boolean {
	return backgroundWallpaper.banner?.carousel?.enable ?? false;
}

export function getStoredBannerTitleEnabled(): boolean {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultBannerTitleEnabled();
	}
	const stored = localStorage.getItem("bannerTitleEnabled");
	if (stored === null) {
		return getDefaultBannerTitleEnabled();
	}
	return stored === "true";
}

export function getStoredBannerCarouselEnabled(): boolean {
	const isSwitchable =
		backgroundWallpaper.banner?.carousel?.switchable ?? false;
	if (!isSwitchable) {
		return getDefaultBannerCarouselEnabled();
	}
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultBannerCarouselEnabled();
	}
	const stored = localStorage.getItem("bannerCarouselEnabled");
	if (stored === null) {
		return getDefaultBannerCarouselEnabled();
	}
	return stored === "true";
}

export function setBannerTitleEnabled(enabled: boolean): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("bannerTitleEnabled", String(enabled));
	applyBannerTitleEnabledToDocument(enabled);
}

export function setBannerCarouselEnabled(enabled: boolean): void {
	const safeEnabled = !!enabled;
	const isSwitchable =
		backgroundWallpaper.banner?.carousel?.switchable ?? false;
	if (
		isSwitchable &&
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("bannerCarouselEnabled", String(safeEnabled));
	}
	applyBannerCarouselEnabledToDocument(safeEnabled);
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("bannerCarouselChange", {
				detail: { enabled: safeEnabled },
			}),
		);
	}
}

export function applyBannerTitleEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	// 更新 html 属性，CSS 会立即生效
	document.documentElement.setAttribute(
		"data-banner-title-enabled",
		String(enabled),
	);
	// 同时更新元素样式（兼容性）
	const bannerTextOverlay = document.querySelector(
		".banner-home-text-overlay",
	) as HTMLElement;
	if (bannerTextOverlay) {
		if (enabled) {
			bannerTextOverlay.classList.remove("user-hidden");
		} else {
			bannerTextOverlay.classList.add("user-hidden");
		}
	}
}

export function applyBannerCarouselEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	document.documentElement.setAttribute(
		"data-banner-carousel-enabled",
		String(enabled),
	);
}
