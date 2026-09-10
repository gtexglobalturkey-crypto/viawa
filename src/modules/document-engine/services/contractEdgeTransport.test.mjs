import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import test from 'node:test';
import {transformWithOxc} from 'vite';
const url=new URL('./contractPdfService.ts',import.meta.url);
const source=readFileSync(url,'utf8').replaceAll('import.meta.env',JSON.stringify({VITE_SUPABASE_URL:'https://staging.supabase.co',VITE_SUPABASE_ANON_KEY:'public-key'}));
const compiled=await transformWithOxc(source,url.pathname);
registerHooks({load(u,c,next){return u===url.href?{format:'module',shortCircuit:true,source:compiled.code}:next(u,c)}});
const {requestContractPdf}=await import(url.href);

test('transport serializes current stand selections and extra text, not IDs alone',async t=>{
 const standDetails={standMaterials:{HeaderText:{selected:true,quantity:null},DigitalPrints:{selected:true,quantity:null},Spotlight:{selected:true,quantity:3},InfoDesk:{selected:true,quantity:1}},extraInformation:['tv']};
 t.mock.method(globalThis,'fetch',async(_u,i)=>{
  assert.deepEqual(JSON.parse(i.body),{companyId:'company',opportunityId:'opportunity',standDetails});
  return new Response('%PDF-current',{headers:{'Content-Type':'application/pdf'}});
 });
 await requestContractPdf({accessToken:'caller',companyId:'company',opportunityId:'opportunity',standDetails});
});
test('React transport calls Supabase Edge with caller JWT and preserves PDF/artifact response',async t=>{
 t.mock.method(globalThis,'fetch',async(u,i)=>{
  assert.equal(u,'https://staging.supabase.co/functions/v1/contract-generate');assert.equal(i.headers.Authorization,'Bearer caller');assert.equal(i.headers.apikey,'public-key');
  assert.deepEqual(JSON.parse(i.body),{companyId:'company',opportunityId:'opportunity'});
  return new Response('%PDF-current',{headers:{'Content-Type':'application/pdf','X-VIAWA-Generated-Document-Id':'version-5','X-VIAWA-Google-Doc-Url':'https://docs.google.com/document/d/copy/edit','X-VIAWA-Generation-Status':'COMPLETED'}});
 });
 const r=await requestContractPdf({accessToken:'caller',companyId:'company',opportunityId:'opportunity'});
 assert.equal(r.ok,true);assert.equal(r.generatedDocumentId,'version-5');assert.equal(r.googleDocUrl,'https://docs.google.com/document/d/copy/edit');assert.equal(await r.pdfBlob.text(),'%PDF-current');
});
