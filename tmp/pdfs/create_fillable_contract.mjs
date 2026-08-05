import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const source = 'C:/Users/ahmet/Downloads/ChatGPT Image Aug 3, 2026, 01_54_14 PM.png';
const output = 'output/pdf/expovia_doldurulabilir_fuar_katilim_sozlesmesi.pdf';
fs.mkdirSync(path.dirname(output), { recursive: true });

const pdf = await PDFDocument.create();
const png = await pdf.embedPng(fs.readFileSync(source));
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const IMG_PAGE_W = 768;
const IMG_H = 1024;
const sx = PAGE_W / IMG_PAGE_W;
const sy = PAGE_H / IMG_H;
const form = pdf.getForm();
const font = await pdf.embedFont(StandardFonts.Helvetica);

function pxRect(x, y, w, h) {
  return { x: x * sx, y: PAGE_H - (y + h) * sy, width: w * sx, height: h * sy };
}

function textField(page, name, x, y, w, h, opts = {}) {
  const f = form.createTextField(name);
  if (opts.multiline) f.enableMultiline();
  if (opts.maxLength) f.setMaxLength(opts.maxLength);
  f.addToPage(page, {
    ...pxRect(x, y, w, h),
    textColor: rgb(0.08, 0.08, 0.08),
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0.82, 0.82, 0.82),
    borderWidth: 0.45,
    font,
  });
  f.setFontSize(opts.fontSize ?? 8);
  return f;
}

function checkbox(page, name, x, y, size = 11) {
  const f = form.createCheckBox(name);
  f.addToPage(page, {
    ...pxRect(x, y, size, size),
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(0.35, 0.35, 0.35),
    borderWidth: 0.65,
  });
}

const p1 = pdf.addPage([PAGE_W, PAGE_H]);
p1.drawImage(png, { x: 0, y: 0, width: PAGE_W * 2, height: PAGE_H });
const p2 = pdf.addPage([PAGE_W, PAGE_H]);
p2.drawImage(png, { x: -PAGE_W, y: 0, width: PAGE_W * 2, height: PAGE_H });

// Sayfa 1 - sözleşme ve fuar bilgileri
textField(p1, 'sozlesme_no', 681, 34, 68, 18, { fontSize: 7 });
textField(p1, 'duzenleme_tarihi', 681, 65, 68, 17, { fontSize: 7 });
textField(p1, 'fuar_adi', 148, 145, 241, 24);
textField(p1, 'fuar_tarihi', 503, 145, 237, 24);
textField(p1, 'ulke', 148, 170, 241, 24);
textField(p1, 'sehir', 503, 170, 237, 24);
textField(p1, 'fuar_alani_hol', 148, 194, 241, 24);
textField(p1, 'stand_no', 503, 194, 237, 24);
textField(p1, 'stand_alani', 148, 219, 241, 24);
textField(p1, 'stand_turu', 503, 219, 237, 24);

// Katılımcı firma
textField(p1, 'ticari_unvan', 150, 292, 247, 25);
textField(p1, 'eposta', 522, 292, 220, 25);
textField(p1, 'adres', 150, 318, 247, 48, { multiline: true, fontSize: 7 });
textField(p1, 'fuar_yetkilisi', 522, 318, 220, 25);
textField(p1, 'imza_yetkilisi', 522, 343, 220, 48, { multiline: true, fontSize: 7 });
textField(p1, 'vergi_dairesi', 150, 367, 247, 24);
textField(p1, 'vergi_numarasi', 150, 392, 247, 24);
textField(p1, 'telefon', 150, 416, 247, 24);
textField(p1, 'web_sitesi', 522, 392, 220, 48);

// Ücretler
const feeRows = [499, 522, 545, 568, 591, 614];
const feeNames = ['stand_bedeli', 'kayit_bedeli', 'ek_hizmetler', 'indirim', 'vergi', 'organizator_toplami'];
for (let i = 0; i < feeRows.length; i++) {
  textField(p1, feeNames[i] + '_tutar', 196, feeRows[i], 80, 22, { fontSize: 7 });
  textField(p1, feeNames[i] + '_para_birimi', 278, feeRows[i], 82, 22, { fontSize: 7 });
}
textField(p1, 'expovia_hizmet_bedeli', 196, 662, 80, 24, { fontSize: 7 });
textField(p1, 'expovia_hizmet_para_birimi', 278, 662, 82, 24, { fontSize: 7 });
textField(p1, 'genel_toplam', 170, 714, 105, 34, { fontSize: 11 });
textField(p1, 'genel_toplam_para_birimi', 278, 714, 82, 34, { fontSize: 10 });

// Ödeme planı
for (let i = 0; i < 5; i++) {
  const y = 499 + i * 24;
  textField(p1, `odeme_${i + 1}_vade`, 448, y, 82, 23, { fontSize: 7 });
  textField(p1, `odeme_${i + 1}_tutar`, 531, y, 80, 23, { fontSize: 7 });
  textField(p1, `odeme_${i + 1}_aciklama`, 612, y, 128, 23, { fontSize: 7 });
}

// Banka bilgileri
textField(p1, 'hesap_sahibi', 522, 653, 219, 42, { multiline: true, fontSize: 6 });
textField(p1, 'banka_adi', 522, 696, 219, 24, { fontSize: 7 });
textField(p1, 'banka_sube_adres', 522, 720, 219, 24, { fontSize: 7 });
textField(p1, 'iban_eur', 522, 744, 219, 24, { fontSize: 7 });
textField(p1, 'iban_usd', 522, 768, 219, 24, { fontSize: 7 });

// Stand malzemeleri
const materials = [
  ['alinlik_yazisi', 39, 810], ['raf', 39, 829], ['priz', 39, 848], ['sandalye', 39, 867],
  ['dijital_baskilar', 168, 810], ['askilik_boru', 168, 829], ['buzdolabi', 168, 848], ['cop_kovasi', 168, 867],
  ['masa', 306, 810], ['spot', 306, 829], ['info_desk', 306, 848], ['diger', 306, 867],
];
for (const [name, x, y] of materials) checkbox(p1, `malzeme_${name}`, x, y, 10);
for (const [name, x, y] of materials) {
  if (['alinlik_yazisi', 'dijital_baskilar', 'diger'].includes(name)) continue;
  textField(p1, `malzeme_${name}_adet`, x + 66, y - 2, 40, 15, { fontSize: 6 });
}
textField(p1, 'ekstra_malzeme_aciklama', 462, 807, 265, 75, { multiline: true, fontSize: 7 });

// Sayfa 2 - imza ve onay alanları (koordinatlar sayfa 2'nin kendi 768 px genişliğine göre)
textField(p2, 'katilimci_ad_unvan', 145, 787, 190, 21, { fontSize: 7 });
textField(p2, 'katilimci_gorev_unvan', 145, 809, 190, 21, { fontSize: 7 });
textField(p2, 'katilimci_kase', 145, 831, 190, 38, { multiline: true, fontSize: 7 });
textField(p2, 'katilimci_imza', 145, 870, 190, 21, { fontSize: 7 });
textField(p2, 'katilimci_tarih', 145, 892, 190, 21, { fontSize: 7 });
textField(p2, 'expovia_temsilci_ad_unvan', 513, 787, 190, 21, { fontSize: 7 });
textField(p2, 'expovia_temsilci_gorev_unvan', 513, 809, 190, 21, { fontSize: 7 });
textField(p2, 'expovia_temsilci_kase', 513, 831, 190, 38, { multiline: true, fontSize: 7 });
textField(p2, 'expovia_temsilci_imza', 513, 870, 190, 21, { fontSize: 7 });
textField(p2, 'expovia_temsilci_tarih', 513, 892, 190, 21, { fontSize: 7 });

form.updateFieldAppearances(font);
pdf.setTitle('EXPOVIA Fuar Katılımı Temsilcilik Sözleşmesi - Doldurulabilir');
pdf.setAuthor('EXPOVIA');
pdf.setSubject('Doldurulabilir fuar katılımı temsilcilik sözleşmesi');
pdf.setCreator('Codex');
fs.writeFileSync(output, await pdf.save());
console.log(output);
