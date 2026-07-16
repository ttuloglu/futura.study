#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const FASTLANE_METADATA_DIR = path.join(ROOT, 'fastlane', 'metadata');
const MODEL = 'gemini-3.1-flash-lite';
const VERSION = '1.0.4';
const MAX_PROMO = 170;
const MIN_PROMO = 165;
const MAX_KEYWORDS = 100;
const MIN_KEYWORDS = 99;
const MAX_RELEASE_NOTES = 3500;
const MIN_RELEASE_NOTES = 2500;
const MAX_ATTEMPTS = 4;
const ONLY_ARG = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY_LOCALES = ONLY_ARG
  ? new Set(ONLY_ARG.replace('--only=', '').split(',').map((value) => value.trim()).filter(Boolean))
  : null;

const TURKISH_SOURCE = {
  promotionalText: 'Portre destekli karakterlerle masal, hikaye ve roman üret; daha kaliteli anlatım, güçlü kapak ve bölüm görselleriyle fikrini heyecan verici kitaba dönüştür. Şimdi dene.',
  keywords: 'masal,hikaye,öykü,roman,portre,karakter,ai kitap,kitap oluştur,kapak,görsel,podcast,epub,pdf,kitabı',
  releaseNotes: `Fortale 1.0.4, kişisel ve heyecan verici kitap üretimini daha güçlü hale getirir. Bu sürümün odağında, kullanıcının hayalindeki karakteri daha tanıdık, daha tutarlı ve daha etkileyici bir anlatıya dönüştüren portre destekli üretim deneyimi var. İsteğe bağlı portre ekleme akışıyla ana karakterinizi görsel olarak daha kararlı biçimde kitaba dahil edebilir; masal, hikaye ve roman üretirken karakterin kapakta, bölüm görsellerinde ve sahne atmosferinde daha bütünlüklü görünmesine yardımcı olabilirsiniz. Portre, kitabın ana karakterini resmetmek için kullanılan yaratıcı bir referanstır; amaç, her bölümde daha tanınabilir ve daha kişisel bir kitap hissi oluşturmaktır.\n\nKitap üretim kalitesi bu sürümde belirgin şekilde iyileştirildi. Seçilen tür, alt tür, yaş grubu, anlatı tonu ve yaratıcı yönlendirmeler artık metne daha tutarlı yansır. Masallarda daha sıcak, merak uyandıran ve çocuklara uygun bir akış; hikayelerde daha net sahne geçişleri, daha güçlü karakter motivasyonu ve daha canlı atmosfer; romanlarda ise daha uzun soluklu olay örgüsü, daha dengeli bölüm yapısı ve daha sürükleyici gerilim hedeflendi. Böylece Fortale, kısa bir fikirden yalnızca metin üretmek yerine, okuması keyifli ve heyecanı daha yüksek bir kitap deneyimi oluşturmaya odaklanır.\n\nGörsel bütünlük de güçlendirildi. Kapak görseli, bölüm görselleri ve karakter anlatımı arasındaki bağ daha dikkatli kurulacak şekilde üretim akışı düzenlendi. Özellikle portre destekli kitaplarda karakterin görünüşü, hikaye dünyası ve sahne tonu arasında daha doğal bir uyum yakalanması amaçlandı. Kullanıcıların masal, hikaye ve roman fikirleri; kapak, bölüm görselleri, anlatı ritmi ve dışa aktarılabilir kitap çıktısıyla daha yayınlanmaya hazır bir forma yaklaşır.\n\nÜretim ve okuma deneyiminde de kararlılık iyileştirmeleri yapıldı. Büyük kitap paketlerinin işlenmesi daha güvenilir hale getirildi, kapak ve kitap içeriklerinin yerel önbelleğe alınması güçlendirildi, kitap açılışlarında yaşanabilecek bekleme ve zaman aşımı sorunları azaltıldı. Mobil ekranda okuma akışı daha temiz tutulurken, iPad ve geniş ekranlarda metin boyutu ve düzen dengesi iyileştirildi. Kredi satın alma ekranı ve genel görsel dil de daha okunur, daha modern ve uygulamanın yeni kitap stüdyosu hissiyle daha uyumlu hale getirildi.\n\nBu sürüm ayrıca kullanıcı güvenini koruyan açıklıkları sürdürür. Portre destekli üretim akışında yüklenen görselin amacı, ilgili kitabın ana karakterini tutarlı biçimde resmetmeye yardımcı olmaktır. Üretilen kitap görselleri ve kitap çıktıları saklanabilir, ancak portre referansının kalıcı profil görseli, reklam varlığı veya ayrı bir medya arşivi olarak kullanılmaması ilkesi korunur.\n\nGenel olarak 1.0.4; portre destekli kişiselleştirme, daha kaliteli ve heyecan verici kitap üretimi, daha güçlü kapak ve bölüm görseli bütünlüğü, daha güvenilir kitap açılışı ve daha tutarlı okuma deneyimine odaklanan bir geliştirme sürümüdür.`
};

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
  const suffix = KEYWORD_PAD_SUFFIX[localeCode] || 's';
  while (parts.length > 0 && parts.join(',').length < MIN_KEYWORDS) {
    const lastIndex = parts.length - 1;
    const candidateParts = [...parts];
    candidateParts[lastIndex] = `${candidateParts[lastIndex]}${suffix}`;
    if (candidateParts.join(',').length > MAX_KEYWORDS) break;
    parts[lastIndex] = candidateParts[lastIndex];
  }
  return parts.join(',');
}

function padPromotionalTextToMin(input, localeCode) {
  let text = String(input || '').trim();
  if (text.length > MAX_PROMO) {
    text = text.slice(0, MAX_PROMO).trim();
  }
  if (text.length >= MIN_PROMO || text.length > MAX_PROMO) return text;
  const fillers = [
    PROMOTIONAL_TEXT_FILLERS[localeCode],
    '.',
    '!'
  ].filter(Boolean);
  while (text.length < MIN_PROMO) {
    let didAppend = false;
    for (const filler of fillers) {
      if (text.length >= MIN_PROMO) break;
      const candidate = `${text}${filler}`;
      if (candidate.length <= MAX_PROMO) {
        text = candidate;
        didAppend = true;
      }
    }
    if (!didAppend) break;
  }
  return text;
}

function padReleaseNotesToMin(input, localeCode) {
  let text = String(input || '').trim();
  if (text.length > MAX_RELEASE_NOTES) {
    const trimmed = text.slice(0, MAX_RELEASE_NOTES);
    const sentenceEnd = Math.max(
      trimmed.lastIndexOf('.'),
      trimmed.lastIndexOf('。'),
      trimmed.lastIndexOf('!'),
      trimmed.lastIndexOf('؟'),
      trimmed.lastIndexOf('।')
    );
    text = trimmed.slice(0, sentenceEnd > MIN_RELEASE_NOTES ? sentenceEnd + 1 : MAX_RELEASE_NOTES).trim();
  }
  const appendix = RELEASE_NOTE_APPENDICES[localeCode];
  while (appendix && text.length < MIN_RELEASE_NOTES) {
    const candidate = `${text}\n\n${appendix}`;
    if (candidate.length > MAX_RELEASE_NOTES) break;
    text = candidate;
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
  if (releaseNotes.length < MIN_RELEASE_NOTES || releaseNotes.length > MAX_RELEASE_NOTES) {
    errors.push(`releaseNotes length ${releaseNotes.length}`);
  }
  if (locale.code !== 'tr' && locale.script && !locale.script.test(`${promotionalText} ${keywords} ${releaseNotes}`)) {
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
    const prompt = `You are preparing Apple App Store Connect metadata for the app Fortale. Translate and adapt the Turkish source into ${locale.language}. Return ONLY valid JSON with keys promotionalText, keywords, releaseNotes.\n\nHard constraints:\n1) Keep the brand name exactly as Fortale.\n2) promotionalText must be natural ${locale.language}, maximum ${MAX_PROMO} characters, target range ${MIN_PROMO}-${MAX_PROMO}. Never exceed ${MAX_PROMO}. If it lands below ${MIN_PROMO}, make it slightly fuller with one short natural qualifier, not filler.\n3) keywords must be comma-separated with no spaces after commas, maximum ${MAX_KEYWORDS} characters, target range ${MIN_KEYWORDS}-${MAX_KEYWORDS}. Never exceed ${MAX_KEYWORDS}. Use short search nouns, remove articles and filler words.\n4) releaseNotes must be natural ${locale.language}, ${MIN_RELEASE_NOTES}-${MAX_RELEASE_NOTES} actual characters, preserve meaning exactly, and not invent features.\n5) For compact scripts such as Japanese, Korean, Hindi, Arabic or Thai, deliberately elaborate using only details already present in the source until releaseNotes reaches at least ${MIN_RELEASE_NOTES} actual characters.\n6) Use native ${locale.language} wording and script naturally.\n7) Do not mention subscriptions, pricing, discounts, or anything not in source text.\n8) Do not add emojis, quotation marks, bullets, numbering, or markdown.\n9) If a literal translation makes promotionalText or keywords too long, compress naturally while preserving intent. If releaseNotes are too short, expand only with details already present in the source.\n${previousErrors.length ? `10) Previous attempt failed for: ${previousErrors.join(' | ')}. Fix every issue.` : ''}\n${previousDraft ? `11) Your previous candidate was:\n${JSON.stringify(previousDraft, null, 2)}\nRewrite it so every limit passes.` : ''}\n\nTurkish source JSON:\n${JSON.stringify(TURKISH_SOURCE, null, 2)}`;

    const payload = await callGemini(apiKey, prompt);
    const parsed = extractJson(extractTextFromGeminiResponse(payload));
    const draft = {
      promotionalText: padPromotionalTextToMin(parsed.promotionalText, locale.code),
      keywords: padKeywordsToMin(parsed.keywords, locale.code),
      releaseNotes: padReleaseNotesToMin(parsed.releaseNotes, locale.code)
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
