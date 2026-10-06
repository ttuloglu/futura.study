import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import JSZip from 'jszip';

// Exercise the actual production functions with provider/storage boundaries mocked.
const source = fs.readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const names = [
  'firstBookIllustrationSection', 'firstBookInteriorImage', 'generateLessonImages',
  'generateCourseCover', 'generateLectureImages', 'embedImagesIntoMarkdown',
  'pickEvenlySpacedSectionIndexes', 'pickEvenlySpacedFromOrdered',
  'getImageCountPlanByBookType', 'getNarrativeFourPanelImageCountByBookType',
  'resolveNarrativeSectionVisualPlan', 'getNarrativeLectureImageCount',
  'buildVisualStoryPageImagePrompt', 'generateVisualStoryImage',
  'generateValidatedVisualStoryImage', 'runBookAssetsStage',
  'rewriteMarkdownImageAssetsForBundle', 'buildAndPublishBookBundle'
];
const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
assert.equal(functions.length, names.length);
const compiled = ts.transpileModule(functions.map(n => n.getText(ast)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;
const logger = { info() {}, warn() {}, error() {} };
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const cost = { estimatedCostUsd: 0.01, quality: 'low', size: '1024x1536' };
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2, inputTextTokens: 1, inputImageTokens: 0 };
function runtime(extra = {}) {
  const env = {
    console, Buffer, logger, HttpsError, JSZip,
    FAIRY_TALE_TOTAL_IMAGE_COUNT: 4, STORY_TOTAL_IMAGE_COUNT: 2, NOVEL_TOTAL_IMAGE_COUNT: 6,
    STORY_CHAPTER_COUNT: 5, VISUAL_FAIRY_TALE_PAGE_COUNT: 8,
    OPENAI_IMAGE_MODEL: 'gpt-image-2.5-sunburst', OPENAI_COVER_MODEL: 'gpt-image-2.5-sunburst',
    isBrainRelatedTopic: () => false, compactInline: v => v || '',
    resolveVisualContentLanguage: () => 'tr', contentLanguageLabel: () => 'Turkish',
    resolvePreferredLanguageFromBrief: () => 'tr', normalizeStoryPathKey: v => v || '',
    buildNarrativeVisualStyleDirective: () => 'storybook',
    buildCoverTitleTypographyDirective: () => 'integrated lettering',
    buildCoverCompositionAntiClicheDirective: () => 'original composition',
    buildNarrativeHeroPortraitDirective: name => `Preserve portrait identity: ${name}`,
    resolveVisualFairyTaleAudienceBucket: () => '1-6',
    buildOpenAiGptImageLowCostBreakdown: () => cost,
    normalizeSmartBookCreativeBrief: brief => brief,
    mapWithConcurrency: (items, _, fn) => Promise.all(items.map(fn)),
    withTimeout: promise => promise, withTransientProviderRetry: fn => fn(),
    FieldValue: { serverTimestamp: () => 'now' },
    resolveBookGenerationState: state => state, serializeBookGenerationState: state => state,
    resolveUsageEntriesFromJobData: entries => entries || [],
    resolveOpenAiApiKey: () => 'mock-key', createGoogleGenAiClient: () => ({}),
    markBookStageProcessing: async () => true, buildBookJobUsageSnapshot: () => ({}),
    buildGeneratedBookCoursePayload: p => p, normalizeCoursePayloadForClient: (_, p) => p,
    toErrorMessage: e => e.message, ...extra
  };
  vm.createContext(env); vm.runInContext(compiled, env); return env;
}
test('first interior illustration uses the cover API once, title inside the art, for every format', async () => {
  for (const bookType of ['fairy_tale', 'novel', 'story']) {
    const requests = [];
    const env = runtime({ requestLowQualityLessonImages: async (_, prompt, count, options) => {
      requests.push({ prompt, count, options }); return { images: ['data:image/png;base64,AA=='], usage, model: 'gpt-image-2.5-sunburst' };
    } });
    const portrait = { dataUrl: 'portrait' };
    const result = await env.generateLessonImages('Kıyıdaki Küçük Kabuk', 'İlk keşif', 'mock-key', 'Kıyı, denizdeki yıldızla tanışır.', bookType === 'story' ? 'academic' : bookType,
      { bookType, subGenre: 'Macera', languageText: 'tr' }, '1-6', 1,
      { outlinePositions: { current: bookType === 'story' ? 2 : 1, total: 6 } }, portrait, 'Kıyı');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].count, 1);
    assert.equal(requests[0].options.sizeMode, 'cover-3x4');
    assert.equal(requests[0].options.modelOverride, 'gpt-image-2.5-sunburst');
    assert.ok(requests[0].prompt.includes('Kullanılacak TEK görünür metin şudur: "Kıyıdaki Küçük Kabuk"'));
    assert.ok(requests[0].prompt.includes('Kıyı, denizdeki yıldızla tanışır.'));
    assert.ok(requests[0].prompt.includes('ilk iç görselidir'));
    assert.equal(result.images[0].dataUrl, 'data:image/png;base64,AA==');
    assert.equal(result.usageEntry.label, 'İlk keşif: İlk görsel ve kapak');
    assert.equal(result.usageEntry.quality, 'low');
    if (bookType !== 'story') assert.equal(requests[0].options.referenceImages[0], portrait);
    else assert.equal(requests[0].options.referenceImages, undefined);
  }
});

test('mandatory title and cover composition survive long-source prompt truncation', async () => {
  let sent;
  const env = runtime({
    buildNarrativeHeroPortraitDirective: () => 'Portrait identity '.repeat(120),
    buildNarrativeVisualStyleDirective: () => 'Visual style '.repeat(120),
    requestLowQualityLessonImages: async (_, prompt) => {
      sent = prompt.replace(/[^\S\r\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4800);
      return { images: ['image'], usage };
    }
  });
  await env.generateCourseCover('Küçük Kıyı', 'novel', 'key', 'general', { bookType: 'novel' }, 'Context '.repeat(1000), {}, 'Kıyı', { title: 'Opening', text: 'First scene '.repeat(1000) });
  assert.ok(sent.includes('Kullanılacak TEK görünür metin şudur: "Küçük Kıyı"'));
  assert.ok(sent.includes('Dikey kitap kapağı kompozisyonu zorunludur'));
  assert.ok(sent.includes('ilk iç görselidir'));
  assert.ok(sent.includes('First scene'));
});

test('visual fairy tale sends a portrait title image first and keeps other pages landscape and text-free', async () => {
  const requests = [];
  const env = runtime({ requestLowQualityLessonImages: async (_, prompt, count, options) => {
    requests.push({ prompt, count, options }); return { images: [`image-${requests.length}`], usage };
  } });
  for (const isCover of [true, false]) {
    const prompt = env.buildVisualStoryPageImagePrompt({ bookTitle: 'Küçük Kıyı', pageTitle: 'Keşif', pageText: 'Kıyı sahile çıkar.', scenePrompt: 'Sunny beach', characterBible: 'White shell', styleAnchor: '3D', pageNumber: isCover ? 1 : 2, totalPages: 8, audienceLevel: '1-6', isCover });
    await env.generateValidatedVisualStoryImage({ ai: {}, openAiApiKey: 'key', prompt, label: 'page', audienceLevel: '1-6', isCover });
  }
  assert.equal(requests[0].options.sizeMode, 'cover-3x4');
  assert.equal(requests[1].options.sizeMode, 'poster-16x9');
  assert.ok(requests[0].prompt.includes('The ONLY visible text must be this exact title: "Küçük Kıyı"'));
  assert.ok(requests[0].prompt.includes('Kıyı sahile çıkar.'));
  assert.ok(!requests[0].prompt.includes('Landscape 15:10 only'));
  assert.ok(requests[1].prompt.includes('text-free'));
  assert.ok(!requests[1].prompt.includes('Required cover title language'));
});

function stageRuntime(bookType, state, extra = {}) {
  const ctx = { uid: 'u', courseId: 'book', creatorName: 'Fortale', bookType,
    ageGroup: '1-6', generationAgeGroup: '1-6', creativeBrief: { bookType },
    jobData: { generationStage: 'assets', generationState: state, usageEntries: [] } };
  const result = { requests: [], stored: [], queued: null, transitions: [] };
  const env = runtime({
    readActiveBookStageContext: async () => ctx,
    persistGeneratedBookAsset: async p => { result.stored.push(p); return `smartbooks/u/book/${p.key}.png`; },
    persistGeneratedMarkdownImages: async p => p.markdown.replace(/image-(\d+)/g, 'smartbooks/u/book/image-$1.png'),
    generateValidatedVisualStoryImage: undefined,
    queueBookBundleFromCourse: async p => { result.queued = p; },
    transitionBookJobStage: async (_, patch, stage, task) => {
      result.transitions.push(task); ctx.jobData = { ...ctx.jobData, ...patch, generationStage: stage };
    }, ...extra
  });
  env.generateValidatedVisualStoryImage = async p => {
    result.requests.push(p); return { imageUrl: `image-${result.requests.length}`, usageEntries: [{ label: p.label }] };
  };
  return { env, ctx, result, job: { id: 'job', set: async () => {} } };
}

test('batched visual generation makes 8 page calls, no ninth cover call, and resumes with the same cover', async () => {
  const state = { pipeline: 'visual', bookTitle: 'Küçük Kıyı', nextVisualPageIndex: 0, generatedNodes: [],
    plan: { pages: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, title: `P${i}`, pageText: `Story ${i}`, scenePrompt: `Scene ${i}` })), characterBible: 'shell', styleAnchor: '3D', coverText: 'Opening' } };
  const { env, ctx, result, job } = stageRuntime('fairy_tale', state);
  await env.runBookAssetsStage(job, { visualPageStart: 0 });
  assert.equal(result.requests.length, 4);
  assert.equal(ctx.jobData.generationState.coverImageUrl, ctx.jobData.generationState.generatedNodes[0].pageImageUrl);
  // A duplicate old task must not generate or change anything.
  await env.runBookAssetsStage(job, { visualPageStart: 0 });
  assert.equal(result.requests.length, 4);
  await env.runBookAssetsStage(job, { visualPageStart: 4 });
  assert.equal(result.requests.length, 8); assert.equal(result.stored.length, 8);
  assert.equal(result.requests.filter(r => r.isCover).length, 1);
  assert.equal(result.queued.course.coverImageUrl, result.queued.course.nodes[0].pageImageUrl);
  assert.equal(result.queued.usageEntries.length, 8);
  assert.equal(result.queued.course.nodes.length, 8);
});

test('standard paths keep 4/6/2 interior images and derive cover from their first persisted illustration', async () => {
  for (const [bookType, total, expected, firstSection] of [['fairy_tale', 5, 4, 1], ['novel', 6, 6, 1], ['story', 5, 2, 2]]) {
    const nodes = Array.from({ length: total }, (_, i) => ({ id: `n${i}`, type: 'lecture', title: `Section ${i + 1}`, content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.' }));
    const state = { pipeline: 'standard', bookTitle: 'Title', generatedNodes: nodes, lectureNodes: nodes, nextContentIndex: total, finalTargetPageCount: 30 };
    const { env, result, job } = stageRuntime(bookType, state);
    const calls = [];
    env.generateLessonImages = async (...args) => {
      calls.push(args); return { images: [{ dataUrl: `image-${calls.length}`, alt: 'art' }], usageEntry: { label: 'image' } };
    };
    // Any stage-level, additional cover request is a regression.
    env.generateCourseCover = () => { throw new Error('Separate cover generation is forbidden'); };
    await env.runBookAssetsStage(job, {});
    assert.equal(calls.length, expected);
    assert.equal(calls[0][8].outlinePositions.current, firstSection);
    const course = result.queued.course;
    const first = env.firstBookInteriorImage(course.nodes);
    assert.equal(course.coverImageUrl, first);
    assert.ok(first.startsWith('smartbooks/u/book/'));
    assert.equal(result.queued.usageEntries.length, expected);
    // Retrying with already persisted images must not add another image or cover call.
    state.generatedNodes = course.nodes;
    await env.runBookAssetsStage(job, {});
    assert.equal(calls.length, expected);
  }
});

test('failed first illustration prevents publishing a text-only cover', async () => {
  for (const bookType of ['novel', 'story']) {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, type: 'lecture', title: 'Section', content: 'Text' }));
    const state = { pipeline: 'standard', bookTitle: 'Title', generatedNodes: nodes, lectureNodes: nodes, nextContentIndex: 5 };
    const { env, result, job } = stageRuntime(bookType, state);
    env.generateLessonImages = async () => { throw new Error('Provider unavailable'); };
    await assert.rejects(env.runBookAssetsStage(job, {}), /Provider unavailable/);
    assert.equal(result.queued, null);
  }
});

for (const visual of [true, false]) test(`bundle reuses one image file for cover and ${visual ? 'visual page' : 'markdown illustration'}`, async () => {
  let zip;
  let loads = 0;
  class InspectZip extends JSZip { constructor() { super(); zip = this; } }
  const env = runtime({ JSZip: InspectZip,
    sanitizeBundlePathPart: (v, fallback) => v || fallback,
    randomUUID: () => 'mock-id', firstNonEmptyString: (...v) => v.find(x => typeof x === 'string' && x.trim()) || '',
    toIsoStringIfPossible: () => undefined,
    inferExtensionFromContentType: () => 'png',
    loadBinaryAssetFromSource: async () => { loads++; return { buffer: Buffer.from('same-art'), contentType: 'image/png', extension: 'png' }; },
    getUserBookRef: () => ({ get: async () => { throw new Error('STOP_BEFORE_PUBLISH'); } })
  });
  const asset = 'smartbooks/u/book/first.png';
  await assert.rejects(env.buildAndPublishBookBundle({ uid: 'u', bookId: 'book', sourceCoursePayload: {
    topic: 'Title', coverImageUrl: asset, nodes: [{ id: 'first', type: 'lecture',
      ...(visual ? { pageImageUrl: asset, pageText: 'Text' } : { content: `Text\n\n![Title](${asset})` }) }]
  } }), /STOP_BEFORE_PUBLISH/);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const imagePath = visual ? manifest.nodes[0].pageImageUrl : manifest.nodes[0].content.match(/!\[[^\]]*\]\(([^)]+)\)/)[1];
  assert.equal(manifest.cover.path, imagePath);
  assert.equal(loads, 1);
  assert.equal(Object.keys(zip.files).filter(k => /\.png$/.test(k)).length, 1);
  assert.equal(await zip.file(imagePath).async('string'), 'same-art');
});
