import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {parseContractStandDetails}=await import('./contractStandDetails.ts');
const {createEmptyStandMaterialsFormState}=await import('./standMaterialsFormState.ts');
const {googleStandMaterialReplacements}=await import('../google/googleStandMaterialReplacements.ts');

test('generation snapshot is detached from later autosave state and retains unselected quantities',()=>{
 const source={standMaterials:createEmptyStandMaterialsFormState(),extraInformation:['tv']};
 source.standMaterials.Spotlight={selected:true,quantity:3};
 source.standMaterials.Chair.quantity=2;
 const parsed=parseContractStandDetails(JSON.parse(JSON.stringify(source)));
 assert.deepEqual(parsed,source);
 source.standMaterials.Spotlight.quantity=9;source.extraInformation[0]='changed';
 assert.equal(parsed.standMaterials.Spotlight.quantity,3);assert.deepEqual(parsed.extraInformation,['tv']);
 assert.equal(parsed.standMaterials.Chair.selected,false);
});
test('request boundary rejects wrong JSON types, unknown fields and invalid quantities',()=>{
 const valid=()=>({standMaterials:createEmptyStandMaterialsFormState(),extraInformation:['tv']});
 for(const invalid of [null,[],{...valid(),extraInformation:{fixture:'old'}},{...valid(),bank:{}},{...valid(),extraInformation:[42]}])assert.throws(()=>parseContractStandDetails(invalid));
 for(const quantity of [-1,0,1.2,'3',Infinity]){
  const input=valid();input.standMaterials.Spotlight.quantity=quantity;assert.throws(()=>parseContractStandDetails(input));
 }
});
test('selected missing material fields fail instead of silently losing selections',()=>{
 assert.throws(()=>googleStandMaterialReplacements('unrelated text',{'StandMaterials.Spotlight.Selected':'☑'}),/GOOGLE_MATERIAL_FIELD_MISSING/);
 assert.deepEqual(googleStandMaterialReplacements('unrelated text',{'StandMaterials.Spotlight.Selected':'☐'}),[]);
});
