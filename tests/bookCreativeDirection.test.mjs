import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(new URL('../functions/src/bookCreativeDirection.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createBookCreativeDirection: create, normalizeBookCreativeDirection: normalize, BOOK_ART_PROFILES: profiles,
  buildBookArtDirection: art, buildBookNarrativeDirection: narrative, parseBookEditorialReview: review } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('book directions span many media, palettes and compositions within one subgenre', () => {
  const directions = Array.from({ length: 1000 }, (_, i) => create(`test-${i}`, 'novel'));
  assert.equal(new Set(directions.map(item => item.artProfileId)).size, profiles.length - 1);
  assert.ok(new Set(directions.map(item => item.palette)).size >= 10);
  assert.ok(new Set(directions.map(item => item.lighting)).size >= 5);
  assert.ok(new Set(directions.map(item => item.narrativeApproach)).size >= 7);
  assert.ok(new Set(directions.map(item => item.dramaticEngine)).size >= 9);
  assert.equal(new Set(directions.map(item => item.worldLens)).size, 24);
});

test('one direction survives serialization, all image routes, and retries without reseeding', () => {
  const direction = create('the-same-book', 'novel', [], 'A nurse restores a garden.', 'Linocut with one red accent.');
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(direction))), direction);
  assert.deepEqual(create('the-same-book', 'novel', [], 'A nurse restores a garden.', 'Linocut with one red accent.'), direction);
  for (const cover of [true, false]) {
    const prompt = art(direction, 'novel', 'general', 'Romantik', cover);
    assert.match(prompt, new RegExp(direction.palette));
    assert.ok(prompt.includes(profiles.find(profile => profile.id === direction.artProfileId).medium));
    assert.match(prompt, /EXPLICIT USER ART PREFERENCE.*takes precedence/);
    assert.match(prompt, /Linocut with one red accent/);
  }
});

test('new books avoid recent media, the last visual family, palette and composition', () => {
  let history = [];
  for (let i = 0; i < 80; i += 1) {
    const next = create(`successive-book-${i}`, 'novel', history);
    assert.ok(!history.slice(0, 4).some(book => book.artProfileId === next.artProfileId));
    if (history.length) {
      assert.notEqual(next.palette, history[0].palette);
      assert.notEqual(next.composition, history[0].composition);
      assert.ok(!history.slice(0, 3).some(book => book.worldLens === next.worldLens));
      assert.notEqual(profiles.find(p => p.id === next.artProfileId).family, profiles.find(p => p.id === history[0].artProfileId).family);
    }
    history = [{ title: `Book ${i}`, description: '', subGenre: 'Romantik', ...next }, ...history].slice(0, 12);
  }
});

test('preschool art is varied, with no photographic faces or scientific-plate fallback', () => {
  const directions = Array.from({ length: 300 }, (_, i) => create(`child-${i}`, 'fairy_tale'));
  assert.equal(new Set(directions.map(item => item.artProfileId)).size, 18);
  assert.ok(directions.every(item => !['documentary-photo', 'botanical-plate'].includes(item.artProfileId)));
  assert.match(art(directions[0], 'fairy_tale', '1-6', 'Uyku Masalı'), /Quiet|Handcrafted/);
  assert.ok(Array.from({ length: 300 }, (_, i) => create(`teen-${i}`, 'novel', [], '', '', '12-18')).every(item => item.artProfileId !== 'documentary-photo'));
});

test('user requests override random possibilities; old books are negative references only', () => {
  const direction = create('input-test', 'novel', [{ title: 'Paslı Raylar', description: 'Bir istasyon ve saatin gizemi.', subGenre: 'Gizem' }],
    'A train station is explicitly requested. The hero is a retired nurse; no magic.');
  const prompt = narrative(direction);
  assert.match(prompt, /retired nurse; no magic/);
  assert.match(prompt, /never override the chosen subgenre/);
  assert.match(prompt, /Shared genre or a user-requested setting alone is NOT duplication/);
  assert.match(prompt, /ONLY to prevent copying/);
});

test('malformed and contradictory editorial responses cannot silently pass', () => {
  for (const raw of [null, {}, { accepted: 'true', issues: [] }, { accepted: false, issues: [] }]) {
    assert.throws(() => review(raw));
  }
  assert.equal(review({ accepted: true, issues: ['Recycled plot'], revision: '' }).accepted, false);
  assert.deepEqual(review({ accepted: true, issues: [], revision: '' }), { accepted: true, revision: '' });
  assert.match(review({ accepted: false, issues: ['The station + clock + lost memory reveal repeats.'], revision: 'Change the actual causal conflict.' }).revision, /station \+ clock/);
  assert.equal(normalize({ version: 1, seed: 'x', artProfileId: 'untrusted-profile' }), undefined);
});

// Exercise the actual server generators against a fake provider. Loading the
// compiled module registers functions but performs no network calls or writes.
const indexPath = fileURLToPath(new URL('../functions/lib/index.js', import.meta.url));
const server = new Module(indexPath);
server.filename = indexPath;
server.paths = Module._nodeModulePaths(path.dirname(indexPath));
server._compile(fs.readFileSync(indexPath, 'utf8') + `\nmodule.exports.__creativeTest = {
  generateCourseOutline, generateVisualFairyTalePlan, buildVisualStoryPageImagePrompt,
  normalizeSmartBookCreativeBrief, buildGeneratedBookCoursePayload, isNarrativeBookTitleTooGeneric, buildNarrativeCraftMandates, isGenericBookDescription, buildCreativeBriefInstruction, buildNarrativeSubGenreLiteraryDirective, buildNovelSubGenrePathDirective
};`, indexPath);
const internals = server.exports.__creativeTest;
const chapters = ['Kuru Toprak', 'İlk Tohum', 'Açık Kapı', 'Ortak Emek', 'Yağmur Sonrası', 'Yeni Mevsim'];
const metadata = {
  bookTitle: 'Ortak Bahçe',
  bookDescription: 'Emekli hemşire Deniz, komşularıyla boş bir arsayı bahçeye dönüştürürken yardım istemenin bedelini öğrenir. Bir su anlaşmazlığı, birlikte verdikleri sözleri ve birbirlerine duydukları güveni sınar.',
  bookCategory: 'Edebiyat', bookType: 'novel', subGenre: 'Dram', targetPageCount: 32, searchTags: ['bahçe', 'komşuluk'],
  outline: chapters.map((title, i) => ({ id: `chapter-${i}`, title, description: `Deniz bahçede komşusuyla su paylaşımına karar verir. Bu seçim ortak sorumluluğu ve ${i + 1}. olayın bedelini değiştirir. Sonraki karşılaşmayı kendi eylemi hazırlar.`, type: 'lecture', status: i ? 'locked' : 'current', duration: '10 dk' })),
};
function fakeProvider({ rejectAll = false, fairy = false } = {}) {
  const prompts = [];
  let reviews = 0, generations = 0;
  return { prompts, get reviews() { return reviews; }, get generations() { return generations; }, models: {
    generateContent: async ({ contents }) => {
      prompts.push(contents);
      if (contents.startsWith('You are an exacting literary editor')) {
        reviews += 1;
        return { text: JSON.stringify(reviews === 1 || rejectAll
          ? { accepted: false, issues: ['Replace the repeated central conflict.'], revision: 'Use a concrete disagreement about shared water, not a clock mystery.' }
          : { accepted: true, issues: [], revision: '' }), usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 } };
      }
      if (contents.includes('Mevcut bölüm bilgileri:')) return { text: JSON.stringify({ bookTitle: metadata.bookTitle, bookDescription: metadata.bookDescription, chapterTitles: chapters }) };
      generations += 1;
      return { text: JSON.stringify(fairy ? {
        ...metadata, bookTitle: 'Küçük Bahçe',
        storyText: Array.from({ length: 48 }, (_, i) => `Deniz bahçede komşusuyla birlikte ${i + 1} küçük çiçek için yumuşak toprağı özenle hazırladı.`).join(' '),
        coverText: 'Küçük Bahçe', characterBible: 'Deniz kısa saçlı, yeşil önlüklü bir çocuk.', styleAnchor: 'ignored model CGI style'
      } : metadata), usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 } };
    }
  } };
}
const brief = type => ({ bookType: type, subGenre: type === 'novel' ? 'Dram' : 'Modern Masal', languageText: 'Turkish',
  characters: 'Deniz', creativeDirection: create('job-stable-test', type, [{ title: 'Rayların Altında', description: 'Saatli istasyon ve kayıp hafıza.', subGenre: 'Gizem' }], 'Deniz komşularla birlikte bahçe kursun. Gizem ve büyü istemiyorum.') });

test('actual novel planner rewrites a rejected plan, keeps inputs/direction and counts every attempt', async () => {
  const provider = fakeProvider();
  const result = await internals.generateCourseOutline(provider, 'Komşular birlikte bir bahçe kursun.', 'Deniz emekli hemşire.', 'general', brief('novel'), true);
  assert.equal(provider.generations, 2);
  assert.equal(provider.reviews, 2);
  assert.equal(result.outline.length, 6);
  assert.ok(provider.prompts.some(prompt => prompt.includes('EDITORIAL REVISION REQUIRED:') && prompt.includes('not a clock mystery')));
  assert.ok(provider.prompts.filter(prompt => prompt.includes('Kitap brief:')).every(prompt => prompt.includes('Gizem ve büyü istemiyorum')));
  assert.ok(result.usageEntry.totalTokens >= 80);
});

test('actual planner fails closed after two revisions, before any images or book publication', async () => {
  const provider = fakeProvider({ rejectAll: true });
  await assert.rejects(() => internals.generateCourseOutline(provider, 'Komşular bahçe kursun.', undefined, 'general', brief('novel'), true), error => error.code === 'failed-precondition');
  assert.equal(provider.generations, 3);
  assert.equal(provider.reviews, 3);
});

test('actual visual fairy pipeline also reviews the whole tale and ignores model style drift', async () => {
  const provider = fakeProvider({ fairy: true });
  const request = brief('fairy_tale');
  const result = await internals.generateVisualFairyTalePlan(provider, 'Küçük Bahçe', 'Çiçekler birlikte büyüsün.', request, true, '1-6');
  assert.equal(provider.generations, 2);
  assert.equal(provider.reviews, 2);
  assert.equal(result.plan.pages.length, 8);
  assert.ok(!result.plan.styleAnchor.includes('ignored model CGI style'));
  assert.ok(result.plan.styleAnchor.includes(request.creativeDirection.palette));
  const prompt = internals.buildVisualStoryPageImagePrompt({ bookTitle: result.plan.bookTitle, pageTitle: 'İlk çiçek',
    pageText: result.plan.pages[0].pageText, scenePrompt: result.plan.pages[0].scenePrompt,
    characterBible: result.plan.characterBible, styleAnchor: result.plan.styleAnchor, creativeBrief: request,
    pageNumber: 1, totalPages: 8, audienceLevel: '1-6', isCover: true });
  assert.match(prompt, /only permitted text/);
  assert.doesNotMatch(prompt, /premium 3D cartoon|warm lantern light, sparkling/);
});

test('published books keep their own style fingerprint but never export personal history/source conversation', () => {
  const request = brief('novel');
  const payload = internals.buildGeneratedBookCoursePayload({ uid: 'test-user', courseId: 'book-id', ageGroup: 'general',
    bookType: 'novel', creativeBrief: request, courseMeta: metadata, coverImageUrl: 'https://example.test/cover.png',
    nodes: metadata.outline, contentPackagePath: 'test/book.zip' });
  assert.equal(payload.creativeBrief.creativeDirection.userRequest, '');
  assert.deepEqual(payload.creativeBrief.creativeDirection.recentBooks, []);
  assert.equal(payload.creativeFingerprint.artProfileId, request.creativeDirection.artProfileId);
  assert.match(payload.creativeFingerprint.narrativeSignature, /Yeni Mevsim/);
});


test('literary possessive/conjunction titles survive; a category name remains invalid', () => {
  for (const title of ['Serinliğin Payı', 'Köklerin Payı', 'Gurur ve Önyargı']) {
    assert.equal(internals.isNarrativeBookTitleTooGeneric(title, { topic: '', subGenre: 'Dram', bookType: 'novel' }), false);
  }
  assert.equal(internals.isNarrativeBookTitleTooGeneric('Dram', { topic: '', subGenre: 'Dram', bookType: 'novel' }), true);
  assert.doesNotMatch(internals.buildNarrativeCraftMandates(true), /MYSTERY PRESERVATION MANDATE/);
  assert.doesNotMatch(internals.buildNarrativeCraftMandates(false), /GİZEM KORUMA ZORUNLULUĞU/);
});


test('a concrete literary synopsis need not literally repeat a metaphorical title', () => {
  const synopsis = 'Nermin ile Fatoş bir matbaada yıllardır aynı kitabın görünmeyen işlerini paylaşır. Yeni bir sipariş, tasarımın kimin adıyla sunulacağını ve birlikte çalışmanın bedelini ilk kez açık bir anlaşmazlığa dönüştürür.';
  assert.equal(internals.isGenericBookDescription(synopsis, 'Künyedeki Boşluk', false), false);
  assert.equal(internals.isGenericBookDescription('Harika bir kitap.', 'Künyedeki Boşluk', false), true);
});


test('all accepted source data survives up to the server input limit, including final preferences', () => {
  const request = 'a'.repeat(28000) + '\nFinal preference: no magic, ending bittersweet.';
  const direction = create('full-input', 'novel', [], request);
  assert.equal(direction.userRequest, request);
  assert.equal(normalize(JSON.parse(JSON.stringify(direction))).userRequest, request);
  assert.ok(narrative(direction).includes('ending bittersweet'));
});


test('educational writers receive original source details without a fictional plot mandate', () => {
  const original = 'Bir fotosentez çalışma kitabı. İki deney karşılaştırılsın; quiz olmasın; ölçümler gram ile verilsin.';
  const direction = create('workbook-original', 'story', [], original);
  const prompt = internals.buildCreativeBriefInstruction({ bookType: 'story', subGenre: 'Fotosentez', workbookCategory: 'Biyoloji', creativeDirection: direction }, 'tr', 15, '12-18');
  assert.ok(prompt.includes('ölçümler gram ile verilsin'));
  assert.ok(prompt.includes('Explicit user answers take precedence'));
  assert.ok(!prompt.includes('dramatic engine:'));
});

test('automatic medium respects speculative genres and workbook subject while retaining variety', () => {
  for (const subject of ['Fantastik', 'Bilimkurgu', 'Alternatif Dünya', 'Mitolojik']) {
    const directions = Array.from({ length: 150 }, (_, i) => create(`genre-${i}`, 'novel', [], '', '', 'general', subject));
    assert.ok(directions.every(d => d.artProfileId !== 'documentary-photo'));
    assert.ok(new Set(directions.map(d => d.artProfileId)).size >= 15);
  }
  assert.ok(Array.from({ length: 150 }, (_, i) => create(`physics-${i}`, 'story', [], '', '', 'general', 'Bilimsel / İzafiyet')).every(d => d.artProfileId !== 'botanical-plate'));
  assert.ok(Array.from({ length: 150 }, (_, i) => create(`plant-${i}`, 'story', [], '', '', 'general', 'Bilimsel / Fotosentez')).some(d => d.artProfileId === 'botanical-plate'));
  assert.match(art(create('sleep', 'fairy_tale'), 'fairy_tale', '1-6', 'Uyku Masalı'), /calm spacious scenes/);
});
test('explicit supported media override automatic choices and match stored fingerprints', () => {
  for (const [preference, expected] of [['Sulu boya, açık yeşil ve krem', 'watercolor'], ['Linocut with red ink', 'linocut'], ['Akrilik, geniş fırça izleri', 'acrylic']]) {
    const d = create('same', 'novel', [{ title: 'Previous', artProfileId: expected }], '', preference);
    assert.equal(d.artProfileId, expected);
    assert.ok(art(d, 'novel', 'general', 'Dram').includes(preference));
  }
});

test('canonical genre names reach their specific literary instructions rather than generic fallback', () => {
  for (const [genre, expected] of [['Bilimkurgu', /speculative systems/], ['Distopya', /system occupies/], ['Tarihi', /period texture/], ['Alternatif Dünya', /foundational world rule/]]) {
    assert.match(internals.buildNarrativeSubGenreLiteraryDirective('novel', genre, true), expected);
  }
  assert.match(internals.buildNovelSubGenrePathDirective('Bilimkurgu', true), /Sci-Fi/);
  assert.match(internals.buildNarrativeSubGenreLiteraryDirective('fairy_tale', 'Uyku Masalı', true), /no suspense/);
  assert.match(internals.buildNarrativeSubGenreLiteraryDirective('fairy_tale', 'Hayvan Masalları', true), /distinct habits/);
});
