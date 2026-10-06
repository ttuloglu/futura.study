import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../utils/composerViewport.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {composerViewport}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('web keyboards dock to the visible viewport',()=>{
 assert.deepEqual(composerViewport(844,500,0),{top:0,height:500,keyboard:true});
});
test('native keyboard bounds dock the modal even before VisualViewport updates',()=>{
 assert.deepEqual(composerViewport(896,896,0,{visible:true,top:492}),{top:0,height:492,keyboard:true});
});
test('a panned viewport keeps modal docked at top with full height to native keyboard',()=>{
 const position=composerViewport(896,492,40,{visible:true,top:492});
 assert.equal(position.top+position.height,492);
 assert.equal(position.top,0);
});
test('closing the keyboard restores the full viewport and never collapses to 0 on scroll',()=>{
 assert.deepEqual(composerViewport(896,896,0,{visible:false,top:896}),{top:0,height:896,keyboard:false});
 assert.equal(composerViewport(390,180,200,{visible:true,top:160}).height >= 160, true);
});
