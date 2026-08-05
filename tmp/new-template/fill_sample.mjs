import fs from 'node:fs';
import { mergeDocxBuffer } from '../../vite-plugins/document-merge/docxMergeAdapter.ts';

const templateBuffer = fs.readFileSync('resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx');
const values = {
  'Template.sozlesme_no':'EXP-2027-000002','Template.sozlesme_tarihi':'03.08.2026','Template.qr_kod':'EXP-2027-000002',
  'Template.fuar_adi':'Mining Türkiye 2027','Template.fuar_tarih':'06 - 09 Mayıs 2027','Template.ulke':'Türkiye','Template.sehir':'İstanbul','Template.fuar_alani':'İFM','Template.hol':'Hol 4','Template.stand_no':'A-120','Template.stand_alani':'36 m²','Template.stand_turu':'Standart Stand','Template.stand_sekli':'Köşe',
  'Company.LegalName':'ABC MADENCİLİK ENDÜSTRİYEL ÜRÜNLER İTHALAT İHRACAT SANAYİ VE TİCARET ANONİM ŞİRKETİ','Company.Address':'Atatürk Bulvarı No: 123 Kat: 4 Daire: 12 Organize Sanayi Bölgesi Teknoloji Geliştirme Merkezi','Company.City':'Ankara','Company.Country':'Türkiye','Company.TaxOffice':'Çankaya','Company.TaxNumber':'123 456 7890','Company.Website':'www.abcmadencilik.com',
  'Contact.Phone':'+90 312 123 45 67','Contact.Email':'info@abcmadencilik.com','Contact.ExhibitionContact':'Ahmet Yılmaz','Contact.Signatory':'Mehmet Kaya - Genel Müdür',
  'Pricing.StandFee.Amount':'7.200,00','Pricing.StandFee.Currency':'EUR','Pricing.RegistrationFee.Amount':'450,00','Pricing.RegistrationFee.Currency':'EUR','Pricing.AdditionalServices.Amount':'1.250,00','Pricing.AdditionalServices.Currency':'EUR','Pricing.Discount.Amount':'0,00','Pricing.Discount.Currency':'EUR','Pricing.Tax.Amount':'2.644,00','Pricing.Tax.Currency':'EUR','Pricing.OrganizerTotal.Amount':'12.264,00','Pricing.OrganizerTotal.Currency':'EUR','Pricing.ServiceFee.Amount':'3.600,00','Pricing.ServiceFee.Currency':'EUR','Pricing.GrandTotal.Amount':'15.864,00','Pricing.GrandTotal.Currency':'EUR',
  'Bank.BankName':'Örnek Bankası','Bank.BranchAddress':'İstanbul Kurumsal Şube','Bank.IbanEur':'TR00 0000 0000 0000 0000 0000 00','Bank.IbanUsd':'TR00 0000 0000 0000 0000 0000 01',
  'ExtraInformation.Line1':'Ek talepler görüşme ile belirlenecektir.','ExtraInformation.Line2':'','ExtraInformation.Line3':'',
  'Signature.Participant.NameTitle':'Mehmet Kaya - Genel Müdür','Signature.Participant.Date':'03.08.2026','Signature.ExpoviaRepresentative.NameTitle':'Ayşe Demir - Satış Direktörü','Signature.ExpoviaRepresentative.Date':'03.08.2026',
};
for(let i=1;i<=5;i++){
  values[`PaymentPlan.Payment${i}.DueDate`]=i<=2?`0${i}.09.2026`:'';
  values[`PaymentPlan.Payment${i}.Amount`]=i<=2?(i===1?'8.000,00':'7.864,00'):'';
  values[`PaymentPlan.Payment${i}.Payee`]=i<=2?'EXPOVIA':'';
}
for(const key of ['HeaderText','DigitalPrints','Table','Shelf','HangingRail','Spotlight','PowerSocket','Refrigerator','InfoDesk','Chair','WasteBin','Other']) values[`StandMaterials.${key}.Selected`]=['Table','Chair','Spotlight'].includes(key);
for(const key of ['Table','Shelf','HangingRail','Spotlight','PowerSocket','Refrigerator','InfoDesk','Chair','WasteBin']) values[`StandMaterials.${key}.Quantity`]=key==='Table'?'1':key==='Chair'?'2':key==='Spotlight'?'3':'';
for(const tag of ['Template.expovia_merkez_adresi','Template.expovia_mersis_no','Template.expovia_ticaret_sicil_no','Template.expovia_vergi_dairesi','Template.expovia_vergi_no','Template.expovia_web_sitesi']) values[tag]='';
const result=mergeDocxBuffer({templateBuffer,mergeResult:{values,missingRequiredTags:[]}});
fs.writeFileSync('tmp/final-contract/VIAWA_Sozlesme_Stress_Test.docx',result.outputBuffer);
console.log(JSON.stringify({updated:result.totalContentControlOccurrencesUpdated,missing:result.mappedTagsMissingFromDocx,unmapped:result.unmappedTagsFoundInDocx,warnings:result.warnings},null,2));
