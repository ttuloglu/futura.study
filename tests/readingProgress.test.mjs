import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../utils/readingProgressModel.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {mergeCoverage,mergeReadingRecords,readingStats,libraryReadingState,sortLibraryByReading}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const base=(extra={})=>({bookId:'test',title:'Kitap',bookType:'fairy_tale',genre:'Masal',subGenre:'Dostluk',bookmarks:{},coverage:[],reachedEnd:false,updatedAt:100,...extra});
test('jumping directly to the last page cannot count as a finished book',()=>{
 const record=mergeReadingRecords(undefined,base({coverage:[[.95,1]],reachedEnd:true}));
 assert.equal(record.completedAt,undefined);assert.equal(readingStats([record]).total,0);
});
test('repeated visits and overlapping ranges do not inflate coverage',()=>{
 assert.deepEqual(mergeCoverage([[0,.3],[.2,.4],[0,.3],[.6,.7]]),[[0,.4],[.6,.7]]);
});
test('completion needs both sufficient coverage and the end; completes only once',()=>{
 let record=mergeReadingRecords(undefined,base({coverage:[[0,.9]],updatedAt:200}));
 assert.equal(record.completedAt,undefined);
 record=mergeReadingRecords(record,base({coverage:[[.9,1]],reachedEnd:true,updatedAt:300}));
 assert.equal(record.completedAt,300);
 record=mergeReadingRecords(record,base({coverage:[[0,1]],reachedEnd:true,updatedAt:400}));
 assert.equal(record.completedAt,300);assert.equal(readingStats([record]).total,1);
});
test('offline and concurrent devices merge coverage while preserving newest bookmarks',()=>{
 const native={sourceIndex:3,contentStartOffset:840,pageIndex:12,pageCount:32,rangeStart:.4,rangeEnd:.45,isLast:false,updatedAt:500,platform:'native'};
 const web={...native,sourceIndex:2,contentStartOffset:220,updatedAt:600,platform:'web'};
 const before=base({bookmarks:{native},coverage:[[0,.4]],updatedAt:500});
 const merged=mergeReadingRecords(before,base({bookmarks:{native:{...native,contentStartOffset:0,updatedAt:100},web},coverage:[[.3,.6]],updatedAt:600}));
 assert.equal(merged.bookmarks.native.contentStartOffset,840);assert.equal(merged.bookmarks.web.contentStartOffset,220);
 assert.deepEqual(merged.coverage,[[0,.6]]);
});
test('invalid or out-of-range coverage cannot artificially complete a book',()=>{
 assert.deepEqual(mergeCoverage([[-1,.2],[.8,2],[NaN,1],[.5,.1],[2,3]]),[[0,.2],[.8,1]]);
});
test('statistics include completed types, genres and local calendar month only',()=>{
 const now=new Date(2026,9,4);
 const records=[base({completedAt:new Date(2026,9,1).getTime()}),base({bookId:'second',bookType:'novel',genre:'Hikaye',subGenre:'Bilimkurgu',completedAt:new Date(2026,8,1).getTime()}),base({bookId:'third',coverage:[[0,.4]]})];
 const stats=readingStats(records,now);
 assert.equal(stats.total,2);assert.equal(stats.month,1);assert.equal(stats.inProgress,1);
 assert.deepEqual(stats.types,{fairy_tale:1,novel:1});assert.equal(stats.subGenres.Bilimkurgu,1);
});
test('library uses the newest bookmark across devices, including first-page resumes',()=>{
 const bookmark={sourceIndex:0,contentStartOffset:0,pageIndex:0,pageCount:20,rangeStart:0,rangeEnd:.05,isLast:false,platform:'native',updatedAt:100};
 assert.deepEqual(libraryReadingState(base()),{started:false,lastOpenedAt:0,progress:0});
 assert.deepEqual(libraryReadingState(base({bookmarks:{native:bookmark}})),{started:true,lastOpenedAt:100,progress:0});
 assert.equal(libraryReadingState(base({bookmarks:{native:bookmark,web:{...bookmark,platform:'web',rangeStart:.46,updatedAt:200}}})).progress,46);
 assert.equal(libraryReadingState(base({bookmarks:{native:bookmark},completedAt:300})).progress,100);
});
test('last-opened books precede unread books and opening the same page moves a book to the top',()=>{
 const bookmark={sourceIndex:1,contentStartOffset:400,pageIndex:5,pageCount:20,rangeStart:.25,rangeEnd:.3,isLast:false,platform:'native',updatedAt:100};
 const books=[{id:'new',lastActivity:new Date(9000)},{id:'first',lastActivity:new Date(200)},{id:'second',lastActivity:new Date(100)}];
 const records={first:base({bookId:'first',bookmarks:{native:bookmark},lastOpenedAt:300}),second:base({bookId:'second',bookmarks:{native:bookmark},lastOpenedAt:400})};
 assert.deepEqual(sortLibraryByReading(books,records).map(book=>book.id),['second','first','new']);
 records.first=mergeReadingRecords(records.first,base({...records.first,lastOpenedAt:500,updatedAt:600}));
 assert.deepEqual(sortLibraryByReading(books,records).map(book=>book.id),['first','second','new']);
 assert.equal(mergeReadingRecords(records.first,base({...records.first,lastOpenedAt:100,updatedAt:700})).lastOpenedAt,500);
 assert.deepEqual(books.map(book=>book.id),['new','first','second']);
});
