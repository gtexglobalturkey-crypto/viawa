import fs from 'node:fs';
import {
  readDocxPackage,
  readEntryData,
  replaceEntryData,
  writeDocxPackage,
} from '../../vite-plugins/document-merge/docxPackage.ts';

const basePath = 'resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx';
const outputPath = 'resources/templates/VIAWA_Sozlesme_Sablonu_v2.4.docx';
const page1Png = fs.readFileSync('tmp/new-template/page-1.png');
const page2Png = fs.readFileSync('tmp/new-template/page-2.png');
const baseEntries = readDocxPackage(fs.readFileSync(basePath));

const xmlEscape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pxToPtX = (value) => (value * 595.28 / 768).toFixed(2);
const pxToPtY = (value) => (value * 841.89 / 1024).toFixed(2);
const visible = new Set();
let shapeId = 2000;

function textSdt(tag, placeholder = '') {
  visible.add(tag);
  const fieldName = tag.split('.').at(-1);
  const text = placeholder || (
    fieldName === 'Amount' ? '0,00' :
    fieldName === 'Currency' ? 'EUR' :
    fieldName === 'Quantity' ? '__' :
    fieldName === 'DueDate' || fieldName === 'Date' ? 'GG.AA.YYYY' :
    fieldName === 'Payee' ? 'Açıklama' :
    `«${fieldName}»`
  );
  return `<w:sdt><w:sdtPr><w:alias w:val="${xmlEscape(tag)}"/><w:tag w:val="${xmlEscape(tag)}"/><w:text/></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="111111"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:sdtContent></w:sdt>`;
}

function checkboxSdt(tag) {
  visible.add(tag);
  return `<w:sdt><w:sdtPr><w:alias w:val="${xmlEscape(tag)}"/><w:tag w:val="${xmlEscape(tag)}"/><w14:checkbox><w14:checked w14:val="0"/><w14:checkedState w14:val="2612" w14:font="MS Gothic"/><w14:uncheckedState w14:val="2610" w14:font="MS Gothic"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="15"/></w:rPr><w:t>☐</w:t></w:r></w:sdtContent></w:sdt>`;
}

function box(tag, x, y, w, h, options = {}) {
  const fill = options.fill ?? '#FFFFFF';
  const fontPt = options.fontPt ?? 6.7;
  const inset = options.inset ?? '2pt,1pt,2pt,1pt';
  const content = options.checkbox ? checkboxSdt(tag) : textSdt(tag, options.placeholder);
  return `<w:r><w:pict><v:rect id="field-${shapeId++}" stroked="f" fillcolor="${fill}" style="position:absolute;margin-left:${pxToPtX(x)}pt;margin-top:${pxToPtY(y)}pt;width:${pxToPtX(w)}pt;height:${pxToPtY(h)}pt;z-index:10;mso-position-horizontal-relative:page;mso-position-vertical-relative:page"><v:textbox inset="${inset}"><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="180" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="${Math.round(fontPt * 2)}"/></w:rPr></w:r>${content}</w:p></w:txbxContent></v:textbox></v:rect></w:pict></w:r>`;
}

function background(relId) {
  return `<w:r><w:pict><v:rect id="background-${shapeId++}" stroked="f" style="position:absolute;margin-left:0pt;margin-top:0pt;width:595.28pt;height:841.89pt;z-index:-251658240;mso-position-horizontal-relative:page;mso-position-vertical-relative:page"><v:imagedata r:id="${relId}" o:title="Contract page"/></v:rect></w:pict></w:r>`;
}

const p1 = [];
const add1 = (...args) => p1.push(box(...args));
add1('Template.sozlesme_no',568,32,105,18,{fontPt:6});
add1('Template.sozlesme_tarihi',568,64,105,18,{fontPt:6});
add1('Template.fuar_adi',148,145,241,24);
add1('Template.fuar_tarih',503,145,237,24);
add1('Template.ulke',148,170,241,24);
add1('Template.sehir',503,170,237,24);
add1('Template.fuar_alani',148,194,168,24);
add1('Template.hol',316,194,73,24);
add1('Template.stand_no',503,194,237,24);
add1('Template.stand_alani',148,219,241,24);
add1('Template.stand_turu',503,219,155,24);
add1('Template.stand_sekli',658,219,82,24);
add1('Company.LegalName',150,292,247,25);
add1('Contact.Email',522,292,220,25);
add1('Company.Address',150,318,247,27,{fontPt:6});
add1('Company.City',150,345,120,21,{fontPt:6});
add1('Company.Country',270,345,127,21,{fontPt:6});
add1('Contact.ExhibitionContact',522,318,220,25);
add1('Contact.Signatory',522,343,220,48,{fontPt:6});
add1('Company.TaxOffice',150,367,247,24);
add1('Company.TaxNumber',150,392,247,24);
add1('Contact.Phone',150,416,247,24);
add1('Company.Website',522,392,220,48);

const priceRows = [499,522,545,568,591,614,662,714];
const priceKeys = ['StandFee','RegistrationFee','AdditionalServices','Discount','Tax','OrganizerTotal','ServiceFee','GrandTotal'];
priceKeys.forEach((key,index)=>{
  const y=key === 'ServiceFee' ? 685 : priceRows[index];
  add1(`Pricing.${key}.Amount`,196,y,80,index===7?34:22,{fontPt:index===7?9:6.5});
  add1(`Pricing.${key}.Currency`,278,y,82,index===7?34:22,{fontPt:index===7?8:6.5});
});
for(let i=0;i<5;i++){
  const y=499+i*24;
  add1(`PaymentPlan.Payment${i+1}.DueDate`,448,y,82,23,{fontPt:6});
  add1(`PaymentPlan.Payment${i+1}.Amount`,531,y,80,23,{fontPt:6});
  add1(`PaymentPlan.Payment${i+1}.Payee`,612,y,128,23,{fontPt:6});
}
add1('Bank.BankName',522,696,219,24,{fontPt:6});
add1('Bank.BranchAddress',522,720,219,24,{fontPt:6});
add1('Bank.IbanEur',522,744,219,24,{fontPt:6});
add1('Bank.IbanUsd',522,768,219,24,{fontPt:6});
const mats=[
 ['HeaderText',39,810],['DigitalPrints',168,810],['Table',306,810],['Shelf',39,829],['HangingRail',168,829],['Spotlight',306,829],
 ['PowerSocket',39,848],['Refrigerator',168,848],['InfoDesk',306,848],['Chair',39,867],['WasteBin',168,867],['Other',306,867],
];
mats.forEach(([key,x,y])=>add1(`StandMaterials.${key}.Selected`,x,y,12,12,{checkbox:true,fontPt:7,inset:'0pt,0pt,0pt,0pt'}));
const quantityKeys=['Table','Shelf','HangingRail','Spotlight','PowerSocket','Refrigerator','InfoDesk','Chair','WasteBin'];
const materialCoord=Object.fromEntries(mats.map(([k,x,y])=>[k,[x,y]]));
quantityKeys.forEach(key=>{const [x,y]=materialCoord[key];add1(`StandMaterials.${key}.Quantity`,x+66,y-2,40,15,{fontPt:5.5});});
add1('ExtraInformation.Line1',462,807,265,22,{fontPt:6});
add1('ExtraInformation.Line2',462,830,265,22,{fontPt:6});
add1('ExtraInformation.Line3',462,853,265,22,{fontPt:6});

const p2=[];
const add2=(...args)=>p2.push(box(...args));
add2('Signature.Participant.NameTitle',145,787,190,42,{fontPt:6});
add2('Signature.Participant.Date',145,892,190,21,{fontPt:6});
add2('Signature.ExpoviaRepresentative.NameTitle',513,787,190,42,{fontPt:6});
add2('Signature.ExpoviaRepresentative.Date',513,892,190,21,{fontPt:6});

const allTags = new Set();
for (const entry of baseEntries) {
  if (!/^word\/(document|header\d+|footer\d+)\.xml$/.test(entry.name)) continue;
  const xml = readEntryData(entry).toString('utf8');
  for (const match of xml.matchAll(/<w:tag\b[^>]*\bw:val="([^"]+)"/g)) allTags.add(match[1]);
}
allTags.add('Company.Website');
// Preserve mappings that are intentionally not visually printed in the supplied design.
const hidden = [...allTags].filter(tag=>!visible.has(tag)).map(tag=>`<w:r><w:rPr><w:vanish/></w:rPr>${textSdt(tag,'')}</w:r>`).join('');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><w:body>
<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>${background('rIdBg1')}${p1.join('')}${hidden}</w:p>
<w:p><w:r><w:br w:type="page"/></w:r></w:p>
<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>${background('rIdBg2')}${p2.join('')}</w:p>
<w:sectPr><w:pgSz w:w="11905" w:h="16837"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

let entries = baseEntries.map(entry=>{
  if(entry.name==='word/document.xml') return replaceEntryData(entry,Buffer.from(documentXml,'utf8'));
  if(entry.name==='word/media/image1.png') return replaceEntryData(entry,page1Png);
  if(entry.name==='word/_rels/document.xml.rels'){
    let rels=readEntryData(entry).toString('utf8');
    rels=rels.replace('</Relationships>','<Relationship Id="rIdBg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/><Relationship Id="rIdBg2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/></Relationships>');
    return replaceEntryData(entry,Buffer.from(rels,'utf8'));
  }
  return entry;
});
const imageTemplate=entries.find(entry=>entry.name==='word/media/image1.png');
entries.push({...replaceEntryData(imageTemplate,page2Png),name:'word/media/image2.png'});
fs.writeFileSync(outputPath,writeDocxPackage(entries));
console.log(JSON.stringify({outputPath,tags:allTags.size,visible:visible.size,hidden:[...allTags].filter(tag=>!visible.has(tag)).length},null,2));
