import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const learningSource = fs.readFileSync(new URL('../functions/src/languageLearning.ts', import.meta.url), 'utf8');
const learningCompiled = ts.transpileModule(learningSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const learningModule = `data:text/javascript;base64,${Buffer.from(learningCompiled).toString('base64')}`;
const source = fs.readFileSync(new URL('../functions/src/bookCreationIntake.ts', import.meta.url), 'utf8');
const taxonomySource = fs.readFileSync(new URL('../functions/src/bookTaxonomy.ts', import.meta.url), 'utf8');
const taxonomyCompiled = ts.transpileModule(taxonomySource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const taxonomyModule = `data:text/javascript;base64,${Buffer.from(taxonomyCompiled).toString('base64')}`;
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace("'./bookTaxonomy'", JSON.stringify(taxonomyModule))
  .replace("'./languageLearning'", JSON.stringify(learningModule));
const { normalizeBookIntakeResult: normalize, formatBookIntakeAnswers, BOOK_INTAKE_OTHER_KEY, getBookCreationEntryStage, resolveBookCreationMode } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const context = (bookType, extra = {}) => ({ bookType, language: 'tr', bookLanguage: 'Turkish', history: [
  { role: 'user', content: 'Kahraman Deniz olsun; sonunda eve dönsün.' },
  { role: 'assistant', content: 'Kaç yaşındaki okurlar için?' },
  { role: 'user', content: `FORTALE_INTAKE_ANSWERS=${JSON.stringify([{ purpose: 'subgenre', answer: bookType === 'story' ? 'Biyoloji' : 'Macera' }])}` },
], newMessage: '8 yaş için, sade bir dille.', hasPortrait: false, ...extra });
const ready = (ageGroup, extra = {}) => ({ status: 'ready', message: 'Hazır.', draft: {
  topic: 'Denizin yolculuğu', sourceContent: 'An agreed premise', ageGroup,
  creativeBrief: { bookType: 'novel', languageText: 'English', endingStyle: 'twist', subGenre: 'Macera', workbookCategory: 'Bilimsel' }, ...extra,
} });
for (const [bookType, age] of [['fairy_tale', '1-6'], ['novel', '7-11'], ['story', '12-18']]) {
  test(`${bookType}: keeps chosen type, audience and full user answers at generation boundary`, () => {
    const result = normalize(ready(age), context(bookType));
    assert.equal(result.draft.creativeBrief.bookType, bookType);
    assert.equal(result.draft.ageGroup, age);
    assert.match(result.draft.sourceContent, /Kahraman Deniz olsun; sonunda eve dönsün/);
    assert.match(result.draft.sourceContent, /8 yaş için, sade bir dille/);
    assert.equal(result.draft.creativeBrief.languageText, 'English');
    if (bookType === 'fairy_tale') assert.equal(result.draft.creativeBrief.endingStyle, 'happy');
    if (bookType === 'story') {
      assert.equal(result.draft.creativeBrief.includeExamples, true);
      assert.equal(result.draft.creativeBrief.includeQuiz, false);
    }
  });
}
test('a question cannot carry a draft into generation', () => {
  const questions = [{ id: 'emotion', purpose: 'emotional_goal', question: 'Hangi duyguyu hissettirsin?', options: ['Merak', 'Güven'] }];
  assert.deepEqual(normalize({ ...ready('7+'), status: 'question', questions }, context('fairy_tale')), { status: 'question', message: 'Hazır.', questions });
});
test('invalid or incomplete ready output cannot trigger production', () => {
  for (const raw of [null, {}, { status: 'ready', message: 'Hi' }, ready('1-6', { topic: '' })]) {
    assert.throws(() => normalize(raw, context('fairy_tale')));
  }
});
test('explicit genre wins over invented genre; workbooks keep discipline separate from topic', () => {
  for (const bookType of ['fairy_tale', 'novel']) {
    const raw = ready('general', { creativeBrief: { workbookCategory: 'Biyoloji' } });
    assert.equal(normalize(raw, context(bookType)).draft.creativeBrief.subGenre, 'Macera');
  }
  assert.throws(() => normalize(ready('general', { creativeBrief: {} }), context('story')));
  const result = normalize(ready('general', { creativeBrief: { workbookCategory: 'Kimya', subGenre: 'Hücre bölünmesi' } }), context('story'));
  assert.equal(result.draft.creativeBrief.workbookCategory, 'Biyoloji');
  assert.equal(result.draft.creativeBrief.subGenre, 'Hücre bölünmesi');
});
test('a portrait is optional; attached portraits require an identified protagonist', () => {
  assert.doesNotThrow(() => normalize(ready('7+'), context('fairy_tale')));
  assert.throws(() => normalize(ready('7+'), context('fairy_tale', { hasPortrait: true })));
  assert.equal(normalize(ready('7+', { heroPortraitName: 'Deniz' }), context('fairy_tale', { hasPortrait: true })).draft.heroPortraitName, 'Deniz');
  assert.equal(normalize(ready('12-18', { heroPortraitName: 'Deniz' }), context('story', { hasPortrait: true })).draft.heroPortraitName, undefined);
});

const detailQuestions = [
  { id: 'age', purpose: 'audience', question: 'Kimler için?', options: ['Çocuklar', 'Yetişkinler'], recommended: 'Çocuklar' },
  { id: 'hero', purpose: 'protagonist', question: 'Kahraman kim olsun?', options: ['Deniz', 'Ada'] },
];
test('selected choices and Other text preserve their question context', () => {
  const content = formatBookIntakeAnswers(detailQuestions, {
    age: { selected: 'Çocuklar' }, hero: { selected: BOOK_INTAKE_OTHER_KEY, otherText: '  Kahramanın adı Elif, 8 yaşında.  ' },
  });
  assert.equal(content.split('\nFORTALE_INTAKE_ANSWERS=')[0], 'Kimler için?: Çocuklar\nKahraman kim olsun?: Kahramanın adı Elif, 8 yaşında.');
  assert.equal(JSON.parse(content.split('FORTALE_INTAKE_ANSWERS=')[1])[1].purpose, 'protagonist');
  const result = normalize(ready('7+'), context('fairy_tale', { newMessage: content }));
  assert.match(result.draft.sourceContent, /Kahramanın adı Elif, 8 yaşında/);
  assert.doesNotMatch(content, /__other__/);
});
test('empty Other and unknown choices cannot submit a detail batch', () => {
  assert.throws(() => formatBookIntakeAnswers(detailQuestions, { age: { selected: 'Çocuklar' }, hero: { selected: BOOK_INTAKE_OTHER_KEY, otherText: '   ' } }));
  assert.throws(() => formatBookIntakeAnswers(detailQuestions, { age: { selected: 'unknown' }, hero: { selected: 'Ada' } }));
});
test('plain chat questions and malformed choice batches are rejected', () => {
  for (const questions of [undefined, [], [{ id: 'a', question: 'Hi', options: ['One'] }], [detailQuestions[0], detailQuestions[0]]]) {
    assert.throws(() => normalize({ status: 'question', message: 'Details', questions }, context('novel')));
  }
});
test('Other is supplied by the UI once, never duplicated by model choices', () => {
  const result = normalize({ status: 'question', message: 'Details', questions: [{ ...detailQuestions[0], options: ['Çocuklar', 'Yetişkinler', 'Diğer…'] }] }, context('novel'));
  assert.deepEqual(result.questions[0].options, ['Çocuklar', 'Yetişkinler']);
});

test('only narrative books show the opening choice; workbooks keep their input', () => {
  assert.equal(getBookCreationEntryStage('fairy_tale'), 'choice');
  assert.equal(getBookCreationEntryStage('novel'), 'choice');
  assert.equal(getBookCreationEntryStage('story'), 'prompt');
  assert.equal(resolveBookCreationMode('novel', 'guided'), 'guided');
  assert.equal(resolveBookCreationMode('story'), 'custom');
  assert.throws(() => resolveBookCreationMode('story', 'guided'));
});
test('both guided and custom creation require initial detail questions with subgenre', () => {
  const guidedFirst = normalize(ready('general'), context('novel', { creationMode: 'guided', history: [] }));
  assert.equal(guidedFirst.status, 'question');
  assert.equal(guidedFirst.questions.some(q => q.purpose === 'subgenre'), true);

  const customFirst = normalize(ready('general'), context('novel', { creationMode: 'custom', history: [] }));
  assert.equal(customFirst.status, 'question');
  assert.equal(customFirst.questions.some(q => q.purpose === 'subgenre'), true);
});
test('selected subgenre from answers is strictly applied to draft creativeBrief', () => {
  const result = normalize(
    ready('general', { creativeBrief: { subGenre: 'Romantik' } }),
    context('novel', {
      history: [
        { role: 'user', content: 'Bir macera olsun' },
        { role: 'assistant', content: 'Hangi alt türde bir hikaye istiyorsunuz?' }
      ],
      newMessage: 'Hangi alt türde bir hikaye istiyorsunuz?: Bilimkurgu'
    })
  );
  assert.equal(result.draft.creativeBrief.subGenre, 'Bilimkurgu');
});
test('fairy tale production stays in the fixed preschool bucket in both modes', () => {
  for (const creationMode of ['guided', 'custom']) {
    for (const modelAudience of ['7+', 'general', '0-6', '1-6', undefined]) {
      const result = normalize(ready(modelAudience), context('fairy_tale', { creationMode }));
      assert.equal(result.draft.ageGroup, '1-6');
      assert.match(result.draft.creativeBrief.customInstructions, /0–6 years/);
      const validatedAgain = normalize(result, context('fairy_tale', { creationMode }));
      assert.equal(validatedAgain.draft.creativeBrief.customInstructions, result.draft.creativeBrief.customInstructions);
    }
  }
});
test('audience questions are never shown for fairy tales, regardless of question language', () => {
  const raw = { status: 'question', message: 'Details', questions: [
    { id: 'reader_age', purpose: 'audience', question: 'Quel âge a le lecteur ?', options: ['3 ans', '8 ans'] },
    { id: 'emotion', purpose: 'emotional_goal', question: 'Quel sentiment privilégier ?', options: ['Confiance', 'Curiosité'] },
  ] };
  assert.deepEqual(normalize(raw, context('fairy_tale')).questions.map(q => q.id), ['emotion']);
  assert.equal(normalize(raw, context('novel')).questions.length, 2);
  assert.throws(() => normalize({ ...raw, questions: [raw.questions[0]] }, context('fairy_tale')));
});


test('assistant suggestions, category prose and long conversation never count as a user genre choice', () => {
  for (const newMessage of ['8 yaş için.', 'Kategori: Saat tamircilerinin dünyası', 'genre: mystery']) {
    const result = normalize(ready('general'), context('novel', {
      history: [
        { role: 'user', content: 'Komşuların birlikte bahçe kurmasını istiyorum.' },
        { role: 'assistant', content: 'Önerdiğim alt tür: Gizem / Polisiye' },
        { role: 'user', content: 'Kahraman bir hemşire olsun.' },
      ], newMessage,
    }));
    assert.equal(result.status, 'question');
    assert.equal(result.questions[0].purpose, 'subgenre');
  }
});

test('translated structured answers remain authoritative and Other is a real choice', () => {
  const question = { id: 'genre', purpose: 'subgenre', question: 'どのジャンルにしますか？', options: ['恋愛', '喜劇'] };
  const newMessage = formatBookIntakeAnswers([question], { genre: { selected: BOOK_INTAKE_OTHER_KEY, otherText: '家族小説' } });
  const result = normalize(ready('general'), context('novel', { language: 'ja', history: [
    { role: 'assistant', content: JSON.stringify([question]) },
  ], newMessage }));
  assert.equal(result.status, 'ready');
  assert.equal(result.draft.creativeBrief.subGenre, '家族小説');
});

test('last actual user selection wins; a later recommendation cannot override it', () => {
  const newMessage = 'FORTALE_INTAKE_ANSWERS=' + JSON.stringify([{ purpose: 'subgenre', answer: 'Romantik' }]);
  const selectedContext = context('novel', { history: [
    ...context('novel').history, { role: 'user', content: newMessage },
    { role: 'assistant', content: 'Alt tür: Gizem / Polisiye' },
  ], newMessage: 'Final buruk olsun.' });
  assert.equal(normalize(ready('general'), selectedContext).draft.creativeBrief.subGenre, 'Romantik');
});

test('missing genre reappears first even if a later question batch tries to skip it', () => {
  const result = normalize({ status: 'question', message: 'Details', questions: detailQuestions }, context('novel', { history: [{ role: 'user', content: 'Bir hikaye yaz.' }] }));
  assert.equal(result.questions[0].purpose, 'subgenre');
});

test('explicit art preferences and long detailed notes survive intake', () => {
  const note = 'Karakterlerin ilişkisini ve tamir atölyesini koru. '.repeat(40);
  const result = normalize(ready('general', { creativeBrief: { visualStyle: 'Siyah beyaz gravür, kırmızı tek vurgu.', customInstructions: note } }), context('novel'));
  assert.equal(result.draft.creativeBrief.visualStyle, 'Siyah beyaz gravür, kırmızı tek vurgu.');
  assert.equal(result.draft.creativeBrief.customInstructions, note.trim());
});

test('all four production paths ask for a deliberate genre and keep the selected genre and art', () => {
  const cases = [
    ['fairy_tale', 'Hayvan Masalları', undefined], ['novel', 'Komedi', undefined],
    ['story', 'Bilimsel', undefined],
    ['novel', 'Tarihi', { version: 1, purpose: 'language_learning', targetLanguage: 'ja', explanationLanguage: 'tr', cefrLevel: 'B1', audience: 'general' }],
  ];
  for (const [bookType, chosen, languageLearning] of cases) {
    const unselected = context(bookType, { history: [{ role: 'user', content: 'Bir konu önerisi.' }], languageLearning });
    assert.equal(normalize(ready('general'), unselected).questions[0].purpose, 'subgenre');
    const result = normalize(ready('general', { creativeBrief: { subGenre: bookType === 'story' ? 'Fotosentez' : 'Gizem / Polisiye', workbookCategory: 'Araştırma', visualStyle: 'Sulu boya, açık yeşil ve krem.', languageText: 'English' } }),
      { ...unselected, newMessage: `FORTALE_INTAKE_ANSWERS=${JSON.stringify([{ purpose: 'subgenre', answer: chosen }])}` });
    assert.equal(result.status, 'ready');
    assert.equal(bookType === 'story' ? result.draft.creativeBrief.workbookCategory : result.draft.creativeBrief.subGenre, chosen);
    assert.equal(result.draft.creativeBrief.visualStyle, 'Sulu boya, açık yeşil ve krem.');
    if (languageLearning) {
      assert.equal(result.draft.creativeBrief.languageText, 'ja');
      assert.equal(result.draft.creativeBrief.languageLearning.cefrLevel, 'B1');
      assert.equal(result.draft.creativeBrief.languageLearning.audience, 'general');
    }
  }
});
test('a misleading question id cannot replace the actual genre question', () => {
  const result = normalize({ status: 'question', message: 'Ayrıntılar.', questions: [{ id: 'book_subgenre', purpose: 'tone', question: 'Hangi ton?', options: ['Sakin', 'Neşeli'] }] }, context('novel', { history: [] }));
  assert.equal(result.questions[0].purpose, 'subgenre');
  assert.equal(new Set(result.questions.map(q => q.id)).size, result.questions.length);
});

test('queued and synchronous classification guard rejects missing workbook field or subject', async () => {
  const { hasRequiredBookClassification: valid } = await import(taxonomyModule);
  for (const bookType of ['novel', 'fairy_tale', 'story']) {
    assert.equal(valid({ bookType }), false);
    assert.equal(valid({ bookType, subGenre: '__fortale__' }), false);
  }
  assert.equal(valid({ bookType: 'story', subGenre: 'Fotosentez' }), false);
  assert.equal(valid({ bookType: 'story', workbookCategory: 'Bilimsel' }), false);
  assert.equal(valid({ bookType: 'story', workbookCategory: 'Bilimsel', subGenre: 'Fotosentez' }), true);
  assert.equal(valid({ bookType: 'novel', subGenre: 'Komedi' }), true);
});
