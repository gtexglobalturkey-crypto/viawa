import fs from 'node:fs';
import { createCanvas, Image, ImageData, Path2D, DOMMatrix } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

globalThis.Image = Image;
globalThis.ImageData = ImageData;
globalThis.Path2D = Path2D;
globalThis.DOMMatrix = DOMMatrix;

const data = new Uint8Array(fs.readFileSync('output/pdf/expovia_doldurulabilir_fuar_katilim_sozlesmesi.pdf'));
const standardFontDataUrl = new URL('./node_modules/pdfjs-dist/standard_fonts/', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const doc = await pdfjsLib.getDocument({ data, disableWorker: true, standardFontDataUrl }).promise;
console.log('pages', doc.numPages);
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  console.log('rendered', n);
  fs.writeFileSync(`tmp/pdfs/render/page-${n}.png`, canvas.toBuffer('image/png'));
}
