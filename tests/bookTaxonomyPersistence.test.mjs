// This integration check requires the local emulator and cannot write to production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('A local Firestore emulator is required');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { loadBookTaxonomy, rememberBookClassification } = require('./lib/bookTaxonomyStore');
const { canonicalBookClassification } = require('./lib/bookTaxonomy');
const app = initializeApp({ projectId: 'demo-fortale-reading' }, 'taxonomy-test');
const db = getFirestore(app);
try {
  const initial = await loadBookTaxonomy(db);
  assert.ok(initial.some(entry => entry.bookType === 'fairy_tale' && entry.subGenre === 'Eğitici'));
  const workbook = { bookType: 'story', genre: 'Biyoloji', subGenre: 'Hücre bölünmesi' };
  await rememberBookClassification(workbook, db);
  await Promise.all([
    rememberBookClassification({ ...workbook, genre: ' biyoloji ', subGenre: 'HÜCRE BÖLÜNMESİ' }, db),
    rememberBookClassification({ ...workbook, subGenre: 'hücre  bölünmesi' }, db),
    rememberBookClassification({ bookType: 'novel', genre: 'Hikaye', subGenre: 'Distopik' }, db),
    rememberBookClassification({ bookType: 'fairy_tale', genre: 'Masal', subGenre: 'Uyku masalı' }, db),
  ]);
  assert.equal((await db.collection('bookTaxonomy').get()).size, 3);
  const nextPlanCatalog = await loadBookTaxonomy(db);
  assert.deepEqual(canonicalBookClassification('story', 'biyoloji', 'hücre bölünmesi', nextPlanCatalog), workbook);
  assert.ok(nextPlanCatalog.some(entry => entry.subGenre === 'Distopik'));
  assert.ok(nextPlanCatalog.some(entry => entry.subGenre === 'Uyku masalı'));
  console.log('Catalog persists across planning calls, retains all three formats and deduplicates concurrent additions.');
} finally {
  await db.terminate();
  await deleteApp(app);
}
