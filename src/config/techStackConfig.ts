/**
 * 技术栈页面配置 —— /tech/ 终端风 neofetch 展示
 *
 * 这里展示的是「我的」技术栈（个人技能），不是博客的技术栈。
 * 修改下面的条目即可增删，页面会自动按顺序输出。
 * value 里可以用 `**文本**` 标记暖色强调；`●○` 是熟练度点阵（实心 5 格满）。
 */

export interface TechStackEntry {
	/** 左侧键名（终端里的字段名） */
	label: string;
	/** 右侧值 */
	value: string;
}

export interface TechStackSection {
	/** 分组标题（显示为终端注释行，如「── 编程语言 ──」，留空则不显示） */
	title?: string;
	entries: TechStackEntry[];
}

export interface TechStackConfig {
	/** 终端标题栏与提示符里的主机名（ysdy@firefly 的后半段） */
	host: string;
	/** 终端里执行的命令（仅作展示） */
	command: string;
	/** 终端提示符里的用户名 */
	user: string;
	/** 左侧 ASCII 字符画（等宽字体，逐行数组） */
	asciiArt: string[];
	/** ASCII 画下方的小字签名 */
	asciiCaption: string;
	/** 右侧信息分组（按顺序输出） */
	sections: TechStackSection[];
	/** 终端窗口下方的一句话备注 */
	note: string;
}

export const techStackConfig: TechStackConfig = {
	host: "firefly",
	user: "ysdy",
	command: "neofetch",
	asciiArt: [
		" ██╗ ██╗   ██╗ ██████╗  ██████╗  ██╗   ██╗",
		" ██╔╝ ╚██╗ ██╔╝ ██╔══██╗ ██╔══██╗ ╚██╗ ██╔╝",
		" █████╗ ╚████╔╝  ██║  ██║ ██████╔╝  ╚████╔╝",
		" ██╔═██╗ ╚██╔╝   ██║  ██║ ██╔═══╝    ╚██╔╝ ",
		" ██║ ╚██╗ ██║    ██████╔╝ ██║         ██║   ",
		" ╚═╝  ╚═╝ ╚═╝    ╚═════╝  ╚═╝         ╚═╝   ",
	],
	asciiCaption: "ysdy~Blog",
	sections: [
		{
			title: "编程语言",
			entries: [
				{ label: "c", value: "**C 语言** · 主力 ●●●●●" },
				{ label: "cpp", value: "C++ ●●●●○" },
				{ label: "python", value: "Python ●●●○○" },
			],
		},
		{
			title: "嵌入式",
			entries: [
				{ label: "mcu", value: "**STM32** · ARM Cortex-M" },
				{ label: "rtos", value: "FreeRTOS · 任务调度 / 队列 / 信号量" },
				{ label: "bus", value: "UART / I2C / SPI / CAN" },
			],
		},
		{
			title: "Linux 与工具",
			entries: [
				{ label: "linux", value: "**Linux** · 日常开发环境 ●●●●○" },
				{ label: "tools", value: "Git · CMake / Makefile" },
				{ label: "contest", value: "电赛 · 嵌入式项目实战" },
				{ label: "ai", value: "vibecoding · AI 辅助开发" },
			],
		},
	],
	note: "本页由站点配置文件驱动，改 techStackConfig.ts 即可更新",
};
