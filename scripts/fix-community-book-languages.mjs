#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const PROJECT_ID = 'f-study-53ef9';
const EXECUTE = process.argv.includes('--execute');
const VERBOSE = process.argv.includes('--verbose');
const INSPECT_ID = process.argv.find((value) => value.startsWith('--inspect='))?.slice('--inspect='.length) || '';
const AUDIT_DESCRIPTIONS = process.argv.includes('--audit-descriptions');
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function accessToken() {
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, entry]) => [key, decodeValue(entry)]));
  return undefined;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function compact(value) {
  return String(value || '').replace(/https?:\/\/\S+/g, ' ').replace(/[#*_>`~|\[\](){}]/g, ' ').replace(/\s+/g, ' ').trim();
}

const WORDS = {
  tr: ['ve', 'bir', 'bu', 'için', 'ile', 'olan', 'olarak', 'ama', 'daha', 'sonra', 'kadar', 'çünkü', 'değil', 'gibi', 'her', 'çok', 'ne', 'nasıl', 'kendi', 'onu', 'şimdi', 'çocuk', 'hikaye'],
  en: ['the', 'and', 'that', 'with', 'for', 'from', 'this', 'was', 'were', 'have', 'has', 'but', 'not', 'into', 'after', 'before', 'when', 'where', 'their', 'they', 'she', 'his', 'her', 'story', 'young', 'little', 'new', 'world', 'find', 'discovers', 'must', 'through', 'between', 'life', 'city', 'friend', 'journey', 'brave', 'while', 'about'],
  es: ['el', 'la', 'los', 'las', 'una', 'que', 'con', 'para', 'por', 'como', 'pero', 'más', 'después', 'cuando', 'donde', 'sus', 'ella', 'historia'],
  fr: ['le', 'la', 'les', 'des', 'une', 'que', 'avec', 'pour', 'dans', 'mais', 'plus', 'après', 'quand', 'où', 'leur', 'elle', 'histoire'],
  de: ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'und', 'mit', 'für', 'von', 'aber', 'nicht', 'nach', 'wenn', 'ihre', 'geschichte'],
  it: ['il', 'lo', 'la', 'gli', 'una', 'che', 'con', 'per', 'nel', 'ma', 'più', 'dopo', 'quando', 'dove', 'sua', 'storia'],
  'pt-BR': ['o', 'a', 'os', 'as', 'uma', 'que', 'com', 'para', 'por', 'como', 'mas', 'mais', 'depois', 'quando', 'onde', 'sua', 'história'],
  nl: ['de', 'het', 'een', 'en', 'met', 'voor', 'van', 'maar', 'niet', 'na', 'als', 'waar', 'hun', 'zij', 'verhaal'],
  da: ['den', 'det', 'en', 'et', 'og', 'med', 'for', 'fra', 'men', 'ikke', 'efter', 'når', 'hvor', 'deres', 'hun', 'historie'],
  no: ['den', 'det', 'en', 'et', 'og', 'med', 'for', 'fra', 'men', 'ikke', 'etter', 'når', 'hvor', 'deres', 'hun', 'historie'],
  sv: ['den', 'det', 'en', 'ett', 'och', 'med', 'för', 'från', 'men', 'inte', 'efter', 'när', 'var', 'deras', 'hon', 'berättelse'],
  fi: ['ja', 'on', 'oli', 'että', 'kun', 'mutta', 'myös', 'sen', 'hänen', 'joka', 'kuin', 'jälkeen', 'missä', 'tarina'],
  pl: ['i', 'w', 'na', 'że', 'z', 'do', 'dla', 'ale', 'nie', 'po', 'kiedy', 'gdzie', 'jego', 'jej', 'historia'],
  id: ['dan', 'yang', 'dengan', 'untuk', 'dari', 'ini', 'itu', 'tetapi', 'tidak', 'setelah', 'ketika', 'tempat', 'mereka', 'dia', 'cerita']
};

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function detectLanguage(value) {
  const raw = compact(value);
  if (!raw) return 'unknown';
  const scriptCounts = {
    ja: countMatches(raw, /[\u3040-\u30ff]/g),
    ko: countMatches(raw, /[\uac00-\ud7af]/g),
    ar: countMatches(raw, /[\u0600-\u06ff]/g),
    th: countMatches(raw, /[\u0e00-\u0e7f]/g),
    el: countMatches(raw, /[\u0370-\u03ff]/g),
    hi: countMatches(raw, /[\u0900-\u097f]/g)
  };
  const strongestScript = Object.entries(scriptCounts).sort((a, b) => b[1] - a[1])[0];
  if (strongestScript[1] >= 20) return strongestScript[0];

  const lower = raw.toLocaleLowerCase('tr-TR');
  const tokens = lower.match(/[\p{L}]+/gu) || [];
  const scores = Object.fromEntries(Object.keys(WORDS).map((language) => [language, 0]));
  for (const token of tokens) {
    for (const [language, words] of Object.entries(WORDS)) {
      if (words.includes(token)) scores[language] += token.length <= 2 ? 0.5 : 1;
    }
  }
  scores.tr += countMatches(lower, /[çğıöşü]/g) * 1.2;
  scores.es += countMatches(lower, /[ñ¿¡]/g) * 2 + countMatches(lower, /[áéíóú]/g) * 0.7;
  scores.fr += countMatches(lower, /[œàâçéèêëîïôûùüÿ]/g) * 0.65;
  scores.de += countMatches(lower, /[äöüß]/g) * 0.9;
  scores['pt-BR'] += countMatches(lower, /[ãõ]/g) * 2 + countMatches(lower, /[áàâêéíóôúç]/g) * 0.45;
  scores.it += countMatches(lower, /[àèéìíîòóùú]/g) * 0.45;
  scores.pl += countMatches(lower, /[ąćęłńóśźż]/g) * 1.8;
  scores.sv += countMatches(lower, /[åäö]/g) * 0.65;
  scores.da += countMatches(lower, /[æøå]/g) * 0.75;
  scores.no += countMatches(lower, /[æøå]/g) * 0.75;
  scores.fi += countMatches(lower, /[äö]/g) * 0.25;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] < 2 || ranked[0][1] < ranked[1][1] * 1.08) return 'unknown';
  return ranked[0][0];
}

function evidenceFor(book) {
  const preview = Array.isArray(book.preview) ? book.preview : [];
  const previewText = preview.map((item) => `${item?.title || ''}\n${item?.content || ''}`).join('\n');
  return `${previewText}\n${previewText}\n${book.description || ''}\n${book.title || ''}`.slice(0, 120_000);
}

async function listCommunityBooks(token) {
  const result = [];
  let pageToken = '';
  do {
    const url = new URL(`${BASE_URL}/communityBooks`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Community books read failed (${response.status}): ${await response.text()}`);
    const payload = await response.json();
    for (const document of payload.documents || []) {
      result.push({ id: document.name.split('/').pop(), data: decodeFields(document.fields) });
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return result;
}

async function updateLanguage(token, id, language) {
  const url = new URL(`${BASE_URL}/communityBooks/${encodeURIComponent(id)}`);
  url.searchParams.append('updateMask.fieldPaths', 'language');
  url.searchParams.append('updateMask.fieldPaths', 'languageRepairedAt');
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      language: { stringValue: language },
      languageRepairedAt: { timestampValue: new Date().toISOString() }
    } })
  });
  if (!response.ok) throw new Error(`Language update failed for ${id} (${response.status}): ${await response.text()}`);
}

async function main() {
  const token = accessToken();
  const books = await listCommunityBooks(token);
  const changes = [];
  const uncertain = [];
  for (const book of books) {
    const evidence = evidenceFor(book.data);
    const detected = detectLanguage(evidence);
    const current = compact(book.data.language) || 'unknown';
    if (AUDIT_DESCRIPTIONS) {
      const description = compact(book.data.description);
      const descriptionWithoutTitle = description.replace(compact(book.data.title), ' ').trim();
      const descriptionLanguage = detectLanguage(descriptionWithoutTitle || description);
      if (description && descriptionLanguage !== 'unknown' && descriptionLanguage !== current) {
        console.log(`[community-description-audit] ${current} <- ${descriptionLanguage} | ${book.data.title} | ${book.id} | ${description.slice(0, 260)}`);
      }
    }
    if (INSPECT_ID === book.id) console.log(`[community-language-fix] evidence ${book.id} kana=${countMatches(evidence, /[\u3040-\u30ff]/g)} hangul=${countMatches(evidence, /[\uac00-\ud7af]/g)} detected=${detected}\n${evidence.slice(0, 4_000)}`);
    if (VERBOSE) console.log(`[community-language-fix] inspect ${current} -> ${detected} | ${book.data.title} | ${book.id}`);
    if (detected === 'unknown') {
      uncertain.push({ id: book.id, title: book.data.title, current });
      continue;
    }
    if (detected === current) continue;
    changes.push({ id: book.id, title: book.data.title, current, detected });
  }
  console.log(`[community-language-fix] mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} books=${books.length} changes=${changes.length} uncertain=${uncertain.length}`);
  for (const change of changes) {
    console.log(`[community-language-fix] ${change.current} -> ${change.detected} | ${change.title} | ${change.id}`);
    if (EXECUTE) await updateLanguage(token, change.id, change.detected);
  }
  for (const item of uncertain) console.warn(`[community-language-fix] uncertain keep=${item.current} | ${item.title} | ${item.id}`);
}

main().catch((error) => {
  console.error('[community-language-fix] fatal:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
