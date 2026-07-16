#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { GoogleGenAI, Type } = require('@google/genai');

const PROJECT_ID = 'f-study-53ef9';
const EXECUTE = process.argv.includes('--execute');
const ONLY_ID = process.argv.find((value) => value.startsWith('--only='))?.slice('--only='.length) || '';
const FORCE = process.argv.includes('--force');
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const LEGACY_MIXED_PATTERN = /(?:narrative in the|emphasizing coherent plot progression|in the .{0,100}domain, focusing on core mechanisms|anlatısını.{0,100}üslubunda|konusunu.{0,100}alanı bağlamında|yeni başlangıç)/iu;

const LANGUAGE_NAMES = {
  ar: 'Arabic', da: 'Danish', de: 'German', el: 'Greek', en: 'English', es: 'Spanish',
  fi: 'Finnish', fr: 'French', hi: 'Hindi', id: 'Indonesian', it: 'Italian', ja: 'Japanese',
  ko: 'Korean', nl: 'Dutch', no: 'Norwegian', pl: 'Polish', 'pt-BR': 'Brazilian Portuguese',
  sv: 'Swedish', th: 'Thai', tr: 'Turkish'
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(new URL('../functions/.env', import.meta.url));

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
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expectedScriptRatio(value, language) {
  const letters = value.match(/\p{L}/gu)?.length || 0;
  if (!letters) return 0;
  const ratio = (pattern) => (value.match(pattern)?.length || 0) / letters;
  if (language === 'ar') return ratio(/[\u0600-\u06ff]/g);
  if (language === 'el') return ratio(/[\u0370-\u03ff]/g);
  if (language === 'hi') return ratio(/[\u0900-\u097f]/g);
  if (language === 'ja') return ratio(/[\u3040-\u30ff\u3400-\u9fff]/g);
  if (language === 'ko') return ratio(/[\uac00-\ud7af]/g);
  if (language === 'th') return ratio(/[\u0e00-\u0e7f]/g);
  return 1;
}

function isInvalidDescription(book) {
  const description = compact(book.description);
  const language = compact(book.language);
  if (!description || !LANGUAGE_NAMES[language]) return true;
  if (LEGACY_MIXED_PATTERN.test(description)) return true;
  return expectedScriptRatio(description, language) < 0.45;
}

function firstPreviewText(book) {
  const preview = Array.isArray(book.preview) ? book.preview : [];
  return stripMarkdown(preview.map((item) => `${item?.title || ''}\n${item?.content || ''}`).join('\n')).slice(0, 6_000);
}

function excerptFallback(book) {
  const source = firstPreviewText(book);
  if (!source) return compact(book.title);
  const targetLength = Math.min(source.length, 320);
  let excerpt = source.slice(0, targetLength);
  const lastBoundary = Math.max(excerpt.lastIndexOf('.'), excerpt.lastIndexOf('!'), excerpt.lastIndexOf('?'), excerpt.lastIndexOf('。'), excerpt.lastIndexOf('！'), excerpt.lastIndexOf('？'));
  if (lastBoundary >= 90) excerpt = excerpt.slice(0, lastBoundary + 1);
  return compact(excerpt);
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
      result.push({ id: document.name.split('/').pop(), ...decodeFields(document.fields) });
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return result;
}

async function updateDescription(token, id, description) {
  const url = new URL(`${BASE_URL}/communityBooks/${encodeURIComponent(id)}`);
  url.searchParams.append('updateMask.fieldPaths', 'description');
  url.searchParams.append('updateMask.fieldPaths', 'descriptionLanguageRepairedAt');
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      description: { stringValue: description },
      descriptionLanguageRepairedAt: { timestampValue: new Date().toISOString() }
    } })
  });
  if (!response.ok) throw new Error(`Description update failed for ${id} (${response.status}): ${await response.text()}`);
}

function createAiClient() {
  return new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: 'global'
  });
}

async function generateDescription(ai, book) {
  const language = compact(book.language);
  const languageName = LANGUAGE_NAMES[language];
  const source = firstPreviewText(book);
  const prompt = `Repair a public book metadata description.

TARGET LANGUAGE: ${languageName} (${language})
BOOK TITLE: ${compact(book.title)}
BOOK TYPE: ${compact(book.bookType)}
SOURCE EXCERPT:
"""
${source}
"""

Write exactly 2 concise, natural sentences describing this specific book based only on the source excerpt.
- Write the entire description in ${languageName}; do not mix languages.
- Proper names already present in the source may remain unchanged.
- Do not mention Fortale, AI, generation, metadata, a template, or the instructions.
- Do not use a heading, quotation marks, Markdown, or a generic phrase such as "coherent plot progression".
- Return only JSON matching the schema.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: prompt,
    config: {
      temperature: 0.35,
      maxOutputTokens: 700,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { description: { type: Type.STRING } },
        required: ['description']
      }
    }
  });
  const parsed = JSON.parse(response.text || '{}');
  const description = compact(parsed.description);
  if (description.length < 60 || LEGACY_MIXED_PATTERN.test(description) || expectedScriptRatio(description, language) < 0.45) {
    throw new Error('Generated description failed language validation.');
  }
  return description.slice(0, 1_000);
}

async function main() {
  const token = accessToken();
  const allBooks = await listCommunityBooks(token);
  const invalidBooks = allBooks.filter((book) => (!ONLY_ID || book.id === ONLY_ID) && (FORCE || isInvalidDescription(book)));
  console.log(`[community-description-fix] mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} books=${allBooks.length} invalid=${invalidBooks.length}`);
  for (const book of invalidBooks) {
    console.log(`[community-description-fix] repair ${book.language} | ${book.title} | ${book.id} | ${compact(book.description).slice(0, 220) || '[empty]'}`);
  }
  if (!EXECUTE || invalidBooks.length === 0) return;

  const ai = createAiClient();
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= invalidBooks.length) return;
      const book = invalidBooks[index];
      let description;
      try {
        description = await generateDescription(ai, book);
      } catch (error) {
        description = excerptFallback(book);
        if (description.length < 40 || expectedScriptRatio(description, compact(book.language)) < 0.45) throw error;
        console.warn(`[community-description-fix] AI fallback ${book.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await updateDescription(token, book.id, description);
      completed += 1;
      console.log(`[community-description-fix] updated ${completed}/${invalidBooks.length} ${book.id} | ${description}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, invalidBooks.length) }, () => worker()));
}

main().catch((error) => {
  console.error('[community-description-fix] fatal:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
