#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const METADATA_DIR = path.join(ROOT, 'fastlane', 'metadata');
const REQUIRED_FILES = ['promotional_text.txt', 'keywords.txt', 'release_notes.txt'];
const MAX_PROMO = 170;
const MIN_PROMO = 165;
const MAX_KEYWORDS = 100;
const MIN_KEYWORDS = 99;
const MAX_RELEASE_NOTES = 3500;
const MIN_RELEASE_NOTES = 2500;
const SCREENSHOTS_DIR = path.join(ROOT, 'fastlane', 'screenshots');
const EXPECTED_SCREENSHOT_COUNT = 8;
const EXPECTED_SCREENSHOT_WIDTH = 1320;
const EXPECTED_SCREENSHOT_HEIGHT = 2868;
const REQUIRED_LOCALES = [
  'ar-SA',
  'da',
  'de-DE',
  'el',
  'en-GB',
  'en-US',
  'es-ES',
  'fi',
  'fr-FR',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'nl-NL',
  'no',
  'pl',
  'pt-BR',
  'ru',
  'sv',
  'th',
  'tr'
];

async function pngDimensions(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(24);
    await handle.read(buffer, 0, buffer.length, 0);
    if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error(`${filePath} is not a PNG file`);
    }
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  } finally {
    await handle.close();
  }
}

async function main() {
  const entries = await fs.readdir(METADATA_DIR, { withFileTypes: true });
  const actualLocales = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const allowedLocales = new Set(REQUIRED_LOCALES);
  const unsupportedLocales = actualLocales.filter((locale) => !allowedLocales.has(locale)).sort();
  if (unsupportedLocales.length > 0) {
    throw new Error(`Unsupported metadata locales present: ${unsupportedLocales.join(', ')}`);
  }

  for (const locale of REQUIRED_LOCALES) {
    for (const file of REQUIRED_FILES) {
      const filePath = path.join(METADATA_DIR, locale, file);
      const raw = await fs.readFile(filePath, 'utf8');
      const text = raw.trim();
      if (!text) {
        throw new Error(`${locale} ${file} is empty`);
      }
      if (file === 'promotional_text.txt' && (text.length < MIN_PROMO || text.length > MAX_PROMO)) {
        throw new Error(`${locale} promotional_text length ${text.length}`);
      }
      if (file === 'keywords.txt' && (text.length < MIN_KEYWORDS || text.length > MAX_KEYWORDS)) {
        throw new Error(`${locale} keywords length ${text.length}`);
      }
      if (file === 'release_notes.txt' && (text.length < MIN_RELEASE_NOTES || text.length > MAX_RELEASE_NOTES)) {
        throw new Error(`${locale} release_notes length ${text.length}`);
      }
    }

    const screenshotDir = path.join(SCREENSHOTS_DIR, locale);
    const screenshots = (await fs.readdir(screenshotDir))
      .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
      .sort();
    const iphoneScreenshots = screenshots.filter((fileName) => fileName.includes('iPhone_6_9') || fileName.includes('APP_IPHONE_67'));
    if (iphoneScreenshots.length !== EXPECTED_SCREENSHOT_COUNT) {
      throw new Error(`${locale} iPhone screenshots count ${iphoneScreenshots.length}`);
    }
    for (const screenshot of iphoneScreenshots) {
      const screenshotPath = path.join(screenshotDir, screenshot);
      const dimensions = await pngDimensions(screenshotPath);
      if (dimensions.width !== EXPECTED_SCREENSHOT_WIDTH || dimensions.height !== EXPECTED_SCREENSHOT_HEIGHT) {
        throw new Error(`${locale} ${screenshot} dimensions ${dimensions.width}x${dimensions.height}`);
      }
    }
  }

  console.log(`asc-metadata-ok locales=${REQUIRED_LOCALES.length} screenshots=${REQUIRED_LOCALES.length * EXPECTED_SCREENSHOT_COUNT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
