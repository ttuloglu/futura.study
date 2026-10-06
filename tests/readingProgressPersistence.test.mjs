// Run with a local Firestore emulator; never touches the production project.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,terminate} from 'firebase/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('A local Firestore emulator is required');
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
const app=initializeApp({projectId:'demo-fortale-reading'},'reading-test');
const db=getFirestore(app);connectFirestoreEmulator(db,host,Number(port),{mockUserToken:{sub:'reader-one',user_id:'reader-one'}});
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.window=new EventTarget();
globalThis.readingTestAuth={currentUser:{uid:'reader-one'}};globalThis.readingTestDB=db;
globalThis.readingTestOnAuth=(_,callback)=>{globalThis.readingTestAuthCallback=callback;callback(globalThis.readingTestAuth.currentUser);return()=>{};};
const moduleUrl=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`;
const modelUrl=moduleUrl(fs.readFileSync(new URL('../utils/readingProgressModel.ts',import.meta.url),'utf8'));
const serviceSource=fs.readFileSync(new URL('../utils/readingProgress.ts',import.meta.url),'utf8')
 .replace(/import \{ onAuthStateChanged \} from 'firebase\/auth';/, 'const onAuthStateChanged=globalThis.readingTestOnAuth;')
 .replace(/import \{ auth, db \} from '..\/firebaseConfig';/, 'const auth=globalThis.readingTestAuth,db=globalThis.readingTestDB;')
 .replace("from 'firebase/firestore'",`from '${import.meta.resolve('firebase/firestore')}'`)
 .replace("from './readingProgressModel'",`from '${modelUrl}'`);
const service=await import(moduleUrl(serviceSource));
const ref=doc(db,'users','reader-one','readingProgress','sample');
const record={bookId:'sample',title:'Test',bookType:'novel',genre:'Hikaye',subGenre:'Bilimkurgu',bookmarks:{native:{sourceIndex:2,contentStartOffset:450,pageIndex:8,pageCount:20,rangeStart:.4,rangeEnd:.45,isLast:false,platform:'native',updatedAt:100}},coverage:[[0,.4]],reachedEnd:false,lastOpenedAt:90,updatedAt:100};
const until=async predicate=>{for(let i=0;i<100;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Persistence timed out');};
try {
 service.saveReadingRecord(record);
 await until(async()=> (await getDoc(ref)).exists());
 assert.equal((await service.loadReadingRecord('sample')).bookmarks.native.contentStartOffset,450);
 assert.equal((await getDoc(ref)).data().lastOpenedAt,90);
 await assert.rejects(()=>getDoc(doc(db,'users','reader-two','readingProgress','sample')),error=>error.code==='permission-denied');
 await assert.rejects(()=>setDoc(doc(db,'users','reader-two','readingProgress','sample'),{...record,coverage:[]}),error=>error.code==='permission-denied');
 navigator.onLine=false;
 service.saveReadingRecord({...record,coverage:[[.4,.9]],lastOpenedAt:190,updatedAt:200});
 assert.deepEqual((await getDoc(ref)).data().coverage,[{start:0,end:.4}]);
 navigator.onLine=true;window.dispatchEvent(new Event('online'));
 await until(async()=> (await getDoc(ref)).data().coverage[0].end===.9);
 assert.equal((await getDoc(ref)).data().lastOpenedAt,190);
 service.saveReadingRecord({...record,coverage:[[.9,1]],reachedEnd:true,updatedAt:300});
 await until(async()=> Boolean((await getDoc(ref)).data().completedAt));
 assert.equal((await getDoc(ref)).data().completedAt,300);
 assert.equal((await getDoc(ref)).data().lastOpenedAt,190);
 service.saveReadingRecord({...record,coverage:[[0,1]],reachedEnd:true,updatedAt:400});
 await until(async()=> (await getDoc(ref)).data().updatedAt===400);
 assert.equal((await getDoc(ref)).data().completedAt,300);
 const resume=await service.pauseReadingWritesForDeletion('reader-one');
 service.saveReadingRecord({...record,updatedAt:500});
 assert.equal((await getDoc(ref)).data().updatedAt,400);
 service.clearReadingCache('reader-one');resume();
 assert.equal(service.getReadingRecords().sample,undefined);
 readingTestAuthCallback(null);
 assert.equal(service.getReadingRecords().sample,undefined);
 assert.equal(service.getReadingOwner(),'guest');
 console.log('PASS: Firebase bookmark restore, owner-only rules, offline synchronization, merged coverage, unique completion, account isolation.');
} finally {await terminate(db);await deleteApp(app);}
