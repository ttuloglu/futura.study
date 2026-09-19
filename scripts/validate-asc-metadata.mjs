#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const METADATA_DIR = path.join(ROOT, 'fastlane', 'metadata');
const REQUIRED_FILES = ['promotional_text.txt', 'keywords.txt', 'description.txt', 'release_notes.txt'];
const MAX_PROMO = 170;
const MIN_PROMO = 140;
const MAX_KEYWORDS = 100;
const MIN_KEYWORDS = 50;
const MAX_DESCRIPTION = 4000;
const MIN_DESCRIPTION = 1200;
const MAX_RELEASE_NOTES = 3500;
const MIN_RELEASE_NOTES = 1000;
const EXPECTED_DESCRIPTION_PARAGRAPHS = 12;
const EXPECTED_RELEASE_NOTES_PARAGRAPHS = 8;
const SCREENSHOTS_DIR = path.join(ROOT, 'fastlane', 'screenshots');
const EXPECTED_SCREENSHOT_COUNT = 10;
const EXPECTED_IPHONE_WIDTH = 1320;
const EXPECTED_IPHONE_HEIGHT = 2868;
const EXPECTED_IPAD_WIDTH = 2048;
const EXPECTED_IPAD_HEIGHT = 2732;
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

async function imageDimensions(filePath) {
  const buffer = await fs.readFile(filePath);
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5)
        };
      }
      offset += segmentLength + 2;
    }
  }

  throw new Error(`${filePath} is not a supported PNG or JPEG file`);
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
      if (file === 'description.txt' && (text.length < MIN_DESCRIPTION || text.length > MAX_DESCRIPTION)) {
        throw new Error(`${locale} description length ${text.length}`);
      }
      if (file === 'description.txt' && text.split(/\n\s*\n/).filter(Boolean).length !== EXPECTED_DESCRIPTION_PARAGRAPHS) {
        throw new Error(`${locale} description paragraph count ${text.split(/\n\s*\n/).filter(Boolean).length}`);
      }
      if (file === 'description.txt' && (text.includes('1.0.5') || text.includes('1.0.4'))) {
        throw new Error(`${locale} description contains release version`);
      }
      if (file === 'release_notes.txt' && (text.length < MIN_RELEASE_NOTES || text.length > MAX_RELEASE_NOTES)) {
        throw new Error(`${locale} release_notes length ${text.length}`);
      }
      if (file === 'release_notes.txt' && text.split(/\n\s*\n/).filter(Boolean).length !== EXPECTED_RELEASE_NOTES_PARAGRAPHS) {
        throw new Error(`${locale} release_notes paragraph count ${text.split(/\n\s*\n/).filter(Boolean).length}`);
      }
      if (file === 'release_notes.txt' && (!text.includes('1.0.5') || text.includes('1.0.4'))) {
        throw new Error(`${locale} release_notes version mismatch`);
      }
    }

    const screenshotDir = path.join(SCREENSHOTS_DIR, locale);
    const screenshots = (await fs.readdir(screenshotDir))
      .filter((fileName) => /\.(?:png|jpe?g)$/i.test(fileName))
      .sort();
    const iphoneScreenshots = screenshots.filter((fileName) => fileName.includes('iPhone_6_9') || fileName.includes('APP_IPHONE_67'));
    const ipadScreenshots = screenshots.filter((fileName) => fileName.includes('iPad_12_9'));
    if (iphoneScreenshots.length !== EXPECTED_SCREENSHOT_COUNT) {
      throw new Error(`${locale} iPhone screenshots count ${iphoneScreenshots.length}`);
    }
    for (const screenshot of iphoneScreenshots) {
      const screenshotPath = path.join(screenshotDir, screenshot);
      const dimensions = await imageDimensions(screenshotPath);
      if (dimensions.width !== EXPECTED_IPHONE_WIDTH || dimensions.height !== EXPECTED_IPHONE_HEIGHT) {
        throw new Error(`${locale} ${screenshot} dimensions ${dimensions.width}x${dimensions.height}`);
      }
    }
    if (ipadScreenshots.length !== EXPECTED_SCREENSHOT_COUNT) {
      throw new Error(`${locale} iPad screenshots count ${ipadScreenshots.length}`);
    }
    for (const screenshot of ipadScreenshots) {
      const screenshotPath = path.join(screenshotDir, screenshot);
      const dimensions = await imageDimensions(screenshotPath);
      if (dimensions.width !== EXPECTED_IPAD_WIDTH || dimensions.height !== EXPECTED_IPAD_HEIGHT) {
        throw new Error(`${locale} ${screenshot} dimensions ${dimensions.width}x${dimensions.height}`);
      }
    }
  }

  console.log(`asc-metadata-ok locales=${REQUIRED_LOCALES.length} screenshots=${REQUIRED_LOCALES.length * EXPECTED_SCREENSHOT_COUNT * 2}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
