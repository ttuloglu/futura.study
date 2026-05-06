#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const FASTLANE_METADATA_DIR = path.join(ROOT, 'fastlane', 'metadata');
const MODEL = 'gemini-3.1-flash-lite-preview';
const VERSION = '1.0.1';
const MAX_PROMO = 170;
const MIN_PROMO = 165;
const MAX_KEYWORDS = 100;
const MIN_KEYWORDS = 97;
const MAX_ATTEMPTS = 4;
const ONLY_ARG = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY_LOCALES = ONLY_ARG
  ? new Set(ONLY_ARG.replace('--only=', '').split(',').map((value) => value.trim()).filter(Boolean))
  : null;

const TURKISH_SOURCE = {
  promotionalText: 'Fortale ile masal, hikaye ve roman üret; kapak, bölüm görselleri, podcast sesi ve PDF/ePub dışa aktarma ile fikirlerini dakikalar içinde yayına hazır kitaba dönüştür.',
  keywords: 'masal,hikaye,öykü,roman,çocuk kitabı,kitap oluştur,ai kitap,podcast,sesli kitap,epub,pdf,kapak,kurgu',
  releaseNotes: `Bu sürümde iOS'ta görsel görüntüleme deneyimini iyileştirdik: yakınlaştırma hareketleri daha akıcı çalışıyor ve görseli aşağı çekerek kapatmak artık daha doğal hissettiriyor.\n\nOkuma deneyimi ve genel kararlılık için ek düzenlemeler de yaptık.`
};

const LOCALES = [
  { code: 'tr', language: 'Turkish', script: /[çğıöşüÇĞİÖŞÜ]/ },
  { code: 'en-GB', language: 'English (United Kingdom)', script: /[A-Za-z]/ },
  { code: 'en-US', language: 'English (United States)', script: /[A-Za-z]/ },
  { code: 'ar-SA', language: 'Arabic (Saudi Arabia)', script: /[\u0600-\u06FF]/ },
  { code: 'da', language: 'Danish', script: /[A-Za-zÆØÅæøå]/ },
  { code: 'de-DE', language: 'German (Germany)', script: /[A-Za-zÄÖÜäöüß]/ },
  { code: 'el', language: 'Greek', script: /[\u0370-\u03FF]/ },
  { code: 'es-ES', language: 'Spanish (Spain)', script: /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/ },
  { code: 'fi', language: 'Finnish', script: /[A-Za-zÄÖÅäöå]/ },
  { code: 'fr-FR', language: 'French (France)', script: /[A-Za-zÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆàâäçéèêëîïôöùûüÿœæ]/ },
  { code: 'hi', language: 'Hindi', script: /[\u0900-\u097F]/ },
  { code: 'id', language: 'Indonesian', script: /[A-Za-z]/ },
  { code: 'it', language: 'Italian', script: /[A-Za-zÀÈÉÌÍÎÒÓÙÚàèéìíîòóùú]/ },
  { code: 'ja', language: 'Japanese', script: /[\u3040-\u30FF\u4E00-\u9FFF]/ },
  { code: 'ko', language: 'Korean', script: /[\uAC00-\uD7AF]/ },
  { code: 'nl-NL', language: 'Dutch (Netherlands)', script: /[A-Za-z]/ },
  { code: 'no', language: 'Norwegian', script: /[A-Za-zÆØÅæøå]/ },
  { code: 'pl', language: 'Polish', script: /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/ },
  { code: 'pt-BR', language: 'Portuguese (Brazil)', script: /[A-Za-zÁÂÃÀÇÉÊÍÓÔÕÚáâãàçéêíóôõú]/ },
  { code: 'sv', language: 'Swedish', script: /[A-Za-zÅÄÖåäö]/ },
  { code: 'th', language: 'Thai', script: /[\u0E00-\u0E7F]/ },
];

const MANUAL_OVERRIDES = {
  'ar-SA': {
    promotionalText:
      'مع Fortale، حوّل أفكارك إلى كتب جاهزة للنشر في دقائق؛ أنشئ القصص والروايات، صمم الأغلفة، أضف صور الفصول، واستخرج ملفات PDF وePub بجودة احترافية وتجربة إبداعية مذهلة.',
    keywords:
      'قصص,روايات,تأليف,كتابة,أدب,نشر,كتب,أغلفة,غلاف,صور,فصول,بودكاست,صوت,إبداع,تنسيق,سرد,قصة,رواية,ملفات',
    releaseNotes:
      'في هذا الإصدار قمنا بتحسين تجربة عرض الصور على نظام iOS حيث أصبحت حركات التكبير أكثر سلاسة وأصبح إغلاق الصورة عن طريق سحبها للأسفل يبدو أكثر طبيعية كما أجرينا تحسينات إضافية على تجربة القراءة والاستقرار العام للتطبيق.'
  },
  ja: {
    promotionalText:
      'Fortaleで物語や小説を創作しましょう。表紙や挿絵の生成、ポッドキャスト音声化、PDFやePub出力まで、あなたのアイデアを数分で出版可能な書籍へ。直感的な操作で、プロ品質の作品作りを強力にサポートします。創造力を解き放ち、最高の読書体験を世界へ届けましょう。今すぐFortaleで、あなたの執筆活動を次のレベルへ引き上げてください。',
    keywords:
      '物語,小説,絵本,児童書,AI執筆,電子書籍,ポッドキャスト,音声本,ePub,PDF,表紙,挿絵,創作,執筆,物語作成,小説作成,書籍作成,出版,作家,ストーリー,章,朗読,文章,プロット,キャラ',
    releaseNotes:
      '今回のアップデートではiOSでの画像表示体験を改善しました。ズーム操作がよりスムーズになり、画像を下にスワイプして閉じる動作がより自然になりました。また、読書体験と全体的な安定性の向上に向けた調整も行いました。'
  },
  ko: {
    promotionalText:
      'Fortale로 동화와 소설을 써보세요. 표지와 삽화를 만들고, 오디오 변환과 PDF/ePub 내보내기까지 한 번에 지원해 아이디어를 몇 분 만에 출판 가능한 책으로 완성해 줍니다. 지금 당신만의 이야기를 세상에 펼쳐 보세요. 읽고 듣고 저장하는 완성형 창작 흐름을 지금 바로 새롭게 경험해 보세요.',
    keywords:
      '동화,소설,이야기,창작,글쓰기,AI책,전자책,오디오북,PDF,ePub,표지,삽화,출판,작가,문학,스토리,책만들기,창작앱,책쓰기,플롯,캐릭터,챕터,낭독,서사,장면,구성,커버,북디자인',
    releaseNotes:
      '이번 업데이트에서는 iOS의 이미지 보기 경험을 개선하여 확대 및 축소 동작이 더 부드러워졌고 이미지를 아래로 끌어 닫는 느낌이 더욱 자연스러워졌습니다. 또한 읽기 경험과 전반적인 안정성을 위한 추가 개선 사항이 포함되었습니다.'
  }
};

function normalizeKeywords(input) {
  return String(input || '')
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(',');
}

function trimKeywordsToMax(input) {
  const parts = normalizeKeywords(input).split(',').filter(Boolean);
  while (parts.length > 0 && parts.join(',').length > MAX_KEYWORDS) {
    parts.pop();
  }
  return parts.join(',');
}

function padKeywordsToMin(input) {
  const parts = trimKeywordsToMax(input).split(',').filter(Boolean);
  const extras = ['ai', 'app'];
  for (const extra of extras) {
    if (parts.includes(extra)) continue;
    const candidate = [...parts, extra].join(',');
    if (candidate.length <= MAX_KEYWORDS) {
      parts.push(extra);
    }
    if (parts.join(',').length >= MIN_KEYWORDS) break;
  }
  return parts.join(',');
}

function padPromotionalTextToMin(input) {
  const text = String(input || '').trim();
  if (text.length >= MIN_PROMO || text.length > MAX_PROMO) return text;
  if (text.length === MIN_PROMO - 1) {
    return `${text}!`;
  }
  return text;
}

function readGeminiApiKey() {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  const output = execSync('firebase functions:secrets:access GEMINI_API_KEY', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const value = String(output || '').trim();
  if (!value) {
    throw new Error('GEMINI_API_KEY secret resolved empty.');
  }
  return value;
}

function extractTextFromGeminiResponse(payload) {
  const candidates = payload?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => String(part?.text || '')).join('').trim();
}

function extractJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('JSON block not found in Gemini response.');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function validateLocaleContent(locale, data) {
  const errors = [];
  const promotionalText = String(data.promotionalText || '').trim();
  const keywords = normalizeKeywords(data.keywords);
  const releaseNotes = String(data.releaseNotes || '').trim();

  if (promotionalText.length < MIN_PROMO || promotionalText.length > MAX_PROMO) {
    errors.push(`promotionalText length ${promotionalText.length}`);
  }
  if (keywords.length < MIN_KEYWORDS || keywords.length > MAX_KEYWORDS) {
    errors.push(`keywords length ${keywords.length}`);
  }
  if (!releaseNotes) {
    errors.push('releaseNotes empty');
  }
  if (locale.code !== 'tr' && locale.script && !locale.script.test(`${promotionalText} ${keywords} ${releaseNotes}`)) {
    errors.push('script check failed');
  }
  return errors;
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function generateLocaleMetadata(apiKey, locale) {
  const manualOverride = MANUAL_OVERRIDES[locale.code];
  if (manualOverride) {
    return manualOverride;
  }
  if (locale.code === 'tr') {
    return {
      promotionalText: TURKISH_SOURCE.promotionalText,
      keywords: TURKISH_SOURCE.keywords,
      releaseNotes: TURKISH_SOURCE.releaseNotes
    };
  }

  let previousErrors = [];
  let previousDraft = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = `You are preparing Apple App Store Connect metadata for the app Fortale. Translate and adapt the Turkish source into ${locale.language}. Return ONLY valid JSON with keys promotionalText, keywords, releaseNotes.\n\nHard constraints:\n1) Keep the brand name exactly as Fortale.\n2) promotionalText must be natural ${locale.language}, maximum ${MAX_PROMO} characters, target range ${MIN_PROMO}-${MAX_PROMO}. Never exceed ${MAX_PROMO}. If it lands below ${MIN_PROMO}, make it slightly fuller with one short natural qualifier, not filler.\n3) keywords must be comma-separated with no spaces after commas, maximum ${MAX_KEYWORDS} characters, target range ${MIN_KEYWORDS}-${MAX_KEYWORDS}. Never exceed ${MAX_KEYWORDS}. Use short search nouns, remove articles and filler words.\n4) releaseNotes must preserve meaning exactly, stay concise, and not invent features.\n5) Use native ${locale.language} wording and script naturally.\n6) Do not mention App Store, subscriptions, pricing, discounts, or anything not in source text.\n7) Do not add emojis, quotation marks, bullets, numbering, or markdown.\n8) If a literal translation makes promotionalText or keywords too long, compress naturally while preserving intent.\n${previousErrors.length ? `9) Previous attempt failed for: ${previousErrors.join(' | ')}. Fix every issue.` : ''}\n${previousDraft ? `10) Your previous candidate was:\n${JSON.stringify(previousDraft, null, 2)}\nRewrite it so every limit passes.` : ''}\n\nTurkish source JSON:\n${JSON.stringify(TURKISH_SOURCE, null, 2)}`;

    const payload = await callGemini(apiKey, prompt);
    const parsed = extractJson(extractTextFromGeminiResponse(payload));
    const draft = {
      promotionalText: padPromotionalTextToMin(parsed.promotionalText),
      keywords: padKeywordsToMin(parsed.keywords),
      releaseNotes: String(parsed.releaseNotes || '').trim()
    };
    const errors = validateLocaleContent(locale, draft);
    if (errors.length === 0) return draft;
    previousErrors = errors;
    previousDraft = draft;
  }

  throw new Error(`${locale.code} could not be validated after ${MAX_ATTEMPTS} attempts: ${previousErrors.join(' | ')}`);
}

async function writeLocaleMetadata(localeCode, data) {
  const dir = path.join(FASTLANE_METADATA_DIR, localeCode);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'promotional_text.txt'), `${String(data.promotionalText).trim()}\n`, 'utf8');
  await fs.writeFile(path.join(dir, 'keywords.txt'), `${normalizeKeywords(data.keywords)}\n`, 'utf8');
  await fs.writeFile(path.join(dir, 'release_notes.txt'), `${String(data.releaseNotes).trim()}\n`, 'utf8');
}

async function main() {
  await fs.mkdir(FASTLANE_METADATA_DIR, { recursive: true });
  const apiKey = readGeminiApiKey();
  const summary = {};
  const locales = ONLY_LOCALES
    ? LOCALES.filter((locale) => ONLY_LOCALES.has(locale.code))
    : LOCALES;

  for (const locale of locales) {
    const data = await generateLocaleMetadata(apiKey, locale);
    await writeLocaleMetadata(locale.code, data);
    summary[locale.code] = {
      promotionalTextLength: String(data.promotionalText).trim().length,
      keywordsLength: normalizeKeywords(data.keywords).length,
      releaseNotesLength: String(data.releaseNotes).trim().length
    };
    console.log(`prepared ${locale.code} promo=${summary[locale.code].promotionalTextLength} keywords=${summary[locale.code].keywordsLength}`);
  }

  await fs.writeFile(path.join(FASTLANE_METADATA_DIR, '_summary.json'), `${JSON.stringify({ version: VERSION, model: MODEL, summary }, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
