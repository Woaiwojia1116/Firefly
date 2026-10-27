// 首页「萤火 · 夜航」配置
// ---------------------------------------------------------------------------
// 只影响首页第 1 页（/）。文案与图片路径集中在这里，
// 排版与动画在 src/components/layout/CinematicHome.astro + src/utils/home-cinematic.ts。
//
// 命名原则：板块标题就是内容本身（关于我 / 最新文章 / 分类与入口），
// 不再使用刻意的「幕名」；段与段之间用 bridges 里的一句衔接话过渡。
//
// 图片路径支持三种写法：
//   1. src 目录（推荐，构建时自动优化）："assets/images/DesktopWallpaper/d6.avif"
//   2. public 目录（不优化、路径稳定）："/assets/images/home/xxx.jpg"
//   3. 远程 URL："https://..."
// 留空 "" 时使用页面内置的纯 CSS 画面，不会出现坏图。

export const cinematicHomeConfig = {
	// ── 首屏 ─────────────────────────────────────────────────────────
	hero: {
		// 全屏背景：雨夜窗前的山城灯火（整幕铺满第一屏，滚动时以更慢速度掠过）
		background: "assets/images/雨夜窗前的山城灯火.png",
		backgroundPosition: "center 58%",
		// 拱窗主视觉：出现在右侧拱窗里
		image: "assets/images/w04.jpg",
		imageAlt: "",
		// 图片裁切焦点（object-position）：拱窗为竖幅，焦点对准人物
		imagePosition: "64% 22%",
		eyebrow: "YSDY · 个人博客",
		// 标题按行拆开，每一行独立做遮罩上移
		titleLines: ["YSDY", "博客"],
		subtitle: "把日子拆成星屑，收进这一页。",
		// 两个入口：target 以 # 开头时为本页锚点（平滑滚动），否则按站内路径跳转
		primaryCta: { label: "开始阅读", target: "#fyh-latest" },
		secondaryCta: { label: "关于我", target: "#fyh-about" },
		// 贴在拱窗边的手写便签，一行一条
		note: ["有些风景", "只适合", "在记忆里重来"],
		// 便签实时化：开启后便签展示「动态」页最新一条（心情 + 截断正文），
		// 拉取失败或没有动态时回退上面的默认文案；点击便签跳转 /moments/。
		// 依赖 pages.moments 与 Twikoo 评论系统。
		noteLive: true,
		// 散落的拍立得小照片（最多两张）
		polaroids: [
			{ image: "assets/images/DesktopWallpaper/1 (1).png", position: "center 55%" },
			{ image: "assets/images/DesktopWallpaper/2.jpg", position: "center 10%" },
		],
		// 拱窗下的一行小注：夜里唯一亮着的窗，望进另一个晴日
		windowCaption: "窗外 · 另一个晴日",
		scrollLabel: "SCROLL",
	},

	// ── 首屏底部的三张快捷卡片 ────────────────────────────────────────
	// target：本页锚点（# 开头）；url：站内路径
	quickLinks: [
		{
			title: "最近文章",
			desc: "记录一些想法，还有路上的风景。",
			image: "assets/images/DesktopWallpaper/d1.avif",
			target: "#fyh-latest",
		},
		{
			title: "生活切片",
			desc: "一些日常的碎片，和可爱的平凡。",
			image: "assets/images/DesktopWallpaper/d6.avif",
			url: "/timeline/",
		},
		{
			title: "关于这里",
			desc: "这是我的小小角落，也许会遇见同样的你。",
			image: "assets/images/MobileWallpaper/m4.avif",
			url: "/about/",
		},
	],

	// ── 段落之间的衔接句：一句话 + 细线，代替硬切 ──────────────────────
	bridges: {
		toAbout: "夜还长，先认识一下这扇窗后的人",
		toArticles: "白天调的板子、深夜写的字，最近在写这些",
		toEntries: "文章之外，还有这些地方可以逛",
	},

	// ── 关于我 ───────────────────────────────────────────────────────
	about: {
		title: "关于我",
		lines: [
			"摆烂大学生的胡言乱语：白天调中断、写时序，晚上把这些零碎的念头收拾成一页。",
			"这里没有固定的主题，只有一段一段正在发生的事。",
		],
		caption: "窗外 · 雨声与茶",
		noticeLabel: "公告",
	},

	// ── 最新文章 ─────────────────────────────────────────────────────
	articles: {
		title: "最新文章",
		description: "调试、比赛、深夜的突发奇想，每一篇都还带着当时的温度。",
		moreLabel: "全部记录",
		archiveUrl: "/archive/",
	},

	// ── 分类与入口 ───────────────────────────────────────────────────
	entries: {
		title: "分类与入口",
		note: "夜航班次 · 全年无休",
	},

	// 第 3 段展示的精选文章数量（取最新 N 篇，真实内容集合，不写死）
	featuredCount: 4,

	// ── 图片 ─────────────────────────────────────────────────────────
	images: {
		// 关于我：室内雨窗（d6 为窗边雨景茶杯）
		window: "assets/images/DesktopWallpaper/d6.avif",
	},

	// ── 分类与入口：夜航站牌 ─────────────────────────────────────────
	// 顺序即牌面顺序（01 起）；desc 是一行去向说明；url 为站内路径。
	departures: [
		{ name: "技术栈", desc: "会的东西都在这里了", url: "/tech/" },
		{ name: "相册", desc: "雨夜与灯火的存档", url: "/gallery/" },
		{ name: "动态", desc: "碎碎念的落点", url: "/moments/" },
		{ name: "时间轴", desc: "一路走来的足迹", url: "/timeline/" },
		{ name: "友链", desc: "朋友们的落脚点", url: "/friends/" },
	],

	// 「我在折腾」词条栏：站牌下方，展示内容分类。
	// 词条名 / 描述 / 顺序 / 图标都在这里配置，篇数自动按 category 统计；
	// category 对应文章 frontmatter 的分类名，计数为 0 的词条自动隐藏。
	exploreTags: [
		{
			name: "RTOS",
			desc: "任务调度与 FreeRTOS 踩坑",
			icon: "material-symbols:memory",
			category: "RTOS",
		},
		{
			name: "Linux",
			desc: "arch 日常",
			icon: "fa7-brands:linux",
			category: "Linux",
		},
		{
			name: "MCU",
			desc: "STM32 与外设驱动",
			icon: "material-symbols:developer-board",
			category: "MCU",
		},
		{
			name: "电赛",
			desc: "比赛项目复盘",
			icon: "material-symbols:emoji-events",
			category: "电赛",
		},
		{
			name: "vibecoding",
			desc: "AI 辅助开发记录",
			icon: "material-symbols:auto-awesome",
			category: "vibecoding",
		},
	],
};
