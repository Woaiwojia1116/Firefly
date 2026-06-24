import type { FriendLink, FriendsPageConfig } from "../types/config";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	// {
	// 	title: "夏夜流萤",
	// 	imgurl:
	// 		"https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
	// 	desc: "飞萤之火自无梦的长夜亮起，绽放在终竟的明天。",
	// 	siteurl: "https://blog.cuteleaf.cn",
	// 	tags: ["Blog"],
	// 	weight: 10, // 权重，数字越大排序越靠前
	// 	enabled: true, // 是否启用
	// },
	// {
	// 	title: "Firefly Docs",
	// 	imgurl: "https://docs-firefly.cuteleaf.cn/logo.png",
	// 	desc: "Firefly主题模板文档",
	// 	siteurl: "https://docs-firefly.cuteleaf.cn",
	// 	tags: ["Docs"],
	// 	weight: 9,
	// 	enabled: true,
	// },
	// {
	// 	title: "Astro",
	// 	imgurl: "https://avatars.githubusercontent.com/u/44914786?v=4&s=640",
	// 	desc: "The web framework for content-driven websites. ⭐️ Star to support our work!",
	// 	siteurl: "https://github.com/withastro/astro",
	// 	tags: ["Framework"],
	// 	weight: 8,
	// 	enabled: true,
	// },
	{
		title: "KASUIEの次元",
		imgurl:
			"https://kasuie.cc/avatar.webp",
		desc: "喜欢温柔的人",
		siteurl: "https://kasuie.cc",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "番茄主理人",
		imgurl:
			"https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		desc: "坐而言不如起而行.",
		siteurl: "https://fqzlr.com/",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "THW’s Blog",
		imgurl:
			"https://image.tianhw.top/avatar.webp",
		desc: "前途似海，来日方长.",
		siteurl: "https://blog.tianhw.top",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "辰渊尘",
		imgurl:
			"https://blog.mcxiaochen.top/img/congyu/touxiang.webp",
		desc: "05后，高中生，内容偏技术向，同时也会更新生活日常，希望能对你有用QwQ",
		siteurl: "https://blog.mcxiaochen.top",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "MmzMing的知识库",
		imgurl:
			"https://i.stardots.io/784774835/StarDots-2026052116374135506.jpg",
		desc: "哈基米，南北绿豆",
		siteurl: "https://tblog.mmzhiku.xyz",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "团子和蛋糕",
		imgurl:
			"https://re.tsh520.cn/zl/tx.webp",
		desc: "如果你喜欢那么欢迎来到我的世界！",
		siteurl: "https://blog.tsh520.cn/",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Luquiesceneの小屋",
		imgurl:
			"https://luq-blog.xyz/avatar.webp",
		desc: "To be or not to be: that is the question.",
		siteurl: "https://luq-blog.xyz/",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
