/**
 * 主题初始化脚本 - 在页面渲染前执行以避免闪烁
 * 此脚本只运行一次（首次加载），Swup 页面切换时不需要重新执行
 * 因为主题状态（dark class、data-theme、--hue 等）会随 DOM 保持
 */
(function () {
  var DARK_MODE = "dark";

  // 从 data-* 属性读取配置
  var html = document.documentElement;
  var config = html.getAttribute("data-theme-config");
  var opts = config ? JSON.parse(config) : {};

  var configHue = opts.hue || 250;
  var darkTheme = opts.darkTheme || "github-dark";
  var cardTransparentOpacity = typeof opts.cardTransparentOpacity === "number"
    ? opts.cardTransparentOpacity
    : 0.6;

  // 站点为纯暗色主题：忽略存储与系统偏好，恒为 dark
  var isDark = true;

  // 应用主题
  html.classList.add("dark");

  // 设置 Expressive Code 主题
  html.setAttribute("data-theme", darkTheme);

  // 加载 hue
  var hue = localStorage.getItem("hue") || configHue;
  html.style.setProperty("--hue", hue);

  // 设置卡片透明度
  var storedCardOpacity = localStorage.getItem("overlayCardOpacity");
  var parsedCardOpacity = storedCardOpacity === null ? NaN : Number.parseFloat(storedCardOpacity);
  var resolvedCardOpacity = Number.isFinite(parsedCardOpacity)
    ? Math.min(1, Math.max(0, parsedCardOpacity))
    : cardTransparentOpacity;
  html.style.setProperty("--card-transparent-opacity", String(resolvedCardOpacity));

  // 初始化水波纹动画状态
  var wavesEnabled = localStorage.getItem("wavesEnabled");
  if (wavesEnabled !== null) {
    html.setAttribute("data-waves-enabled", wavesEnabled);
  }

  // 初始化横幅标题显示状态
  var bannerTitleEnabled = localStorage.getItem("bannerTitleEnabled");
  if (bannerTitleEnabled !== null) {
    html.setAttribute("data-banner-title-enabled", bannerTitleEnabled);
  }
})();
