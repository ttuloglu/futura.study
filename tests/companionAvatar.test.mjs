import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`;
const read = path => fs.readFileSync(new URL(path,import.meta.url),'utf8');
const catalogUrl=moduleUrl(read('../data/companionAvatars.ts'));
const catalog=await import(catalogUrl);
test('all seven rewards unlock at their exact completed-book threshold',()=>{
 assert.equal(catalog.COMPANION_AVATARS.length,8);
 assert.deepEqual(catalog.COMPANION_AVATARS.map(a=>a.books),[0,5,20,50,100,200,300,500]);
 for(const avatar of catalog.COMPANION_AVATARS.slice(1)){
  assert.equal(catalog.unlockedCompanionAvatar(avatar.id,avatar.books-1),'dost');
  assert.equal(catalog.unlockedCompanionAvatar(avatar.id,avatar.books),avatar.id);
 }
 assert.equal(catalog.unlockedCompanionAvatar('unknown',1000),'dost');
 assert.equal(catalog.nextCompanionAvatar(20).id,'pus');
 assert.equal(catalog.nextCompanionAvatar(500),undefined);
 assert.equal(catalog.NOVA_STAR_BOOKS,1000);
});
test('selection rejects locked avatars, survives reloads, and stays private to each account',async()=>{
 const originals={window:globalThis.window,localStorage:globalThis.localStorage};
 const storage=new Map(),events=new Map();
 const fixture=globalThis.__companionFixture={owner:'alice',records:{},changed:undefined};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.window={addEventListener:(name,listener)=>events.set(name,listener)};
 const progressUrl=moduleUrl('export const getReadingOwner=()=>globalThis.__companionFixture.owner; export const getReadingRecords=()=>globalThis.__companionFixture.records; export const subscribeReading=fn=>{globalThis.__companionFixture.changed=fn;return()=>{};}');
 const modelUrl=moduleUrl(read('../utils/readingProgressModel.ts'));
 const source=read('../utils/companionAvatar.ts').replace("'./readingProgress'",JSON.stringify(progressUrl)).replace("'./readingProgressModel'",JSON.stringify(modelUrl)).replace("'../data/companionAvatars'",JSON.stringify(catalogUrl));
 const complete=n=>{fixture.records=Object.fromEntries(Array.from({length:n},(_,i)=>[String(i),{bookId:String(i),completedAt:100,title:'Book',bookType:'story',coverage:[[0,1]],bookmarks:{},updatedAt:100,reachedEnd:true}]));fixture.changed();};
 try{
  const store=await import(moduleUrl(source));
  assert.equal(store.selectCompanionAvatar('koz'),false);
  assert.equal(store.getCompanionAvatar().selected,'dost');
  complete(20);
  assert.equal(store.selectCompanionAvatar('misket'),true);
  assert.equal(storage.get('fortale-companion-avatar-v1:alice'),'misket');
  const reloaded=await import(moduleUrl(source+'\n// fresh instance'));
  assert.equal(reloaded.getCompanionAvatar().selected,'misket');
  fixture.owner='bob';fixture.records={};fixture.changed();
  assert.equal(reloaded.getCompanionAvatar().selected,'dost');
  assert.equal(reloaded.selectCompanionAvatar('misket'),false);
  fixture.owner='alice';complete(20);
  assert.equal(reloaded.getCompanionAvatar().selected,'misket');
  storage.set('fortale-companion-avatar-v1:alice','koz');events.get('storage')({key:'fortale-companion-avatar-v1:alice'});
  assert.equal(reloaded.getCompanionAvatar().selected,'koz');
  complete(0);assert.equal(reloaded.getCompanionAvatar().selected,'dost');
 }finally{delete globalThis.__companionFixture;for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
