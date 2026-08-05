import fs from 'node:fs';
import path from 'node:path';
import * as docxPkg from '../../tmp/new-template/node_modules/docx/dist/index.mjs';
import { CONTRACT_CLAUSES } from '../../src/modules/document-engine/templates/participation-contract/contractClauses.ts';
import { readDocxPackage, readEntryData, replaceEntryData, writeDocxPackage } from '../../vite-plugins/document-merge/docxPackage.ts';

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign, Header, Footer, ImageRun, PageNumber, BorderStyle, ShadingType, Tab, TabStopType, SectionType } = docxPkg;
const OUT = '.tmp/sprint-25.7/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.clean.docx';
const LOGO = 'resources/assets/expovia-logo.png';
const RED='7A0F23', DARK='2D2D2D', GREY='F3F3F3', WHITE='FFFFFF', BORDER='D2D2D2';
const FONT='Arial';
const BW={style:BorderStyle.SINGLE,size:3,color:BORDER};
const OW={style:BorderStyle.SINGLE,size:10,color:DARK};
const borders={top:OW,bottom:OW,left:OW,right:OW,insideHorizontal:BW,insideVertical:BW};
const cellBorders={top:BW,bottom:BW,left:BW,right:BW};
const NW={style:BorderStyle.NONE,size:0,color:WHITE};
const noBorders={top:NW,bottom:NW,left:NW,right:NW,insideHorizontal:NW,insideVertical:NW};
const cellMargins={top:115,bottom:115,left:90,right:90};
const token=(tag)=>`@@TAG:${tag}@@`;
const checkToken=(tag)=>`@@CHECK:${tag}@@`;

function run(text,opts={}){return new TextRun({text,bold:opts.bold,color:opts.color??DARK,size:opts.size??15,font:FONT,break:opts.break});}
function p(text='',opts={}){const children=Array.isArray(text)?text:(typeof text==='string'?[run(text,opts)]:[text]);return new Paragraph({children,alignment:opts.align??AlignmentType.LEFT,spacing:{before:0,after:opts.after??0,line:opts.line??190},keepNext:opts.keepNext});}
function fieldP(tag,opts={}){return p(run(token(tag),{size:opts.size??14}));}
function cell(children,opts={}){return new TableCell({children:Array.isArray(children)?children:[children],width:{size:opts.width??1000,type:WidthType.DXA},columnSpan:opts.span,verticalAlign:opts.vAlign??VerticalAlign.CENTER,margins:opts.margins??cellMargins,shading:opts.fill?{fill:opts.fill,type:ShadingType.CLEAR}:undefined,borders:opts.noBorder?noBorders:cellBorders});}
function labelCell(label,width){return cell(p(label,{bold:true,size:14}),{width,fill:GREY});}
function valueCell(tag,width,opts={}){return cell(fieldP(tag,{size:opts.size}),{width});}
function table(rows,widths,opts={}){return new Table({rows,width:{size:opts.width??11100,type:WidthType.DXA},columnWidths:widths,borders:opts.noBorder?noBorders:borders,layout:'fixed'});}
function sectionTitle(number,title,icon='▣'){return p([run(`${icon}  ${number}. ${title}`,{bold:true,color:RED,size:19})],{after:90,keepNext:true,line:220});}
function band(text,span,width){return new TableRow({children:[cell(p(text,{bold:true,color:WHITE,size:14}),{span,width,fill:RED})],cantSplit:true});}
function headerRow(labels,widths){return new TableRow({children:labels.map((x,i)=>cell(p(x,{bold:true,size:13,align:AlignmentType.CENTER}),{width:widths[i],fill:WHITE})),cantSplit:true});}
function spacer(h=40){return new Paragraph({children:[],spacing:{before:0,after:h,line:40}});}

const logo=fs.readFileSync(LOGO);
const makeHeader=()=>new Header({children:[
  table([new TableRow({cantSplit:true,children:[
    cell(p(new ImageRun({data:logo,transformation:{width:175,height:61},type:'png'}),{align:AlignmentType.LEFT,line:1000}),{width:3000,noBorder:true,margins:{top:0,bottom:0,left:0,right:0}}),
    cell([p('FUAR KATILIMI',{bold:true,color:RED,size:25,align:AlignmentType.CENTER,line:250}),p('TEMSİLCİLİK SÖZLEŞMESİ',{bold:true,color:RED,size:25,align:AlignmentType.CENTER,line:250})],{width:4700,noBorder:true,margins:{top:0,bottom:0,left:0,right:0}}),
    cell([p([run('SÖZLEŞME NO  ',{bold:true,size:11}),run(token('Template.sozlesme_no'),{size:12})]),p([run('SÖZLEŞME TARİHİ  ',{bold:true,size:11}),run(token('Template.sozlesme_tarihi'),{size:12})])],{width:2600,noBorder:true,margins:{top:0,bottom:0,left:80,right:0}}),
    cell([p('▦',{bold:true,size:46,align:AlignmentType.CENTER,line:540}),p(run(token('Template.qr_kod'),{size:6}),{align:AlignmentType.CENTER,line:120})],{width:800,noBorder:true,margins:{top:0,bottom:0,left:0,right:0}}),
  ]})],[3000,4700,2600,800],{width:11100,noBorder:true}),
  new Paragraph({children:[],border:{bottom:{style:BorderStyle.SINGLE,size:10,color:RED}},spacing:{before:20,after:55}}),
]});

const makeFooter=()=>new Footer({children:[
  new Paragraph({children:[],border:{top:{style:BorderStyle.SINGLE,size:8,color:RED}},spacing:{after:25}}),
  table([new TableRow({cantSplit:true,children:[
    cell(p(new ImageRun({data:logo,transformation:{width:90,height:31},type:'png'}),{align:AlignmentType.LEFT,line:520}),{width:1500,noBorder:true,margins:{top:0,bottom:0,left:0,right:40}}),
    cell([p('EXPOVIA ULUSLARARASI FUARCILIK TEKNOLOJİ İÇ VE DIŞ TİCARET LTD. ŞTİ.',{bold:true,size:9,line:150}),p(run(token('Template.expovia_merkez_adresi'),{size:8}),{line:140})],{width:5700,noBorder:true,margins:{top:0,bottom:0,left:0,right:50}}),
    cell([p('☎  +90 542 789 55 91',{size:8,line:140}),p('✉  info@expovia.com',{size:8,line:140}),p(run(token('Template.expovia_web_sitesi'),{size:8}),{line:140})],{width:2500,noBorder:true,margins:{top:0,bottom:0,left:40,right:0}}),
    cell([p([run('Vergi Dairesi: ',{bold:true,size:8}),run(token('Template.expovia_vergi_dairesi'),{size:8})],{line:140}),p([run('Vergi No: ',{bold:true,size:8}),run(token('Template.expovia_vergi_no'),{size:8})],{line:140})],{width:1400,noBorder:true,margins:{top:0,bottom:0,left:0,right:0}}),
  ]})],[1500,5700,2500,1400],{width:11100,noBorder:true}),
  new Paragraph({children:[run('MERSİS: ',{bold:true,size:7}),run(token('Template.expovia_mersis_no'),{size:7}),run('   Sicil: ',{bold:true,size:7}),run(token('Template.expovia_ticaret_sicil_no'),{size:7})],alignment:AlignmentType.RIGHT,spacing:{before:0,after:0,line:130}}),
  new Paragraph({alignment:AlignmentType.CENTER,children:[run('Sayfa ',{size:10}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:10}),run(' / ',{size:10}),new TextRun({children:[PageNumber.TOTAL_PAGES],font:FONT,size:10})],spacing:{before:10,after:0,line:150}}),
]});

const fair=table([
 new TableRow({children:[labelCell('Fuar Adı',1700),valueCell('Template.fuar_adi',3850),labelCell('Tarih',1600),valueCell('Template.fuar_tarih',3950)]}),
 new TableRow({children:[labelCell('Ülke',1700),valueCell('Template.ulke',3850),labelCell('Şehir',1600),valueCell('Template.sehir',3950)]}),
 new TableRow({children:[labelCell('Fuar Alanı / Hol',1700),cell(p([run(token('Template.fuar_alani'),{size:14}),run('  ',{size:14}),run(token('Template.hol'),{size:14})]),{width:3850}),labelCell('Stand No',1600),valueCell('Template.stand_no',3950)]}),
 new TableRow({children:[labelCell('Stand Alanı',1700),cell(p([run(token('Template.stand_alani'),{size:14}),run(' m²',{size:14})]),{width:3850}),labelCell('Stand Türü',1600),cell(p([run(token('Template.stand_turu'),{size:14}),run(' ',{size:14}),run(token('Template.stand_sekli'),{size:14})]),{width:3950})]}),
],[1700,3850,1600,3950]);

const company=table([
 new TableRow({children:[labelCell('TİCARİ ÜNVAN',1700),valueCell('Company.LegalName',3850),labelCell('TELEFON',1600),valueCell('Contact.Phone',3950)]}),
 new TableRow({children:[labelCell('ADRES',1700),valueCell('Company.Address',3850),labelCell('E-POSTA',1600),valueCell('Contact.Email',3950)]}),
 new TableRow({children:[labelCell('',1700),cell(p([run(token('Company.City'),{size:14}),run(' / ',{size:14}),run(token('Company.Country'),{size:14})]),{width:3850}),labelCell('FUAR YETKİLİSİ',1600),valueCell('Contact.ExhibitionContact',3950)]}),
 new TableRow({children:[labelCell('VERGİ DAİRESİ',1700),valueCell('Company.TaxOffice',3850),labelCell('İMZA YETKİLİSİ',1600),valueCell('Contact.Signatory',3950)]}),
 new TableRow({children:[labelCell('VERGİ NUMARASI',1700),valueCell('Company.TaxNumber',3850),labelCell('WEB SİTESİ',1600),valueCell('Company.Website',3950)]}),
],[1700,3850,1600,3950]);

const priceKeys=[['Stand Bedeli','StandFee'],['Kayıt Bedeli','RegistrationFee'],['Ek Hizmetler','AdditionalServices'],['İndirim','Discount'],['Vergi (%20 KDV)','Tax'],['ORGANİZATÖR TOPLAMI','OrganizerTotal']];
const pricingRows=[band('ORGANİZATÖR KATILIM BEDELİ',3,5400),headerRow(['KALEM','TUTAR','PARA BİRİMİ'],[2900,1300,1200]),...priceKeys.map(([label,key])=>new TableRow({children:[cell(p(label,{bold:key==='OrganizerTotal',size:12}),{width:2900}),valueCell(`Pricing.${key}.Amount`,1300,{size:12}),valueCell(`Pricing.${key}.Currency`,1200,{size:12})]})),band('EXPOVIA HİZMET BEDELİ',3,5400),headerRow(['KALEM','TUTAR','PARA BİRİMİ'],[2900,1300,1200]),new TableRow({children:[cell(p('Temsilcilik / Hizmet Bedeli (KDV Dahil)',{size:11}),{width:2900}),valueCell('Pricing.ServiceFee.Amount',1300,{size:12}),valueCell('Pricing.ServiceFee.Currency',1200,{size:12})]}),new TableRow({children:[cell(p('GENEL TOPLAM',{bold:true,size:13}),{width:2900,fill:WHITE}),valueCell('Pricing.GrandTotal.Amount',1300,{size:13}),valueCell('Pricing.GrandTotal.Currency',1200,{size:13})]})];
const pricing=table(pricingRows,[2900,1300,1200],{width:5400});
const payments=[band('ÖDEME PLANI',4,5400),headerRow(['NO','VADE TARİHİ','TUTAR','AÇIKLAMA'],[520,1420,1230,2230]),...Array.from({length:5},(_,i)=>new TableRow({children:[cell(p(String(i+1),{bold:true,size:12,align:AlignmentType.CENTER}),{width:520}),valueCell(`PaymentPlan.Payment${i+1}.DueDate`,1420,{size:12}),valueCell(`PaymentPlan.Payment${i+1}.Amount`,1230,{size:12}),valueCell(`PaymentPlan.Payment${i+1}.Payee`,2230,{size:12})]}))];
const bank=table([new TableRow({children:[labelCell('HESAP SAHİBİ',1500),cell(p(''),{width:3900})]}),new TableRow({children:[labelCell('BANKA ADI',1500),valueCell('Bank.BankName',3900,{size:11})]}),new TableRow({children:[labelCell('ŞUBE / ADRES',1500),valueCell('Bank.BranchAddress',3900,{size:11})]}),new TableRow({children:[labelCell('IBAN (EUR)',1500),valueCell('Bank.IbanEur',3900,{size:11})]}),new TableRow({children:[labelCell('IBAN (USD)',1500),valueCell('Bank.IbanUsd',3900,{size:11})]})],[1500,3900],{width:5400});
const financial=table([new TableRow({children:[cell(pricing,{width:5550,noBorder:true,margins:{top:0,bottom:0,left:0,right:75}}),cell([table(payments,[520,1420,1230,2230],{width:5400}),bank],{width:5550,noBorder:true,margins:{top:0,bottom:0,left:75,right:0}})]})],[5550,5550],{noBorder:true});

const materialItems=[['Alınlık Yazısı','HeaderText'],['Dijital Baskılar','DigitalPrints'],['Masa','Table'],['Raf','Shelf'],['Askılık Boru','HangingRail'],['Spot','Spotlight'],['Priz','PowerSocket'],['Buzdolabı','Refrigerator'],['Info Desk','InfoDesk'],['Sandalye','Chair'],['Çöp Kovası','WasteBin'],['Diğer','Other']];
const matCells=materialItems.map(([label,key])=>cell(p([run(checkToken(`StandMaterials.${key}.Selected`),{size:17}),run(` ${label}  `,{size:15}),...(key==='HeaderText'||key==='DigitalPrints'||key==='Other'?[]:[run(token(`StandMaterials.${key}.Quantity`),{size:15}),run(' adet',{size:14})])]),{width:1660,noBorder:true,margins:{top:38,bottom:38,left:38,right:24}}));
const standMaterialsBox=table([new TableRow({children:[cell([p([run('STAND MALZEMELERİ ',{bold:true,color:RED,size:17}),run('(Görüşme ile belirlenecektir)',{size:13})]),spacer(190),table(Array.from({length:4},(_,r)=>new TableRow({children:matCells.slice(r*3,r*3+3)})),[1660,1660,1660],{width:4980,noBorder:true}),spacer(520)],{width:5400,margins:{top:115,bottom:115,left:90,right:90}})]})],[5400],{width:5400});
const extraMaterialsBox=table([new TableRow({children:[cell([p('EKSTRA MALZEME BİLGİSİ VE AÇIKLAMALAR',{bold:true,color:RED,size:17}),fieldP('ExtraInformation.Line1',{size:15}),fieldP('ExtraInformation.Line2',{size:15}),fieldP('ExtraInformation.Line3',{size:15}),spacer(710)],{width:5400,margins:{top:115,bottom:115,left:90,right:90}})]})],[5400],{width:5400});
const materials=table([new TableRow({children:[cell(standMaterialsBox,{width:5550,noBorder:true,margins:{top:0,bottom:0,left:0,right:75}}),cell(extraMaterialsBox,{width:5550,noBorder:true,margins:{top:0,bottom:0,left:75,right:0}})]})],[5550,5550],{noBorder:true});

function clauseBlock(c){return [p([run(`${c.number}.`,{bold:true,color:RED,size:18}),run(`  ${c.title}`,{bold:true,color:RED,size:19})],{after:42,keepNext:true,line:240}),...c.body.map(line=>p(line,{size:18,line:235,after:45}))];}
const leftClauses=CONTRACT_CLAUSES.filter(c=>c.number<=4).flatMap(clauseBlock);
const rightClauses=CONTRACT_CLAUSES.filter(c=>c.number>=5).flatMap(clauseBlock);
const clauses=table([new TableRow({children:[cell(leftClauses,{width:5450,noBorder:true,margins:{top:0,bottom:0,left:0,right:150}}),cell(rightClauses,{width:5450,noBorder:true,margins:{top:0,bottom:0,left:150,right:0}})]})],[5450,5450],{width:10900,noBorder:true});
function signatureBox(title,nameTag,dateTag){return cell([p(title,{bold:true,color:RED,size:15,align:AlignmentType.CENTER,after:70}),p([run('Ad Soyad / Ünvan   ',{bold:true,size:13}),run(token(nameTag),{size:13})]),p('Görev / Ünvan',{bold:true,size:13}),p('Kaşe',{bold:true,size:13}),spacer(560),p('İmza',{bold:true,size:13}),p([run('Tarih   ',{bold:true,size:13}),run(token(dateTag),{size:13})])],{width:5300,margins:{top:90,bottom:90,left:140,right:140}});}
const signatures=table([new TableRow({cantSplit:true,children:[signatureBox('KATILIMCI FİRMA','Signature.Participant.NameTitle','Signature.Participant.Date'),cell(p(''),{width:300,noBorder:true}),signatureBox('EXPOVIA / TEMSİLCİ','Signature.ExpoviaRepresentative.NameTitle','Signature.ExpoviaRepresentative.Date')]})],[5300,300,5300],{width:10900,noBorder:true});

const pageProps={page:{size:{width:11906,height:16838},margin:{top:1900,bottom:1250,left:280,right:280,header:180,footer:180}}};
const page1=[sectionTitle('1','FUAR BİLGİLERİ','⌂'),fair,spacer(190),sectionTitle('2','KATILIMCI FİRMA BİLGİLERİ','▧'),company,spacer(190),sectionTitle('3','ÜCRET VE FİYAT BİLGİLERİ','⚿'),financial,spacer(190),materials,spacer(190)];
const page2=[sectionTitle('4','SÖZLEŞME KAPSAMI VE MADDELER','▤'),clauses,spacer(55),sectionTitle('5','İMZA VE ONAY','⚑'),signatures];
const doc=new Document({styles:{default:{document:{run:{font:FONT,size:15,color:DARK},paragraph:{spacing:{before:0,after:0,line:190}}}}},sections:[{properties:pageProps,headers:{default:makeHeader()},footers:{default:makeFooter()},children:page1},{properties:{...pageProps,type:SectionType.NEXT_PAGE},headers:{default:makeHeader()},footers:{default:makeFooter()},children:page2}]});

function makeTextSdt(tag,runProps=''){return `<w:sdt><w:sdtPr><w:alias w:val="${tag}"/><w:tag w:val="${tag}"/><w:text/></w:sdtPr><w:sdtContent><w:r>${runProps}<w:t></w:t></w:r></w:sdtContent></w:sdt>`;}
function makeCheckSdt(tag){return `<w:sdt><w:sdtPr><w:alias w:val="${tag}"/><w:tag w:val="${tag}"/><w14:checkbox><w14:checked w14:val="0"/><w14:checkedState w14:val="2612" w14:font="MS Gothic"/><w14:uncheckedState w14:val="2610" w14:font="MS Gothic"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="13"/></w:rPr><w:t>☐</w:t></w:r></w:sdtContent></w:sdt>`;}
function patchPart(xml){
  xml=xml.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*?@@TAG:([^@]+)@@(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g,(block,tag)=>makeTextSdt(tag,block.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0]??''));
  xml=xml.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*?@@CHECK:([^@]+)@@(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g,(_block,tag)=>makeCheckSdt(tag));
  return xml;
}
const packed=await Packer.toBuffer(doc);
const entries=readDocxPackage(packed).map(e=>{
  if(/^word\/(document|header\d+|footer\d+)\.xml$/.test(e.name)) return replaceEntryData(e,Buffer.from(patchPart(readEntryData(e).toString('utf8')),'utf8'));
  if(e.name==='word/settings.xml'){
    const settings=readEntryData(e).toString('utf8').replace(/<w:compat>[\s\S]*?<\/w:compat>/g,'').replace(/<w:documentProtection\b[^>]*\/>/g,'').replace('</w:settings>','<w:documentProtection w:edit="readOnly" w:enforcement="1"/></w:settings>');
    return replaceEntryData(e,Buffer.from(settings,'utf8'));
  }
  return e;
});
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,writeDocxPackage(entries));
console.log(OUT);
