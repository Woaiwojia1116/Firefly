<script lang="ts">
import QRCode from "qrcode";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "../../i18n/i18nKey";
import { i18n } from "../../i18n/translation";

export let title: string;
export let author: string;
export let description = "";
export let pubDate: string;
export let coverImage: string | null = null;
export let url: string;
export let siteTitle: string;
export let avatar: string | null = null;

let showModal = false;
let posterImage: string | null = null;
let generating = false;
let themeColor = "#558e88"; // Default blue

onMount(() => {
	// Get theme color from CSS variable
	const temp = document.createElement("div");
	temp.style.color = "var(--primary)";
	temp.style.display = "none";
	document.body.appendChild(temp);
	const computedColor = getComputedStyle(temp).color;
	document.body.removeChild(temp);

	if (computedColor) {
		themeColor = computedColor;
	}
});

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => {
			if (!src.includes("images.weserv.nl")) {
				const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=png`;
				const proxyImg = new Image();
				proxyImg.crossOrigin = "anonymous";
				proxyImg.onload = () => resolve(proxyImg);
				proxyImg.onerror = () => {
					resolve(null);
				};
				proxyImg.src = proxyUrl;
			} else {
				resolve(null);
			}
		};
		img.src = src;
	});
}

function colorToHex(color: string): string {
	// Works with any CSS color format (rgb, oklch, hex...) by rasterizing one pixel
	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = 1;
	tempCanvas.height = 1;
	const c = tempCanvas.getContext("2d");
	if (!c) return "#4a4a4a";
	c.fillStyle = color;
	c.fillRect(0, 0, 1, 1);
	const d = c.getImageData(0, 0, 1, 1).data;
	const toHex = (n: number) => n.toString(16).padStart(2, "0");
	return `#${toHex(d[0])}${toHex(d[1])}${toHex(d[2])}`;
}

function getLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	const chars = text.split("");
	const lines: string[] = [];
	let currentLine = "";

	for (let i = 0; i < chars.length; i++) {
		const char = chars[i];
		const width = ctx.measureText(currentLine + char).width;
		if (width < maxWidth) {
			currentLine += char;
		} else {
			lines.push(currentLine);
			currentLine = char;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines;
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

async function generatePoster() {
	showModal = true;
	if (posterImage) return;

	generating = true;
	try {
		const scale = 2;
		const width = 425 * scale;
		const frame = 16 * scale;
		const themeHex = colorToHex(themeColor);

		// 1. Prepare resources
		const qrCodeUrl = await QRCode.toDataURL(url, {
			margin: 0,
			width: 100 * scale,
			color: { dark: themeHex, light: "#ffffff" },
		});
		const [qrImg, coverImg, avatarImg] = await Promise.all([
			loadImage(qrCodeUrl),
			coverImage ? loadImage(coverImage) : Promise.resolve(null),
			avatar ? loadImage(avatar) : Promise.resolve(null),
		]);

		// 2. Setup Canvas
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas context not available");

		canvas.width = width;
		// Initial height estimation, will be adjusted
		canvas.height = 1000 * scale;

		// 3. Layout Calculation (polaroid photo print)
		const photoX = frame;
		const photoY = frame;
		const photoW = width - frame * 2;
		const photoH = 460 * scale;
		const contentW = photoW - 100 * scale; // right column reserved for QR

		ctx.font = `700 ${20 * scale}px 'Roboto', sans-serif`;
		const titleLines = getLines(ctx, title, contentW).slice(0, 3);
		const titleLineHeight = 28 * scale;
		const titleHeight = titleLines.length * titleLineHeight;
		const titleTop = photoY + photoH + 20 * scale;

		// Description
		let descLines: string[] = [];
		const descLineHeight = 18 * scale;
		let descHeight = 0;
		if (description) {
			ctx.font = `${12 * scale}px 'Roboto', sans-serif`;
			descLines = getLines(ctx, description, contentW).slice(0, 2);
			descHeight = descLines.length * descLineHeight;
		}

		const footerY =
			titleTop + titleHeight + (description ? 8 * scale + descHeight + 10 * scale : 12 * scale);

		const qrTop = titleTop;
		const qrSize = 76 * scale;
		const qrBlockH = (14 + 76 + 16) * scale; // scan hint + QR + site title
		const footerH = 40 * scale;

		// 4. Resize Canvas to fit content
		const bandBottom = Math.max(footerY + footerH, qrTop + qrBlockH) + 18 * scale;
		canvas.height = bandBottom;

		// 5. Draw Content
		// Fill Background (white photo paper)
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Subtle paper grain
		ctx.save();
		ctx.fillStyle = "rgba(0, 0, 0, 0.025)";
		for (let i = 0; i < 500; i++) {
			ctx.fillRect(
				Math.random() * width,
				Math.random() * canvas.height,
				1 * scale,
				1 * scale,
			);
		}
		ctx.restore();

		// Parse Date
		let dateObj: { day: string; month: string; year: string } | null = null;
		try {
			const d = new Date(pubDate);
			if (!Number.isNaN(d.getTime())) {
				dateObj = {
					day: d.getDate().toString().padStart(2, "0"),
					month: (d.getMonth() + 1).toString().padStart(2, "0"),
					year: d.getFullYear().toString(),
				};
			}
		} catch (e) {}

		// Draw Cover
		if (coverImg) {
			// Object-fit: cover implementation
			const imgRatio = coverImg.width / coverImg.height;
			const targetRatio = photoW / photoH;
			let sx: number;
			let sy: number;
			let sWidth: number;
			let sHeight: number;

			if (imgRatio > targetRatio) {
				sHeight = coverImg.height;
				sWidth = sHeight * targetRatio;
				sx = (coverImg.width - sWidth) / 2;
				sy = 0;
			} else {
				sWidth = coverImg.width;
				sHeight = sWidth / targetRatio;
				sx = 0;
				sy = (coverImg.height - sHeight) / 2;
			}
			ctx.drawImage(
				coverImg,
				sx,
				sy,
				sWidth,
				sHeight,
				photoX,
				photoY,
				photoW,
				photoH,
			);
		} else {
			ctx.save();
			ctx.fillStyle = themeColor;
			ctx.globalAlpha = 0.15;
			ctx.fillRect(photoX, photoY, photoW, photoH);
			ctx.restore();
		}

		// Hairline around the photo
		ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
		ctx.lineWidth = 1 * scale;
		ctx.strokeRect(photoX, photoY, photoW, photoH);

		// Film date stamp (bottom-right of the photo)
		if (dateObj) {
			ctx.save();
			ctx.textAlign = "right";
			ctx.textBaseline = "alphabetic";
			ctx.font = `700 ${14 * scale}px 'Courier New', monospace`;
			// Dark under-shadow for legibility on light photo areas
			ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
			ctx.shadowBlur = 3 * scale;
			ctx.fillStyle = "#ffab5e";
			ctx.fillText(
				`'${dateObj.year.slice(2)} ${dateObj.month} ${dateObj.day}`,
				photoX + photoW - 10 * scale,
				photoY + photoH - 10 * scale,
			);
			// Orange glow pass
			ctx.shadowColor = "#ff9f43";
			ctx.fillText(
				`'${dateObj.year.slice(2)} ${dateObj.month} ${dateObj.day}`,
				photoX + photoW - 10 * scale,
				photoY + photoH - 10 * scale,
			);
			ctx.restore();
		}

		// Washi tape on the top edge of the photo
		ctx.save();
		ctx.translate(width / 2, 12 * scale);
		ctx.rotate(-0.05);
		ctx.fillStyle = themeColor;
		ctx.globalAlpha = 0.45;
		drawRoundedRect(ctx, -55 * scale, -12 * scale, 110 * scale, 24 * scale, 2 * scale);
		ctx.fill();
		ctx.restore();

		// Draw Title
		ctx.textBaseline = "top";
		ctx.textAlign = "left";
		ctx.font = `700 ${20 * scale}px 'Roboto', sans-serif`;
		ctx.fillStyle = "#2d2a26";
		let drawY = titleTop;
		titleLines.forEach((line) => {
			ctx.fillText(line, photoX, drawY);
			drawY += titleLineHeight;
		});

		// Draw Description
		if (description && descLines.length) {
			ctx.font = `${12 * scale}px 'Roboto', sans-serif`;
			ctx.fillStyle = "rgba(45, 42, 38, 0.55)";
			descLines.forEach((line) => {
				ctx.fillText(line, photoX, drawY + 8 * scale);
				drawY += descLineHeight;
			});
		}

		// Left: Author
		const avatarSize = 36 * scale;
		if (avatarImg) {
			ctx.save();
			// Circle clip
			ctx.beginPath();
			ctx.arc(
				photoX + avatarSize / 2,
				footerY + avatarSize / 2,
				avatarSize / 2,
				0,
				Math.PI * 2,
			);
			ctx.closePath();
			ctx.clip();

			ctx.drawImage(avatarImg, photoX, footerY, avatarSize, avatarSize);
			ctx.restore();

			// Border for avatar
			ctx.beginPath();
			ctx.arc(
				photoX + avatarSize / 2,
				footerY + avatarSize / 2,
				avatarSize / 2,
				0,
				Math.PI * 2,
			);
			ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
			ctx.lineWidth = 1 * scale;
			ctx.stroke();
		}

		const authorTextX = photoX + (avatarImg ? avatarSize + 10 * scale : 0);

		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#2d2a26";
		ctx.font = `700 ${15 * scale}px 'Roboto', sans-serif`;
		ctx.fillText(author, authorTextX, footerY + avatarSize / 2 + 2 * scale);

		// Right: QR Code
		const qrX = width - frame - qrSize;
		const qrCX = qrX + qrSize / 2;

		// Scan hint above QR
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "rgba(45, 42, 38, 0.55)";
		ctx.font = `${10 * scale}px 'Roboto', sans-serif`;
		ctx.fillText(i18n(I18nKey.scanToRead), qrCX, qrTop + 7 * scale);

		// QR card with soft shadow
		const qrY = qrTop + 14 * scale;
		ctx.fillStyle = "#ffffff";
		ctx.shadowColor = "rgba(0, 0, 0, 0.06)";
		ctx.shadowBlur = 6 * scale;
		ctx.shadowOffsetY = 2 * scale;
		drawRoundedRect(
			ctx,
			qrX - 5 * scale,
			qrY - 5 * scale,
			qrSize + 10 * scale,
			qrSize + 10 * scale,
			6 * scale,
		);
		ctx.fill();
		ctx.shadowColor = "transparent"; // Reset shadow
		ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
		ctx.lineWidth = 1 * scale;
		ctx.stroke();

		// Draw QR
		if (qrImg) {
			ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
		}

		// Site title under QR
		ctx.fillStyle = "#2d2a26";
		ctx.font = `700 ${10 * scale}px 'Roboto', sans-serif`;
		ctx.fillText(siteTitle, qrCX, qrY + qrSize + 9 * scale);

		// Finalize
		posterImage = canvas.toDataURL("image/png");
		generating = false;
	} catch (error) {
		console.error("Failed to generate poster:", error);
		generating = false;
	}
}

function downloadPoster() {
	if (posterImage) {
		const a = document.createElement("a");
		a.href = posterImage;
		a.download = `poster-${title.replace(/\s+/g, "-")}.png`;
		a.click();
	}
}

function closeModal() {
	showModal = false;
}

let copied = false;
function copyLink() {
	navigator.clipboard.writeText(url);
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 2000);
}

function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		},
	};
}
</script>

<!-- Trigger Button -->
<button 
  class="btn-regular rounded-lg h-12 px-6 gap-2 hover:scale-105 active:scale-95 whitespace-nowrap"
  on:click={generatePoster}
  aria-label="Generate Share Poster"
>
  <Icon icon="material-symbols:share" size="md" />
  <span>{i18n(I18nKey.shareArticle)}</span>
</button>



<!-- Modal -->
{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:portal class="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-opacity" on:click={closeModal}>
    <div class="bg-(--card-bg) border border-(--line-color) rounded-2xl max-w-[440px] w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl transform transition-all" on:click={(e) => e.stopPropagation()}>

      <div class="p-6 flex justify-center bg-(--page-bg) min-h-[200px] items-center">
        {#if posterImage}
          <img src={posterImage} alt="Poster" class="max-w-full h-auto rounded-md shadow-lg" />
        {:else}
           <div class="flex flex-col items-center gap-3">
             <div class="w-8 h-8 border-2 border-(--line-color) rounded-full animate-spin" style="border-top-color: var(--primary)"></div>
             <span class="text-sm text-(--btn-content)">{i18n(I18nKey.generatingPoster)}</span>
           </div>
        {/if}
      </div>

      <div class="p-4 border-t border-(--line-divider) grid grid-cols-2 gap-3">
        <button
          class="btn-regular py-3 rounded-xl font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          on:click={copyLink}
        >
          {#if copied}
            <Icon icon="material-symbols:check" size="md" />
            <span>{i18n(I18nKey.copied)}</span>
          {:else}
            <Icon icon="material-symbols:link" size="md" />
            <span>{i18n(I18nKey.copyLink)}</span>
          {/if}
        </button>
        <button
          class="py-3 text-white rounded-xl font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-90"
          style="background-color: var(--primary);"
          on:click={downloadPoster}
          disabled={!posterImage}
        >
          <Icon icon="material-symbols:download" size="md" />
          {i18n(I18nKey.savePoster)}
        </button>
      </div>
    </div>
  </div>
{/if}
