import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(fs.readFileSync(new URL('../functions/src/bookTaxonomy.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { defaultBookTaxonomy, mergeBookTaxonomy, canonicalBookClassification } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('all existing formats supply their seed categories to planning', () => {
  const catalog = defaultBookTaxonomy();
  assert.ok(catalog.some(c => c.bookType === 'fairy_tale' && c.subGenre === 'Eğitici Masal'));
  assert.ok(catalog.some(c => c.bookType === 'novel' && c.subGenre === 'Bilimkurgu'));
  assert.ok(catalog.some(c => c.bookType === 'story' && c.genre === 'Araştırma'));
});
test('the planner can extend the catalog without changing the selected format', () => {
  const narrative = canonicalBookClassification('novel', 'Çalışma Kitabı', 'Distopik');
  assert.deepEqual(narrative, { bookType: 'novel', genre: 'Hikaye', subGenre: 'Distopik' });
  const workbook = canonicalBookClassification('story', 'Biyoloji', 'Hücre bölünmesi');
  const catalog = mergeBookTaxonomy([narrative, workbook]);
  assert.ok(catalog.some(c => c.genre === 'Biyoloji' && c.subGenre === 'Hücre bölünmesi'));
  assert.deepEqual(canonicalBookClassification('story', ' biyoloji ', ' hücre  bölünmesi ', catalog), workbook);
});
test('category names retain canonical spelling and ignore whitespace/case duplicates', () => {
  const first = { bookType: 'novel', genre: 'Hikaye', subGenre: 'Distopik' };
  const catalog = mergeBookTaxonomy([first, { ...first, genre: ' hikaye ', subGenre: ' distopik ' }]);
  assert.equal(catalog.filter(c => c.subGenre === 'Distopik').length, 1);
  assert.equal(canonicalBookClassification('fairy_tale', '', ' eğitici  masal ').subGenre, 'Eğitici Masal');
});
test('missing classification cannot become a generation-ready plan', () => {
  for (const type of ['fairy_tale', 'novel', 'story']) assert.throws(() => canonicalBookClassification(type, 'Biyoloji', ''));
  assert.throws(() => canonicalBookClassification('story', '', 'Hücre bölünmesi'));
  assert.throws(() => canonicalBookClassification('novel', '', 'x'.repeat(81)));
});
