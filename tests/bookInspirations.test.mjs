import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../utils/bookInspirations.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {getInspirationCategory,sampleBookInspirations}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const canonical=JSON.parse(fs.readFileSync(new URL('../docs/inspirations-review/ilhamlar.tr.json',import.meta.url),'utf8')).entries;
const expected=canonical.map(({id,category,label,brief})=>({id,category,label,brief}));
const languages=['ar','da','de','el','en','es','fi','fr','hi','id','it','ja','ko','nl','no','pl','pt-BR','sv','th','tr'];
test('the four home actions use their own inspiration catalog',()=>{
 assert.equal(getInspirationCategory('fairy_tale',false),'masal');
 assert.equal(getInspirationCategory('novel',false),'hikaye');
 assert.equal(getInspirationCategory('story',false),'calisma-kitabi');
 assert.equal(getInspirationCategory('novel',true),'yabanci-dil-hikaye');
});
test('every opening shows three unique suggestions from its category, excluding the previous opening',()=>{
 let seed=17;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(const category of ['masal','hikaye','calisma-kitabi','yabanci-dil-hikaye']){
  let previous=[];const seen=new Set();
  for(let opening=0;opening<500;opening++){
   const ids=sampleBookInspirations(expected,category,previous,random);
   assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
   assert.ok(ids.every(id=>expected.find(e=>e.id===id)?.category===category&&!previous.includes(id)));
   ids.forEach(id=>seen.add(id));previous=ids;
  }
  assert.equal(seen.size,50);
 }
 assert.deepEqual(expected,canonical.map(({id,category,label,brief})=>({id,category,label,brief})));
});
test('approved Turkish content is preserved exactly; all 20 languages have complete id-aligned catalogs',()=>{
 const tr=JSON.parse(fs.readFileSync(new URL('../data/bookInspirations/tr.json',import.meta.url),'utf8'));
 assert.deepEqual(tr.entries,expected);
 for(const language of languages){
  const catalog=JSON.parse(fs.readFileSync(new URL(`../data/bookInspirations/${language}.json`,import.meta.url),'utf8'));
  assert.equal(catalog.entries.length,200,language);
  assert.deepEqual(catalog.entries.map(e=>[e.id,e.category]),expected.map(e=>[e.id,e.category]),language);
  for(const key of ['all','title','loading','retry','unavailable'])assert.ok(catalog.ui[key]?.trim(),`${language}:${key}`);
  for(const entry of catalog.entries){
   assert.ok(entry.label.trim()&&entry.brief.trim(),`${language}:${entry.id}`);
   if(language!=='tr')assert.notEqual(entry.label,tr.entries.find(e=>e.id===entry.id).label,`${language}:${entry.id}`);
  }
 }
});
