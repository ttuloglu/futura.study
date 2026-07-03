#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, 'fastlane', 'screenshots');
const SCREENSHOT_SETS = [
  {
    name: 'iPhone 6.9',
    envKey: 'IPHONE_69_SCREENSHOT_SOURCE_DIR',
    sourceRoot: process.env.IPHONE_69_SCREENSHOT_SOURCE_DIR
      || process.env.IPHONE_SCREENSHOT_SOURCE_DIR
      || '/Users/tuloglu/Desktop/screenshots_iphone-6.9_all-languages (1)',
    outputSuffix: 'iPhone_6_9',
    expectedWidth: 1320,
    expectedHeight: 2868,
    expectedCount: 8
  },
  {
    name: 'iPhone 6.5',
    envKey: 'IPHONE_65_SCREENSHOT_SOURCE_DIR',
    sourceRoot: process.env.IPHONE_65_SCREENSHOT_SOURCE_DIR
      || '/Users/tuloglu/Desktop/screenshots_iphone-6.5_all-languages',
    outputSuffix: 'iPhone_6_5',
    expectedWidth: 1284,
    expectedHeight: 2778,
    expectedCount: 8
  },
  {
    name: 'iPad 12.9',
    envKey: 'IPAD_129_SCREENSHOT_SOURCE_DIR',
    sourceRoot: process.env.IPAD_129_SCREENSHOT_SOURCE_DIR
      || '/Users/tuloglu/Desktop/screenshots_ipad-12.9_all-languages 2',
    outputSuffix: 'iPad_12_9',
    expectedWidth: 2048,
    expectedHeight: 2732,
    expectedCount: 7
  }
];

const LOCALE_SCREENSHOTS = [
  { locale: 'ar-SA', source: 'ar' },
  { locale: 'da', source: 'da' },
  { locale: 'de-DE', source: 'de' },
  { locale: 'el', source: 'en-gb', fallback: true },
  { locale: 'en-GB', source: 'en-gb' },
  { locale: 'en-US', source: 'en' },
  { locale: 'es-ES', source: 'es' },
  { locale: 'fi', source: 'fi' },
  { locale: 'fr-FR', source: 'fr' },
  { locale: 'hi', source: 'hi' },
  { locale: 'id', source: 'id' },
  { locale: 'it', source: 'it' },
  { locale: 'ja', source: 'ja' },
  { locale: 'ko', source: 'ko' },
  { locale: 'nl-NL', source: 'nl' },
  { locale: 'no', source: 'no' },
  { locale: 'pl', source: 'pl' },
  { locale: 'pt-BR', source: 'pt-br' },
  { locale: 'ru', source: 'ru' },
  { locale: 'sv', source: 'sv' },
  { locale: 'th', source: 'th' },
  { locale: 'tr', source: 'tr' }
];

function screenshotNumber(fileName) {
  const match = fileName.match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

async function pngDimensions(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(24);
    await handle.read(buffer, 0, buffer.length, 0);
    const signature = buffer.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') {
      throw new Error(`${filePath} is not a PNG file.`);
    }
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  } finally {
    await handle.close();
  }
}

async function listSourceScreenshots(sourceDir, expectedCount) {
  const files = (await fs.readdir(sourceDir))
    .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
    .sort((a, b) => screenshotNumber(a) - screenshotNumber(b) || a.localeCompare(b));
  if (files.length !== expectedCount) {
    throw new Error(`${sourceDir} must contain ${expectedCount} PNG screenshots, found ${files.length}.`);
  }
  return files.map((fileName) => path.join(sourceDir, fileName));
}

async function main() {
  for (const set of SCREENSHOT_SETS) {
    await fs.access(set.sourceRoot);
  }

  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });

  const summary = {};
  for (const entry of LOCALE_SCREENSHOTS) {
    const outputDir = path.join(OUTPUT_ROOT, entry.locale);
    await fs.mkdir(outputDir, { recursive: true });

    summary[entry.locale] = {
      source: entry.source,
      fallback: entry.fallback === true,
      sets: {}
    };

    for (const set of SCREENSHOT_SETS) {
      const sourceDir = path.join(set.sourceRoot, entry.source);
      const sourceFiles = await listSourceScreenshots(sourceDir, set.expectedCount);

      for (let index = 0; index < sourceFiles.length; index += 1) {
        const sourceFile = sourceFiles[index];
        const dimensions = await pngDimensions(sourceFile);
        if (dimensions.width !== set.expectedWidth || dimensions.height !== set.expectedHeight) {
          throw new Error(`${sourceFile} dimensions ${dimensions.width}x${dimensions.height}; expected ${set.expectedWidth}x${set.expectedHeight}.`);
        }
        const outputName = `${String(index + 1).padStart(2, '0')}_${set.outputSuffix}.png`;
        await fs.copyFile(sourceFile, path.join(outputDir, outputName));
      }

      summary[entry.locale].sets[set.outputSuffix] = {
        sourceRoot: set.sourceRoot,
        count: sourceFiles.length,
        dimensions: `${set.expectedWidth}x${set.expectedHeight}`
      };
    }
    console.log(`prepared ${entry.locale} screenshots from ${entry.source}${entry.fallback ? ' fallback' : ''}`);
  }

  await fs.writeFile(
    path.join(OUTPUT_ROOT, '_summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
