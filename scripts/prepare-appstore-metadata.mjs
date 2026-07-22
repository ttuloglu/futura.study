#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const FASTLANE_METADATA_DIR = path.join(ROOT, 'fastlane', 'metadata');
const MODEL = 'gemini-3.1-flash-lite';
const VERSION = '1.0.5';
const MAX_PROMO = 170;
const MIN_PROMO = 140;
const TARGET_MAX_PROMO = 168;
const MAX_KEYWORDS = 100;
const MIN_KEYWORDS = 50;
const TARGET_MAX_KEYWORDS = 98;
const MAX_DESCRIPTION = 4000;
const MIN_DESCRIPTION = 1200;
const TARGET_MAX_DESCRIPTION = 2200;
const MAX_RELEASE_NOTES = 3500;
const MIN_RELEASE_NOTES = 1000;
const TARGET_MAX_RELEASE_NOTES = 1800;
const MAX_ATTEMPTS = 6;
const ONLY_ARG = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY_LOCALES = ONLY_ARG
  ? new Set(ONLY_ARG.replace('--only=', '').split(',').map((value) => value.trim()).filter(Boolean))
  : null;

const TURKISH_SOURCE = {
  promotionalText: 'Portre destekli karakterlerle masal, hikaye ve roman üret; daha kaliteli anlatım, güçlü kapak ve bölüm görselleriyle fikrini heyecan verici kitaba dönüştür. Şimdi dene.',
  keywords: 'masal,hikaye,öykü,roman,portre,karakter,ai kitap,kitap oluştur,kapak,görsel,podcast,epub,pdf,kitabı',
  description: '',
  releaseNotes: `Fortale 1.0.4, kişisel ve heyecan verici kitap üretimini daha güçlü hale getirir. Bu sürümün odağında, kullanıcının hayalindeki karakteri daha tanıdık, daha tutarlı ve daha etkileyici bir anlatıya dönüştüren portre destekli üretim deneyimi var. İsteğe bağlı portre ekleme akışıyla ana karakterinizi görsel olarak daha kararlı biçimde kitaba dahil edebilir; masal, hikaye ve roman üretirken karakterin kapakta, bölüm görsellerinde ve sahne atmosferinde daha bütünlüklü görünmesine yardımcı olabilirsiniz. Portre, kitabın ana karakterini resmetmek için kullanılan yaratıcı bir referanstır; amaç, her bölümde daha tanınabilir ve daha kişisel bir kitap hissi oluşturmaktır.\n\nKitap üretim kalitesi bu sürümde belirgin şekilde iyileştirildi. Seçilen tür, alt tür, yaş grubu, anlatı tonu ve yaratıcı yönlendirmeler artık metne daha tutarlı yansır. Masallarda daha sıcak, merak uyandıran ve çocuklara uygun bir akış; hikayelerde daha net sahne geçişleri, daha güçlü karakter motivasyonu ve daha canlı atmosfer; romanlarda ise daha uzun soluklu olay örgüsü, daha dengeli bölüm yapısı ve daha sürükleyici gerilim hedeflendi. Böylece Fortale, kısa bir fikirden yalnızca metin üretmek yerine, okuması keyifli ve heyecanı daha yüksek bir kitap deneyimi oluşturmaya odaklanır.\n\nGörsel bütünlük de güçlendirildi. Kapak görseli, bölüm görselleri ve karakter anlatımı arasındaki bağ daha dikkatli kurulacak şekilde üretim akışı düzenlendi. Özellikle portre destekli kitaplarda karakterin görünüşü, hikaye dünyası ve sahne tonu arasında daha doğal bir uyum yakalanması amaçlandı. Kullanıcıların masal, hikaye ve roman fikirleri; kapak, bölüm görselleri, anlatı ritmi ve dışa aktarılabilir kitap çıktısıyla daha yayınlanmaya hazır bir forma yaklaşır.\n\nÜretim ve okuma deneyiminde de kararlılık iyileştirmeleri yapıldı. Büyük kitap paketlerinin işlenmesi daha güvenilir hale getirildi, kapak ve kitap içeriklerinin yerel önbelleğe alınması güçlendirildi, kitap açılışlarında yaşanabilecek bekleme ve zaman aşımı sorunları azaltıldı. Mobil ekranda okuma akışı daha temiz tutulurken, iPad ve geniş ekranlarda metin boyutu ve düzen dengesi iyileştirildi. Kredi satın alma ekranı ve genel görsel dil de daha okunur, daha modern ve uygulamanın yeni kitap stüdyosu hissiyle daha uyumlu hale getirildi.\n\nBu sürüm ayrıca kullanıcı güvenini koruyan açıklıkları sürdürür. Portre destekli üretim akışında yüklenen görselin amacı, ilgili kitabın ana karakterini tutarlı biçimde resmetmeye yardımcı olmaktır. Üretilen kitap görselleri ve kitap çıktıları saklanabilir, ancak portre referansının kalıcı profil görseli, reklam varlığı veya ayrı bir medya arşivi olarak kullanılmaması ilkesi korunur.\n\nGenel olarak 1.0.4; portre destekli kişiselleştirme, daha kaliteli ve heyecan verici kitap üretimi, daha güçlü kapak ve bölüm görseli bütünlüğü, daha güvenilir kitap açılışı ve daha tutarlı okuma deneyimine odaklanan bir geliştirme sürümüdür.`
};

Object.assign(TURKISH_SOURCE, {
  promotionalText: (await fs.readFile(path.join(FASTLANE_METADATA_DIR, 'tr', 'promotional_text.txt'), 'utf8')).trim(),
  keywords: (await fs.readFile(path.join(FASTLANE_METADATA_DIR, 'tr', 'keywords.txt'), 'utf8')).trim(),
  description: (await fs.readFile(path.join(FASTLANE_METADATA_DIR, 'tr', 'description.txt'), 'utf8')).trim(),
  releaseNotes: (await fs.readFile(path.join(FASTLANE_METADATA_DIR, 'tr', 'release_notes.txt'), 'utf8')).trim()
});

function paragraphCount(input) {
  return String(input || '').trim().split(/\n\s*\n/).filter(Boolean).length;
}

const SOURCE_DESCRIPTION_PARAGRAPHS = paragraphCount(TURKISH_SOURCE.description);
const SOURCE_RELEASE_NOTES_PARAGRAPHS = paragraphCount(TURKISH_SOURCE.releaseNotes);

const LOCALES = [
  { code: 'ar-SA', language: 'Arabic (Saudi Arabia)', script: /[\u0600-\u06FF]/ },
  { code: 'da', language: 'Danish', script: /[A-Za-zÆØÅæøå]/ },
  { code: 'de-DE', language: 'German (Germany)', script: /[A-Za-zÄÖÜäöüß]/ },
  { code: 'el', language: 'Greek', script: /[\u0370-\u03FF]/ },
  { code: 'en-GB', language: 'English (United Kingdom)', script: /[A-Za-z]/ },
  { code: 'en-US', language: 'English (United States)', script: /[A-Za-z]/ },
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
  { code: 'ru', language: 'Russian', script: /[\u0400-\u04FF]/ },
  { code: 'sv', language: 'Swedish', script: /[A-Za-zÅÄÖåäö]/ },
  { code: 'th', language: 'Thai', script: /[\u0E00-\u0E7F]/ },
  { code: 'tr', language: 'Turkish', script: /[çğıöşüÇĞİÖŞÜ]/ },
];

const MANUAL_OVERRIDES = {};

const PROMOTIONAL_TEXT_FILLERS = {
  'ar-SA': ' الآن.',
  da: ' i dag.',
  'de-DE': ' heute.',
  el: ' σήμερα.',
  'en-US': ' today.',
  'es-ES': ' hoy.',
  fi: ' tänään.',
  'fr-FR': ' dès aujourd’hui.',
  hi: ' आज.',
  id: ' hari ini.',
  it: ' oggi.',
  ja: '物語づくりから読書と保存まで、一つの流れで支えます。',
  ko: ' 지금.',
  'nl-NL': ' vandaag.',
  no: ' i dag.',
  pl: ' dziś.',
  'pt-BR': ' hoje.',
  ru: ' сегодня.',
  sv: ' idag.',
  th: ' วันนี้',
  tr: ' bugün.'
};

const KEYWORD_PAD_SUFFIX = {
  'ar-SA': 'ة',
  da: 's',
  'de-DE': 'e',
  el: 'ς',
  'en-US': 's',
  'es-ES': 's',
  fi: 't',
  'fr-FR': 's',
  hi: 'ं',
  id: 's',
  it: 'i',
  ja: '本',
  ko: '책',
  'nl-NL': 's',
  no: 'r',
  pl: 'i',
  'pt-BR': 's',
  ru: 'ы',
  sv: 'r',
  th: 'ๆ',
  tr: 'ı'
};

const RELEASE_NOTE_APPENDICES = {
  'ar-SA': 'تركز هذه المراجعة كذلك على جعل كل وصف داخل المتجر مطابقا لما يراه المستخدم داخل التطبيق: ترتيب الكتب، فلاتر النوع، توضيح الخصوصية، زر الدعم، وتجهيز صور iPhone كلها تعكس نفس تجربة Fortale الحالية بدون إضافة وعود أو ميزات غير موجودة.',
  hi: 'यह अपडेट स्टोर में दिखने वाले विवरण और ऐप के भीतर दिखने वाले वास्तविक अनुभव को भी एक जैसा बनाता है: पुस्तक क्रम, प्रकार फ़िल्टर, गोपनीयता स्पष्टीकरण, सहायता ईमेल और iPhone स्क्रीनशॉट सभी Fortale के मौजूदा प्रवाह को ही दर्शाते हैं।',
  ja: 'この更新では、ストアで表示される説明とアプリ内の実際の体験が一致することも重視しています。ブックの並び順、種類フィルター、プライバシー説明、サポートメール、iPhone用スクリーンショットまで、現在のFortaleの動作に沿って整理されています。',
  ko: '이번 업데이트는 스토어에 표시되는 설명과 앱 안에서 실제로 보이는 경험을 맞추는 데도 초점을 둡니다. 책 정렬, 유형 필터, 개인정보 설명, 지원 메일, iPhone 스크린샷이 현재 Fortale 흐름과 일치하도록 정리되었습니다.',
  th: 'การอัปเดตนี้ยังเน้นให้คำอธิบายในร้านค้าและประสบการณ์จริงในแอปตรงกันมากขึ้น ทั้งการเรียงหนังสือ ตัวกรองประเภท คำอธิบายความเป็นส่วนตัว อีเมลสนับสนุน และภาพหน้าจอ iPhone ล้วนสะท้อนการทำงานปัจจุบันของ Fortale'
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

function padKeywordsToMin(input, localeCode) {
  return normalizeKeywords(input);
}

function padPromotionalTextToMin(input, localeCode) {
  return String(input || '').trim();
}

function trimAtSentenceEnd(input, maxLength, minLength) {
  let text = String(input || '').trim();
  if (text.length <= maxLength) return text;
  const trimmed = text.slice(0, maxLength);
  const sentenceEnd = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('。'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('؟'),
    trimmed.lastIndexOf('।')
  );
  if (sentenceEnd >= minLength) {
    return trimmed.slice(0, sentenceEnd + 1).trim();
  }
  return trimmed.trim();
}

function fitDescription(input) {
  return String(input || '').trim();
}

function padReleaseNotesToMin(input, localeCode) {
  return String(input || '').trim();
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
  if (start === -1) {
    throw new Error('JSON block not found in Gemini response.');
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < candidate.length; index += 1) {
    const char = candidate[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return JSON.parse(candidate.slice(start, index + 1));
    }
  }
  throw new Error('JSON block not closed in Gemini response.');
}

function validateLocaleContent(locale, data) {
  const errors = [];
  const promotionalText = String(data.promotionalText || '').trim();
  const keywords = normalizeKeywords(data.keywords);
  const description = String(data.description || '').trim();
  const releaseNotes = String(data.releaseNotes || '').trim();

  if (promotionalText.length < MIN_PROMO || promotionalText.length > MAX_PROMO) {
    errors.push(`promotionalText length ${promotionalText.length}`);
  }
  if (keywords.length < MIN_KEYWORDS || keywords.length > MAX_KEYWORDS) {
    errors.push(`keywords length ${keywords.length}`);
  }
  if (description.length < MIN_DESCRIPTION || description.length > MAX_DESCRIPTION) {
    errors.push(`description length ${description.length}`);
  }
  if (description.includes('1.0.5') || description.includes('1.0.4')) {
    errors.push('description must not contain a release version');
  }
  if (paragraphCount(description) !== SOURCE_DESCRIPTION_PARAGRAPHS) {
    errors.push(`description paragraphs ${paragraphCount(description)} expected ${SOURCE_DESCRIPTION_PARAGRAPHS}`);
  }
  if (!releaseNotes) {
    errors.push('releaseNotes empty');
  }
  if (releaseNotes.length < MIN_RELEASE_NOTES || releaseNotes.length > MAX_RELEASE_NOTES) {
    errors.push(`releaseNotes length ${releaseNotes.length}`);
  }
  if (!releaseNotes.includes('1.0.5') || releaseNotes.includes('1.0.4')) {
    errors.push('releaseNotes version mismatch');
  }
  if (paragraphCount(releaseNotes) !== SOURCE_RELEASE_NOTES_PARAGRAPHS) {
    errors.push(`releaseNotes paragraphs ${paragraphCount(releaseNotes)} expected ${SOURCE_RELEASE_NOTES_PARAGRAPHS}`);
  }
  if (locale.code !== 'tr' && locale.script && !locale.script.test(`${promotionalText} ${keywords} ${description} ${releaseNotes}`)) {
    errors.push('script check failed');
  }
  return errors;
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://f-study-53ef9.web.app'
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 8192,
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

function singleFieldIsValid(field, value) {
  const text = String(value || '').trim();
  if (field === 'promotionalText') return text.length >= MIN_PROMO && text.length <= MAX_PROMO;
  if (field === 'keywords') {
    const normalized = normalizeKeywords(text);
    return normalized.length >= MIN_KEYWORDS && normalized.length <= MAX_KEYWORDS && !/,\s/.test(text);
  }
  if (field === 'description') {
    return text.length >= MIN_DESCRIPTION
      && text.length <= MAX_DESCRIPTION
      && paragraphCount(text) === SOURCE_DESCRIPTION_PARAGRAPHS;
  }
  if (field === 'releaseNotes') {
    return text.length >= MIN_RELEASE_NOTES
      && text.length <= MAX_RELEASE_NOTES
      && paragraphCount(text) === SOURCE_RELEASE_NOTES_PARAGRAPHS;
  }
  return false;
}

async function repairSingleField(apiKey, locale, field, initialValue) {
  const specs = {
    promotionalText: `${MIN_PROMO}-${MAX_PROMO} characters, one complete sentence`,
    keywords: `${MIN_KEYWORDS}-${MAX_KEYWORDS} characters, comma-separated with no spaces after commas`,
    description: `${MIN_DESCRIPTION}-${MAX_DESCRIPTION} characters and exactly ${SOURCE_DESCRIPTION_PARAGRAPHS} paragraphs separated by blank lines`,
    releaseNotes: `${MIN_RELEASE_NOTES}-${MAX_RELEASE_NOTES} characters and exactly ${SOURCE_RELEASE_NOTES_PARAGRAPHS} paragraphs separated by blank lines`
  };
  let candidate = String(initialValue || '').trim();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const isParagraphField = field === 'description' || field === 'releaseNotes';
    const expectedParagraphs = field === 'description'
      ? SOURCE_DESCRIPTION_PARAGRAPHS
      : SOURCE_RELEASE_NOTES_PARAGRAPHS;
    const candidateParagraphs = isParagraphField
      ? candidate.split(/\n\s*\n/).filter(Boolean)
      : [];
    const targetTotal = field === 'description' ? 3800 : 3300;
    const separatorCharacters = Math.max(0, expectedParagraphs - 1) * 2;
    const availableCharacters = targetTotal - separatorCharacters;
    const currentCharacters = candidateParagraphs.reduce((total, paragraph) => total + paragraph.length, 0) || 1;
    const paragraphBudgets = candidateParagraphs.map((paragraph) => Math.max(
      60,
      Math.floor((paragraph.length / currentCharacters) * availableCharacters)
    ));
    const versionRule = field === 'description'
      ? 'Do not mention any release version.'
      : field === 'releaseNotes'
        ? 'Keep version 1.0.5 unchanged and never use 1.0.4.'
        : 'Do not add a release version.';
    const prompt = isParagraphField && candidateParagraphs.length === expectedParagraphs
      ? `You are a native ${locale.language} App Store copy editor. Concisely edit the ${field} paragraphs below. Return ONLY valid JSON as {"paragraphs":["...", "..."]}.\n\nReturn exactly ${expectedParagraphs} paragraphs in the same order. The maximum character count for each corresponding paragraph is: ${JSON.stringify(paragraphBudgets)}. Apple counts actual characters including spaces. Each paragraph must stay within its own maximum and end with a complete sentence. Preserve every distinct fact and qualification in that paragraph and keep Fortale unchanged. ${versionRule} Remove only redundant wording. Do not merge paragraphs, cut endings, add features, add filler, use bullets, explain your work, or mention a translation API.\n\nCurrent paragraphs JSON:\n${JSON.stringify(candidateParagraphs, null, 2)}`
      : `You are a native ${locale.language} App Store copy editor. Edit only the ${field} field below and return ONLY valid JSON as {"text":"..."}.\n\nRequired result: ${specs[field]}. Apple counts actual characters including spaces. Keep Fortale unchanged. ${versionRule} Preserve the complete meaning, every distinct product detail, paragraph order, and native tone. Tighten wording across the entire field; do not cut the ending, omit a paragraph, add a feature, add filler, use bullets, or explain your work. Every paragraph must end with a complete sentence. Never use or mention a translation API.\n\nCurrent ${field} (${candidate.length} characters):\n${candidate}`;
    const payload = await callGemini(apiKey, prompt);
    const parsed = extractJson(extractTextFromGeminiResponse(payload));
    const repaired = isParagraphField && Array.isArray(parsed.paragraphs) && parsed.paragraphs.length === expectedParagraphs
      ? parsed.paragraphs.map((paragraph) => String(paragraph || '').trim()).join('\n\n')
      : field === 'keywords'
        ? normalizeKeywords(parsed.text)
        : String(parsed.text || '').trim();
    if (singleFieldIsValid(field, repaired)) return repaired;
    if (repaired) candidate = repaired;
  }
  throw new Error(`${locale.code} ${field} could not be repaired; final length ${candidate.length}`);
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
      description: TURKISH_SOURCE.description,
      releaseNotes: TURKISH_SOURCE.releaseNotes
    };
  }

  let previousErrors = [];
  let previousDraft = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const translationPrompt = `You are preparing Apple App Store Connect metadata for the app Fortale. Translate and adapt the Turkish source into ${locale.language}. Return ONLY valid JSON with keys promotionalText, keywords, description, releaseNotes.\n\nHard constraints:\n1) Keep the brand name exactly as Fortale.\n2) Translate faithfully. Preserve every product claim, feature, limitation, qualification, and tone from the Turkish source. Do not add, omit, merge, or invent functionality.\n3) promotionalText must be natural ${locale.language}, ${MIN_PROMO}-${TARGET_MAX_PROMO} actual characters, and end as a complete sentence. The Apple hard maximum is ${MAX_PROMO}.\n4) keywords must be comma-separated with no spaces after commas, ${MIN_KEYWORDS}-${TARGET_MAX_KEYWORDS} actual characters. The Apple hard maximum is ${MAX_KEYWORDS}. Use concise, relevant search terms only; do not repeat terms or add padding.\n5) description must be natural ${locale.language}, ${MIN_DESCRIPTION}-${TARGET_MAX_DESCRIPTION} actual characters. The Apple hard maximum is ${MAX_DESCRIPTION}. Preserve every source paragraph and use as much of the available space as natural translation allows.\n6) releaseNotes must be natural ${locale.language}, ${MIN_RELEASE_NOTES}-${TARGET_MAX_RELEASE_NOTES} actual characters. The Apple hard maximum is ${MAX_RELEASE_NOTES}. Preserve every source paragraph, describe only the 1.0.5 changes in the Turkish source, and use as much of the available space as natural translation allows.\n7) Every description and releaseNotes paragraph must end with a complete sentence. Never truncate or drop the final paragraph. If a draft is too long, compress wording throughout the whole field while retaining all source details.\n8) For compact scripts such as Japanese, Korean, Hindi, Arabic or Thai, express the complete source details naturally; do not add claims or generic filler solely to increase character count.\n9) Use native ${locale.language} wording and script naturally.\n10) Do not mention subscriptions, pricing, discounts, ratings, support, screenshots, or anything not in source text.\n11) Do not add emojis, quotation marks, bullets, numbering, markdown, notes to the reader, or explanations.\n12) Never use a translation API or machine-translation brand in the output.\n\nTurkish source JSON:\n${JSON.stringify(TURKISH_SOURCE, null, 2)}`;
    const repairPrompt = `You are a native ${locale.language} App Store copy editor. Return ONLY valid JSON with keys promotionalText, keywords, description, releaseNotes. Repair the existing candidate below instead of translating again.\n\nFailed constraints: ${previousErrors.join(' | ')}.\n\nSafe target limits:\n- promotionalText: ${MIN_PROMO}-${TARGET_MAX_PROMO} actual characters and a complete sentence.\n- keywords: ${MIN_KEYWORDS}-${TARGET_MAX_KEYWORDS} actual characters, comma-separated, no spaces after commas.\n- description: ${MIN_DESCRIPTION}-${TARGET_MAX_DESCRIPTION} actual characters.\n- releaseNotes: ${MIN_RELEASE_NOTES}-${TARGET_MAX_RELEASE_NOTES} actual characters.\n\nKeep the candidate's meaning, product claims, native wording, paragraph order, and 1.0.5 version unchanged. Preserve every paragraph and all distinct source details. Tighten wording across the whole field and remove only verbal redundancy; never cut the ending. For fields below the minimum, elaborate only facts already present. Every paragraph must end with a complete sentence. Do not add features, filler, emojis, bullets, markdown, explanations, translation brands, or new claims.\n\nExisting candidate JSON:\n${JSON.stringify(previousDraft, null, 2)}`;
    const structuralRule = `The description must contain exactly ${SOURCE_DESCRIPTION_PARAGRAPHS} paragraphs and releaseNotes exactly ${SOURCE_RELEASE_NOTES_PARAGRAPHS} paragraphs, separated by blank lines. Each translated paragraph must correspond to the source paragraph at the same position. Do not merge, remove, reorder, or add paragraphs. The description must not mention a version number. releaseNotes must include 1.0.5 and must never include 1.0.4.`;
    const structuredTranslationPrompt = `${translationPrompt}\n\n${structuralRule}`;
    const structuredRepairPrompt = `${repairPrompt}\n\n${structuralRule}\n\nUse the Turkish source below to restore any detail missing from the candidate while staying within the safe target limits:\n${JSON.stringify(TURKISH_SOURCE, null, 2)}`;
    const prompt = previousDraft ? structuredRepairPrompt : structuredTranslationPrompt;

    const payload = await callGemini(apiKey, prompt);
    const parsed = extractJson(extractTextFromGeminiResponse(payload));
    const draft = {
      promotionalText: padPromotionalTextToMin(parsed.promotionalText, locale.code),
      keywords: padKeywordsToMin(parsed.keywords, locale.code),
      description: fitDescription(parsed.description),
      releaseNotes: padReleaseNotesToMin(parsed.releaseNotes, locale.code)
    };
    const errors = validateLocaleContent(locale, draft);
    if (errors.length === 0) return draft;
    previousErrors = errors;
    previousDraft = draft;
  }

  if (previousDraft) {
    const repairedDraft = { ...previousDraft };
    const fieldsToRepair = new Set();
    for (const error of previousErrors) {
      if (error.startsWith('promotionalText')) fieldsToRepair.add('promotionalText');
      if (error.startsWith('keywords')) fieldsToRepair.add('keywords');
      if (error.startsWith('description')) fieldsToRepair.add('description');
      if (error.startsWith('releaseNotes')) fieldsToRepair.add('releaseNotes');
      if (error === 'description must not contain a release version') fieldsToRepair.add('description');
      if (error === 'releaseNotes version mismatch') fieldsToRepair.add('releaseNotes');
      if (error === 'script check failed') {
        fieldsToRepair.add('promotionalText');
        fieldsToRepair.add('keywords');
        fieldsToRepair.add('description');
        fieldsToRepair.add('releaseNotes');
      }
    }
    for (const field of fieldsToRepair) {
      repairedDraft[field] = await repairSingleField(apiKey, locale, field, repairedDraft[field]);
    }
    const repairedErrors = validateLocaleContent(locale, repairedDraft);
    if (repairedErrors.length === 0) return repairedDraft;
    throw new Error(`${locale.code} targeted repair failed: ${repairedErrors.join(' | ')}`);
  }

  throw new Error(`${locale.code} could not be validated after ${MAX_ATTEMPTS} attempts: ${previousErrors.join(' | ')}`);
}

async function writeLocaleMetadata(localeCode, data) {
  const dir = path.join(FASTLANE_METADATA_DIR, localeCode);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'promotional_text.txt'), `${String(data.promotionalText).trim()}\n`, 'utf8');
  await fs.writeFile(path.join(dir, 'keywords.txt'), `${normalizeKeywords(data.keywords)}\n`, 'utf8');
  await fs.writeFile(path.join(dir, 'description.txt'), `${String(data.description).trim()}\n`, 'utf8');
  await fs.writeFile(path.join(dir, 'release_notes.txt'), `${String(data.releaseNotes).trim()}\n`, 'utf8');
}

async function main() {
  await fs.mkdir(FASTLANE_METADATA_DIR, { recursive: true });
  const expectedLocales = new Set(LOCALES.map((locale) => locale.code));
  for (const entry of await fs.readdir(FASTLANE_METADATA_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !expectedLocales.has(entry.name)) {
      await fs.rm(path.join(FASTLANE_METADATA_DIR, entry.name), { recursive: true, force: true });
    }
  }
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
      descriptionLength: String(data.description).trim().length,
      releaseNotesLength: String(data.releaseNotes).trim().length
    };
    console.log(`prepared ${locale.code} promo=${summary[locale.code].promotionalTextLength} keywords=${summary[locale.code].keywordsLength}`);
  }

  for (const locale of LOCALES) {
    const dir = path.join(FASTLANE_METADATA_DIR, locale.code);
    const [promotionalText, keywords, description, releaseNotes] = await Promise.all([
      fs.readFile(path.join(dir, 'promotional_text.txt'), 'utf8'),
      fs.readFile(path.join(dir, 'keywords.txt'), 'utf8'),
      fs.readFile(path.join(dir, 'description.txt'), 'utf8'),
      fs.readFile(path.join(dir, 'release_notes.txt'), 'utf8')
    ]);
    summary[locale.code] = {
      promotionalTextLength: promotionalText.trim().length,
      keywordsLength: normalizeKeywords(keywords).length,
      descriptionLength: description.trim().length,
      releaseNotesLength: releaseNotes.trim().length
    };
  }

  await fs.writeFile(path.join(FASTLANE_METADATA_DIR, '_summary.json'), `${JSON.stringify({ version: VERSION, model: MODEL, summary }, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
