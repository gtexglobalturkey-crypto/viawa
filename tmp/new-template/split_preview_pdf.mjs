import fs from 'node:fs';
import pdfLib from '../pdfs/node_modules/pdf-lib/cjs/index.js';
const { PDFDocument } = pdfLib;

const input = process.argv[2] || 'tmp/new-template/render/VIAWA_Sozlesme_Sablonu_v2.4.pdf';
const prefix = process.argv[3] || 'page';
const source = await PDFDocument.load(fs.readFileSync(input));
for (let index = 0; index < source.getPageCount(); index += 1) {
  const output = await PDFDocument.create();
  const [page] = await output.copyPages(source, [index]);
  output.addPage(page);
  fs.writeFileSync(`tmp/new-template/render/${prefix}-${index + 1}.pdf`, await output.save());
}
