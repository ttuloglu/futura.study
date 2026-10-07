import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const original=fs.readFileSync(new URL('../utils/sheetBackground.ts',import.meta.url),'utf8');
test('nested sheets keep the app frozen until the last sheet closes and restore the previous state',async()=>{
 const originalDocument=globalThis.document;
 const calls=[],classes=new Set(),root={inert:false};
 globalThis.__sheetCalls=calls;
 globalThis.document={body:{style:{overflow:'scroll'}},getElementById:()=>root,documentElement:{classList:{contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key)}}};
 const stub='const supportsNativeFloatIsland=()=>true; const NativeFloatIsland={setPageScrollLocked:async state=>{globalThis.__sheetCalls.push(state.locked);}};';
 const source=original.replace(/import .* from '\.\/nativeFloatIsland';/,stub);
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 try{
  const {lockSheetBackground}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const closeFirst=lockSheetBackground(),closeSecond=lockSheetBackground();
  assert.equal(root.inert,true);assert.equal(document.body.style.overflow,'hidden');assert.equal(classes.has('fortale-sheet-open'),true);
  assert.deepEqual(calls,[true]);
  closeFirst();closeFirst();assert.equal(root.inert,true);assert.deepEqual(calls,[true]);
  closeSecond();assert.equal(root.inert,false);assert.equal(document.body.style.overflow,'scroll');assert.equal(classes.has('fortale-sheet-open'),false);assert.deepEqual(calls,[true,false]);
  root.inert=true;classes.add('fortale-sheet-open');
  const closeExisting=lockSheetBackground();closeExisting();
  assert.equal(root.inert,true);assert.equal(classes.has('fortale-sheet-open'),true);
 }finally{
  delete globalThis.__sheetCalls;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
 }
});
