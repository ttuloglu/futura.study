import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_ROOTS = ['App.tsx', 'views', 'components'];
const ATTRIBUTES = new Set(['placeholder', 'title', 'aria-label', 'alt']);
const IGNORE_TEXT_RE = /^[\s\d%.,:;!?/\\|()[\]{}+\-–—'"`•·…&<>#=@_*]+$/u;
const TECHNICAL_RE = /(?:className|rgba\(|linear-gradient|radial-gradient|prose-invert|translate-|rotate-|scale-|shadow-|border-|text-|bg-|grid-|flex-|http|\.svg|\.png|\.jpg|\.mp3|\.pdf|\.epub)/i;
const BRAND_AND_SYMBOL_ALLOWLIST = new Set([
  'Apple',
  'Aa',
  'C',
  'Fortale',
  'Google',
  'study',
  '© Fortale',
  '&ldquo;',
  '&rdquo;'
]);

function listFiles(entry) {
  const abs = path.join(ROOT, entry);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  const out = [];
  for (const name of fs.readdirSync(abs)) {
    const child = path.join(abs, name);
    const childStat = fs.statSync(child);
    if (childStat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      out.push(...listFiles(path.relative(ROOT, child)));
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(child);
    }
  }
  return out;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function looksTranslatable(value) {
  const text = normalizeText(value);
  if (!text || IGNORE_TEXT_RE.test(text) || TECHNICAL_RE.test(text)) return false;
  if (BRAND_AND_SYMBOL_ALLOWLIST.has(text)) return false;
  return /[A-Za-zÇĞİÖŞÜçğıöşüİıĞğŞşÖöÜüÁ-ÿ\u0370-\u03FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/u.test(text);
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function collectStringLiteralObjectKeys(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys = new Set();
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = node.name;
      if (ts.isStringLiteral(name)) keys.add(name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return keys;
}

function collectKnownKeys() {
  const keys = new Set();
  const translationsDir = path.join(ROOT, 'data', 'uiTranslations');
  if (fs.existsSync(translationsDir)) {
    for (const file of fs.readdirSync(translationsDir)) {
      if (!file.endsWith('.generated.ts')) continue;
      for (const key of collectStringLiteralObjectKeys(path.join(translationsDir, file))) keys.add(key);
    }
  }
  for (const key of collectStringLiteralObjectKeys(path.join(ROOT, 'data', 'uiTranslationSupplements.ts'))) keys.add(key);
  return keys;
}

function collectFindings(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  const add = (kind, node, value) => {
    const text = normalizeText(value);
    if (!looksTranslatable(text)) return;
    findings.push({
      kind,
      file: path.relative(ROOT, filePath),
      line: lineOf(sourceFile, node),
      text
    });
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      add('jsx-text', node, node.getText(sourceFile));
    }

    if (ts.isJsxAttribute(node) && ATTRIBUTES.has(node.name.text)) {
      const initializer = node.initializer;
      if (initializer && ts.isStringLiteral(initializer)) {
        add(`attr:${node.name.text}`, initializer, initializer.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

const knownKeys = collectKnownKeys();
const files = SOURCE_ROOTS.flatMap(listFiles);
const findings = files.flatMap(collectFindings)
  .filter((finding) => !knownKeys.has(finding.text))
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.text.localeCompare(b.text));

const grouped = new Map();
for (const finding of findings) {
  const bucket = grouped.get(finding.file) || [];
  bucket.push(finding);
  grouped.set(finding.file, bucket);
}

console.log(`i18n raw UI findings: ${findings.length}`);
for (const [file, items] of grouped) {
  console.log(`\n${file}`);
  for (const item of items.slice(0, 80)) {
    console.log(`  ${item.line}: [${item.kind}] ${item.text}`);
  }
  if (items.length > 80) console.log(`  ... ${items.length - 80} more`);
}

if (process.argv.includes('--fail-on-raw') && findings.length > 0) {
  process.exitCode = 1;
}
