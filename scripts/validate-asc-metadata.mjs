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
const MIN_KEYWORDS = 97;

async function main() {
  const entries = await fs.readdir(METADATA_DIR, { withFileTypes: true });
  const locales = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (locales.length === 0) {
    throw new Error('No metadata locales found.');
  }

  for (const locale of locales) {
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
    }
  }

  console.log(`asc-metadata-ok locales=${locales.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
