import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORT_PATH = path.resolve(ROOT, process.argv.find((argument) => argument.startsWith('--report='))?.slice('--report='.length) || '/tmp/fortale-i18n-missing.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'strictUiTranslations.generated.ts');
const CHECKPOINT_PATH = '/tmp/fortale-strict-ui-translations.checkpoint.json';
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return null;
    const index = trimmed.indexOf('=');
    return [trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
  }).filter(Boolean));
}

const ROOT_ENV = readEnvFile(path.join(ROOT, '.env'));
const MODEL = process.env.TRANSLATE_MODEL || 'gemini-3.1-flash-lite';
const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || ROOT_ENV.GOOGLE_CLOUD_PROJECT || 'f-study-53ef9';
const VERTEX_LOCATION = process.env.TRANSLATE_LOCATION || 'global';
const LANGUAGE_NAMES = {
  ar: 'Arabic', da: 'Danish', de: 'German', el: 'Greek', en: 'English', es: 'Spanish',
  fi: 'Finnish', fr: 'French', hi: 'Hindi', id: 'Indonesian', it: 'Italian', ja: 'Japanese',
  ko: 'Korean', nl: 'Dutch', no: 'Norwegian Bokmål', pl: 'Polish', 'pt-BR': 'Brazilian Portuguese',
  sv: 'Swedish', th: 'Thai'
};

function resolveVertexAccessToken() {
  return execFileSync('gcloud', ['auth', 'print-access-token'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  }).trim();
}

function chunkEntries(entries, maxCharacters = 24000, maxItems = 90) {
  const chunks = [];
  let current = [];
  let characters = 0;
  for (const entry of entries) {
    const size = entry.key.length + 40;
    if (current.length > 0 && (current.length >= maxItems || characters + size > maxCharacters)) {
      chunks.push(current);
      current = [];
      characters = 0;
    }
    current.push(entry);
    characters += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function translateBatch(accessToken, language, batch, attempt = 1) {
  const items = batch.map((entry, index) => ({ id: `k${index}`, text: entry.key }));
  const prompt = [
    `Translate every item from Turkish into ${LANGUAGE_NAMES[language]}.`,
    'These are production UI strings and legal policy passages for the Fortale app.',
    'Return ONLY one JSON object mapping each supplied id to its translated text.',
    'Preserve line breaks, bullet characters, placeholders such as {{var0}}, numbers, URLs, email addresses, and the brand name Fortale.',
    'Use natural, concise product language for UI labels. Translate legal passages completely and accurately.',
    'Do not omit, summarize, merge, explain, or leave Turkish text in the output.',
    JSON.stringify(items)
  ].join('\n');

  const host = VERTEX_LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${VERTEX_LOCATION}-aiplatform.googleapis.com`;
  let response;
  try {
    response = await fetch(`https://${host}/v1/projects/${encodeURIComponent(VERTEX_PROJECT)}/locations/${encodeURIComponent(VERTEX_LOCATION)}/publishers/google/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 65536,
          thinkingConfig: { thinkingLevel: 'LOW' }
        }
      })
    });
  } catch (error) {
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      return translateBatch(accessToken, language, batch, attempt + 1);
    }
    throw error;
  }
  if (!response.ok) {
    const details = await response.text();
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      return translateBatch(accessToken, language, batch, attempt + 1);
    }
    throw new Error(`${language} translation failed (${response.status}): ${details.slice(0, 500)}`);
  }
  const payload = await response.json();
  const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!raw) throw new Error(`${language} translation returned empty content.`);
  let parsed;
  try {
    parsed = JSON.parse(extractFirstJsonObject(raw));
  } catch (error) {
    if (attempt < 4) return translateBatch(accessToken, language, batch, attempt + 1);
    throw error;
  }
  const translated = {};
  for (let index = 0; index < batch.length; index += 1) {
    const value = String(parsed[`k${index}`] || '').trim();
    if (!value) throw new Error(`${language} translation omitted k${index}.`);
    translated[batch[index].key] = value;
  }
  return translated;
}

function extractFirstJsonObject(raw) {
  const start = raw.indexOf('{');
  if (start < 0) return raw;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const character = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return raw.slice(start);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const grouped = new Map();
for (const finding of report.findings || []) {
  const entries = grouped.get(finding.language) || [];
  entries.push(finding);
  grouped.set(finding.language, entries);
}

const accessToken = resolveVertexAccessToken();
if (!accessToken) throw new Error('Vertex AI access token could not be resolved.');
const translations = fs.existsSync(CHECKPOINT_PATH)
  ? JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'))
  : {};
for (const language of Object.keys(LANGUAGE_NAMES)) {
  translations[language] ||= {};
  const entries = (grouped.get(language) || []).filter((entry) => !translations[language][entry.key]);
  const chunks = chunkEntries(entries);
  console.log(`${language}: ${entries.length} entries in ${chunks.length} batches`);
  for (let index = 0; index < chunks.length; index += 1) {
    const batchTranslations = await translateBatch(accessToken, language, chunks[index]);
    Object.assign(translations[language], batchTranslations);
    fs.writeFileSync(CHECKPOINT_PATH, `${JSON.stringify(translations)}\n`, 'utf8');
    console.log(`  batch ${index + 1}/${chunks.length} complete`);
  }
}

const file = [
  "import type { AppLanguageCode } from './appLanguages';",
  '',
  'export const STRICT_UI_TRANSLATIONS: Partial<Record<AppLanguageCode, Record<string, string>>> = ',
  `${JSON.stringify(translations, null, 2)};`,
  ''
].join('\n');
fs.writeFileSync(OUTPUT_PATH, file, 'utf8');
console.log(`wrote ${OUTPUT_PATH}`);
