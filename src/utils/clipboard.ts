/**
 * 复制文本到系统剪贴板。
 *
 * 优先使用 Clipboard API；在非安全上下文（HTTP）、权限被拒绝或旧浏览器下
 * 退回 textarea + document.execCommand("copy")，并通过返回值告知调用方
 * 是否真的复制成功，避免界面误报「已复制」。
 */
export async function copyText(text: string): Promise<boolean> {
	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// 继续尝试下面的降级方案
		}
	}
	return copyTextFallback(text);
}

function copyTextFallback(text: string): boolean {
	if (typeof document === "undefined" || !document.body) return false;

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.top = "0";
	textarea.style.left = "0";
	textarea.style.width = "1px";
	textarea.style.height = "1px";
	textarea.style.padding = "0";
	textarea.style.border = "none";
	textarea.style.opacity = "0";
	textarea.style.fontSize = "12pt";
	textarea.style.pointerEvents = "none";
	document.body.appendChild(textarea);

	// 记住原有选区，复制完成后恢复，避免打断用户阅读位置
	const selection = document.getSelection();
	const previousRange =
		selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

	textarea.select();
	textarea.setSelectionRange(0, text.length);

	let ok = false;
	try {
		ok = document.execCommand("copy") === true;
	} catch {
		ok = false;
	} finally {
		document.body.removeChild(textarea);
	}

	if (previousRange && selection) {
		selection.removeAllRanges();
		selection.addRange(previousRange);
	}

	return ok;
}

/** 复制失败时选中目标元素文本，方便用户直接 Ctrl/Cmd+C 手动复制 */
export function selectText(el: HTMLElement | null | undefined): void {
	if (!el) return;
	const selection = document.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}
