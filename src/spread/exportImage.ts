/** Download a rendered diagram as a standalone SVG file or a PNG image. */

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Standalone SVG markup at the drawing's natural size. */
export function svgMarkup(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const box = svg.viewBox.baseVal;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(box.width));
  clone.setAttribute('height', String(box.height));
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

export function downloadSvg(svg: SVGSVGElement, fileName: string) {
  download(new Blob([svgMarkup(svg)], { type: 'image/svg+xml' }), fileName);
}

/** Rasterise the SVG at `scale` times its natural size (2 gives a crisp image for documents). */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const box = svg.viewBox.baseVal;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup(svg))}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed.'))), 'image/png'),
  );
}

export async function downloadPng(svg: SVGSVGElement, fileName: string, scale = 2) {
  download(await svgToPng(svg, scale), fileName);
}
