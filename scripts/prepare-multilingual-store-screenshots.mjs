#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const PROJECT_FILE = path.join(ROOT, 'store-screenshot-studio', 'app-store-screenshots.json');
const TRANSLATIONS_FILE = path.join(
  ROOT,
  'store-screenshot-studio',
  'app-store-screenshot-translations.json'
);
const MODEL = 'gemini-3.1-flash-lite';
const MAX_ATTEMPTS = 4;

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
  { code: 'no', language: 'Norwegian Bokmål', script: /[A-Za-zÆØÅæøå]/ },
  { code: 'pl', language: 'Polish', script: /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/ },
  { code: 'pt-BR', language: 'Portuguese (Brazil)', script: /[A-Za-zÁÂÃÀÇÉÊÍÓÔÕÚáâãàçéêíóôõú]/ },
  { code: 'ru', language: 'Russian', script: /[\u0400-\u04FF]/ },
  { code: 'sv', language: 'Swedish', script: /[A-Za-zÅÄÖåäö]/ },
  { code: 'th', language: 'Thai', script: /[\u0E00-\u0E7F]/ },
  { code: 'tr', language: 'Turkish', script: /[çğıöşüÇĞİÖŞÜ]/ }
];

function readGeminiApiKey() {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  const output = execSync('firebase functions:secrets:access GEMINI_API_KEY', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const value = String(output || '').trim();
  if (!value) throw new Error('GEMINI_API_KEY secret resolved empty.');
  return value;
}

function extractText(payload) {
  return (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => String(part?.text || ''))
    .join('')
    .trim();
}

function extractJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('JSON block not found.');
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
    if (depth === 0) return JSON.parse(candidate.slice(start, index + 1));
  }
  throw new Error('JSON block not closed.');
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://f-study-53ef9.web.app'
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

function sourceDeck(project) {
  const result = {};
  for (const device of ['iphone', 'ipad']) {
    result[device] = project.slidesByDevice[device].map((slide, index) => ({
      id: String(index + 1).padStart(2, '0'),
      label: String(slide.label?.tr || '').trim(),
      headline: String(slide.headline?.tr || '').trim()
    }));
  }
  return result;
}

function validateLocale(locale, candidate) {
  const errors = [];
  for (const device of ['iphone', 'ipad']) {
    const slides = candidate?.[device];
    if (!Array.isArray(slides) || slides.length !== 10) {
      errors.push(`${device} must contain exactly 10 slides`);
      continue;
    }
    slides.forEach((slide, index) => {
      const label = String(slide?.label || '').trim();
      const headline = String(slide?.headline || '').trim();
      const lines = headline.split('\n');
      if (!label) errors.push(`${device}.${index + 1} label empty`);
      if (label.length > 34) errors.push(`${device}.${index + 1} label too long (${label.length})`);
      if (!headline) errors.push(`${device}.${index + 1} headline empty`);
      if (lines.length < 2 || lines.length > 3) {
        errors.push(`${device}.${index + 1} headline must use 2-3 lines`);
      }
      if (lines.some((line) => !line.trim() || line.length > 27)) {
        errors.push(`${device}.${index + 1} headline line too long or empty`);
      }
    });
  }
  const allText = ['iphone', 'ipad']
    .flatMap((device) => candidate?.[device] || [])
    .flatMap((slide) => [slide?.label, slide?.headline])
    .join(' ');
  if (locale.code !== 'tr' && locale.script && !locale.script.test(allText)) {
    errors.push('native script check failed');
  }
  if (!allText.includes('20')) errors.push('20-language claim was lost');
  return errors;
}

async function translateLocale(apiKey, locale, source, previous, previousErrors) {
  const repairContext = previous
    ? `\nThe previous candidate failed these checks: ${previousErrors.join(' | ')}. Repair it while preserving its good native wording.\nPrevious candidate:\n${JSON.stringify(previous, null, 2)}`
    : '';
  const prompt = `You are a native ${locale.language} App Store screenshot copywriter for Fortale, an AI app that turns ideas into illustrated fairy tales, stories, and workbooks. Translate and adapt the Turkish screenshot deck below into concise, polished ${locale.language}. Return ONLY valid JSON with exactly two keys, iphone and ipad. Each must be an array of exactly 10 objects containing only label and headline. Keep the slide order unchanged.

Rules:
1. Translate the meaning faithfully. Do not add features, claims, prices, ratings, or calls to action.
2. Keep the brand Fortale unchanged. Keep the number 20 unchanged on the final slide.
3. label is a very short section tag, at most 34 actual characters.
4. headline must contain explicit newline characters and use exactly 2 or 3 short lines. Each line must be at most 27 actual characters, including spaces.
5. Prefer natural advertising language over literal translation, but preserve the specific benefit of every slide.
6. Use native ${locale.language} wording and script. For Arabic, use natural right-to-left Arabic. Do not transliterate non-Latin languages.
7. No markdown, bullets, explanations, quotation marks, emojis, or extra keys.

Turkish source JSON:
${JSON.stringify(source, null, 2)}${repairContext}`;
  return extractJson(extractText(await callGemini(apiKey, prompt)));
}

async function main() {
  const project = JSON.parse(await fs.readFile(PROJECT_FILE, 'utf8'));
  const source = sourceDeck(project);
  const apiKey = readGeminiApiKey();
  let cache = {};
  try {
    cache = JSON.parse(await fs.readFile(TRANSLATIONS_FILE, 'utf8')).translations || {};
  } catch {
    cache = {};
  }
  cache.tr = source;

  for (const locale of LOCALES) {
    if (locale.code === 'tr') continue;
    const cachedErrors = validateLocale(locale, cache[locale.code]);
    if (cachedErrors.length === 0) {
      console.log(`cached ${locale.code}`);
      continue;
    }
    let candidate = null;
    let errors = cachedErrors;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      candidate = await translateLocale(apiKey, locale, source, candidate, errors);
      errors = validateLocale(locale, candidate);
      if (errors.length === 0) break;
      console.log(`repair ${locale.code} attempt=${attempt} errors=${errors.join('; ')}`);
    }
    if (errors.length > 0) {
      throw new Error(`${locale.code} screenshot copy failed validation: ${errors.join(' | ')}`);
    }
    cache[locale.code] = candidate;
    await fs.writeFile(
      TRANSLATIONS_FILE,
      `${JSON.stringify({ model: MODEL, locales: LOCALES.map(({ code }) => code), translations: cache }, null, 2)}\n`,
      'utf8'
    );
    console.log(`prepared ${locale.code}`);
  }

  project.locales = LOCALES.map(({ code }) => code);
  project.locale = 'tr';
  for (const device of ['iphone', 'ipad']) {
    project.slidesByDevice[device].forEach((slide, index) => {
      slide.label = {};
      slide.headline = {};
      for (const locale of LOCALES) {
        slide.label[locale.code] = cache[locale.code][device][index].label.trim();
        slide.headline[locale.code] = cache[locale.code][device][index].headline.trim();
      }
      slide.screenshot = slide.screenshot.replace('{locale}', 'tr');
      if (slide.screenshotSecondary) {
        slide.screenshotSecondary = slide.screenshotSecondary.replace('{locale}', 'tr');
      }
    });
  }

  await fs.writeFile(PROJECT_FILE, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    TRANSLATIONS_FILE,
    `${JSON.stringify({ model: MODEL, locales: LOCALES.map(({ code }) => code), translations: cache }, null, 2)}\n`,
    'utf8'
  );
  console.log(`store-screenshot-locales-ok locales=${LOCALES.length} slides=${LOCALES.length * 20}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
