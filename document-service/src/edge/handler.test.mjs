import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
registerHooks({resolve(s,c,next){try{return next(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {createContractEdgeHandler}=await import('./handler.ts');
const {readBoundedBytes,boundedFetch}=await import('./runtime.ts');
const id=n=>`${n}1111111-1111-4111-8111-111111111111`;
const companyId=id(1), opportunityId=id(2), userId=id(3), contractId=id(4), rowId=id(5), fairId=id(6);
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',CONTRACT_ALLOWED_ORIGINS:'https://staging.invalid',GOOGLE_WORKSPACE_CLIENT_ID:'client',GOOGLE_WORKSPACE_CLIENT_SECRET:'secret',GOOGLE_WORKSPACE_REFRESH_TOKEN:'refresh',VIAWA_MASTER_CONTRACT_TEMPLATE_ID:'master',VIAWA_GENERATED_DOCUMENTS_FOLDER_ID:'folder'};
const pdf=new Uint8Array([...new TextEncoder().encode('%PDF-1.7 ÇĞİÖŞÜ'),0,128,255]);
function setup({active=true,owner=userId,role='representative',collision=false,unresolved=false,slow=false,oversize=false}={}){
 const stages=[],calls=[];let stored,replacements;
 const mock=async (input,init={})=>{
  const u=new URL(input instanceof Request?input.url:String(input)),p=u.pathname;calls.push(p);
  if(u.hostname==='test.supabase.co')assert.equal(new Headers(init.headers).get('authorization'),'Bearer caller');
  if(p==='/auth/v1/user')return Response.json({id:userId,email:'owner@example.invalid'});
  if(p.endsWith('/application_users'))return Response.json([{id:userId,is_active:active,role}]);
  if(p.endsWith('/companies'))return Response.json([{id:companyId,company_name:'VIAWA TEST ÇĞİÖŞÜ çğıöşü'}]);
  if(p.endsWith('/opportunities'))return Response.json([{id:opportunityId,company_id:companyId,exhibition_id:fairId,owner,payment_plan:[{amount:120}]}]);
  if(p.endsWith('/exhibitions'))return Response.json([{id:fairId,name:'TEST FAIR',start_date:'2027-05-24',end_date:'2027-05-27'}]);
  if(p.endsWith('/contacts'))return Response.json([{first_name:'Test',last_name:'Signatory',title:'Yetkili',is_primary:true,is_signatory:true}]);
  if(p.endsWith('/approved_price_snapshots'))return Response.json([{opportunity_id:opportunityId,exhibition_id:fairId,price_input:{standAreaSqm:12,standType:'custom-stand'},price_result:{grandTotal:120,currency:'USD',sqmAmount:120},exhibitions:{name:'TEST FAIR'}}]);
  if(p.endsWith('/document_settings'))return Response.json([{issuer:{},bank:{}}]);
  if(p.endsWith('/rpc/get_or_create_contract_number'))return Response.json('EXP-2027-000001');
  if(p.endsWith('/contract_numbers'))return Response.json([{id:contractId,contract_number:'EXP-2027-000001'}]);
  if(p.endsWith('/generated_documents')){
   if(init.method==='POST'){stages.push('PENDING');return Response.json({id:rowId,contract_id:contractId,version:5});}
   if(init.method==='PATCH'){const b=JSON.parse(init.body);stages.push(b.generation_status);if(b.generation_status==='COMPLETED'){assert.equal(b.pdf_sha256,createHash('sha256').update(pdf).digest('hex'));assert.equal(b.pdf_size_bytes,pdf.length);}return Response.json({id:rowId});}
   return Response.json([]);
  }
  if(p.includes('/storage/v1/object/')){stored=init.body;assert.ok(p.endsWith(`${userId}/${companyId}/${rowId}/contract.pdf`));return Response.json(collision?{message:'collision'}:{Key:'contract.pdf'},{status:collision?409:200});}
  if(p==='/token')return Response.json({access_token:'google-token'});
  if(p==='/drive/v3/files/master')return Response.json({id:'master',mimeType:'application/vnd.google-apps.document',parents:['templates'],capabilities:{canCopy:true,canDownload:true}});
  if(p==='/drive/v3/files/folder')return Response.json({id:'folder',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  if(p==='/v1/documents/master')return Response.json({documentId:'master'});
  if(p==='/drive/v3/files/master/copy'){assert.deepEqual(JSON.parse(init.body).parents,['folder']);return Response.json({id:'copy',webViewLink:'https://docs.google.com/document/d/copy/edit?usp=drivesdk'});}
  if(p.endsWith(':batchUpdate')){replacements=JSON.parse(init.body);return Response.json({});}
  if(p==='/v1/documents/copy')return Response.json({body:{content:[{textRun:{content:unresolved?'{{MISSING}}':'Resolved'}}]}});
  if(p.endsWith('/export')){if(slow)return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));return new Response(pdf,oversize?{headers:{'content-length':String(11*1024*1024)}}:undefined);}
  if(p==='/upload/drive/v3/files'){const b=new Uint8Array(await init.body.arrayBuffer());assert.ok(Buffer.from(b).includes(Buffer.from(pdf)));assert.match(new TextDecoder().decode(b),/"parents":\["folder"\]/);return Response.json({id:'pdf',webViewLink:'https://drive.google.com/file/d/pdf/view'});}
  throw Error('Unexpected '+p);
 };
 return {mock,stages,calls,get replacements(){return replacements},get stored(){return stored}};
}
const request=()=>new Request('https://test.supabase.co/functions/v1/contract-generate',{method:'POST',headers:{Authorization:'Bearer caller',Origin:'https://staging.invalid'},body:JSON.stringify({companyId,opportunityId})});
test('Edge unauthenticated request makes no external calls',async()=>{const h=createContractEdgeHandler(env,()=>{throw Error('must not call')});assert.equal((await h(new Request('https://edge.invalid',{method:'POST'}))).status,401);});
for(const [name,options,status]of [['inactive',{active:false},403],['nonowner',{owner:'other'},403],['admin nonowner preserves current denial',{owner:'other',role:'admin'},403]])test(name,async()=>{const s=setup(options);const r=await createContractEdgeHandler(env,s.mock)(request());assert.equal(r.status,status);assert.ok(!s.calls.includes('/token'));assert.deepEqual(s.stages,[]);});
for(const role of ['representative','admin'])test(`Edge ${role} owner completes exact current version`,async()=>{
 const s=setup({role});const r=await createContractEdgeHandler(env,s.mock)(request());assert.equal(r.status,200,await r.clone().text());
 assert.deepEqual(new Uint8Array(await r.arrayBuffer()),pdf);assert.deepEqual(new Uint8Array(s.stored),pdf);
 assert.deepEqual(s.stages,['PENDING','DOC_CREATED','PDF_CREATED','COMPLETED']);assert.equal(r.headers.get('x-viawa-generated-document-id'),rowId);
 assert.equal(r.headers.get('x-viawa-google-doc-url'),'https://docs.google.com/document/d/copy/edit?usp=drivesdk');assert.match(r.headers.get('access-control-expose-headers'),/X-VIAWA-Generated-Document-Id/);
 const values=s.replacements.requests.map(x=>x.replaceAllText.replaceText);for(const value of ['12 m²','VIAWA TEST ÇĞİÖŞÜ çğıöşü','EXP-2027-000001'])assert.ok(values.includes(value));
});
for(const [name,options]of [['archive collision',{collision:true}],['unresolved placeholders',{unresolved:true}],['oversized PDF',{oversize:true}]])test(`Edge ${name} persists FAILED`,async()=>{const s=setup(options);assert.equal((await createContractEdgeHandler(env,s.mock)(request())).status,500);assert.equal(s.stages.at(-1),'FAILED');assert.ok(!s.stages.includes('COMPLETED'));});

test('Edge deployment preserves Istanbul contract date across UTC midnight boundary',async()=>{
 const {formatContractDate}=await import('../../../src/modules/document-engine/engine/formatContractDate.ts');
 assert.equal(formatContractDate('2026-09-06T21:30:00Z'),'07.09.2026');
});
test('Edge deadline persists FAILED using independent cleanup window',async()=>{const s=setup({slow:true});const keepAlive=setTimeout(()=>{},1000);try{assert.equal((await createContractEdgeHandler(env,s.mock,100)(request())).status,504);assert.equal(s.stages.at(-1),'FAILED');}finally{clearTimeout(keepAlive)}});
test('same master and output fail without Google artifacts',async()=>{const s=setup();assert.equal((await createContractEdgeHandler({...env,VIAWA_GENERATED_DOCUMENTS_FOLDER_ID:'master'},s.mock)(request())).status,503);assert.ok(!s.calls.includes('/token'));});
test('declared and streamed size limits reject and cancel',async()=>{
 await assert.rejects(()=>readBoundedBytes(new Response('small',{headers:{'content-length':'99'}}),5),/SIZE_LIMIT/);
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(6));},cancel(){cancelled=true;}});await assert.rejects(()=>readBoundedBytes(new Response(body),5),/SIZE_LIMIT/);assert.equal(cancelled,true);
});
test('provider timeout is bounded independently of overall deadline',async()=>{const keepAlive=setTimeout(()=>{},1000);try{const f=boundedFetch(AbortSignal.timeout(1000),10,(_u,i)=>new Promise((_,reject)=>i.signal.addEventListener('abort',()=>reject(i.signal.reason),{once:true})));await assert.rejects(()=>f('https://google.invalid'),{name:'TimeoutError'});}finally{clearTimeout(keepAlive)}});
