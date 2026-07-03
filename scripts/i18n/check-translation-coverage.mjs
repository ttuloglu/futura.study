import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';

const ROOT = process.cwd();
const SOURCE_ROOTS = ['App.tsx', 'views', 'components'];
const LANGUAGES = ['ar', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'no', 'pl', 'pt-BR', 'sv', 'th'];
const DYNAMIC_UI_FILES = ['views/HomeView.tsx', 'utils/bookGeneration.ts'];
const INVARIANT_KEYS = new Set([
  'Apple', 'Fortale', 'Fortale Chat', 'Fortale PDF', 'Fortale ePub', 'Google', 'Markdown',
  'PDF', 'EPUB', 'Podcast', 'Quiz', 'Create, Discover and Share', 'A > Z', 'Z > A',
  '1-3', '1-6', '4-6', '7-9', '7-11', '12-18'
]);
const LEGITIMATE_SAME_TRANSLATIONS = {
  da: new Set(['Kategori', 'Kategori:', 'Tema', 'Profil', 'Romantik', 'Empati']),
  de: new Set(['Profil', 'Modern', 'Romantik']),
  en: new Set(['Language Setup', 'Global Space', 'Modern']),
  es: new Set(['Tema']),
  fr: new Set(['Profil']),
  id: new Set(['Kategori', 'Kategori:', 'Tema', 'Profil', 'Klasik', '2–32 karakter', 'Aktif', 'Anonim', 'Akademik', 'Modern', 'Empati', 'Folklor']),
  it: new Set(['Tema']),
  nl: new Set(['Modern']),
  no: new Set(['Kategori', 'Kategori:', 'Tema', 'Profil', 'Empati']),
  pl: new Set(['Profil', 'Anonim', '12 kart', 'Folklor']),
  'pt-BR': new Set(['Tema']),
  sv: new Set(['Kategori', 'Kategori:', 'Tema', 'Profil', 'Modern', 'Romantik', 'Empati'])
};

function listFiles(entry) {
  const absolute = path.join(ROOT, entry);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  return fs.readdirSync(absolute).flatMap((name) => {
    const child = path.join(absolute, name);
    if (fs.statSync(child).isDirectory()) return listFiles(path.relative(ROOT, child));
    return /\.(tsx|ts)$/.test(name) ? [child] : [];
  });
}

function sourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function collectLiteralTKeys(keys, filePath) {
  const file = sourceFile(filePath);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      keys.add(node.arguments[0].text.trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

function collectDynamicOptionKeys(keys, filePath) {
  const file = sourceFile(filePath);
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name) ? node.name.text : '';
      if (['label', 'hint', 'description'].includes(name) && ts.isStringLiteralLike(node.initializer)) {
        keys.add(node.initializer.text.trim());
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /OPTIONS/.test(node.name.text) && node.initializer) {
      const collectOptionStrings = (child) => {
        if (ts.isArrayLiteralExpression(child)) {
          for (const element of child.elements) {
            if (ts.isStringLiteralLike(element)) keys.add(element.text.trim());
          }
        }
        ts.forEachChild(child, collectOptionStrings);
      };
      collectOptionStrings(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

function collectPolicyKeys(keys) {
  const filePath = path.join(ROOT, 'data', 'policies.ts');
  const file = sourceFile(filePath);
  const acceptedNames = new Set(['title', 'lastUpdatedLabel', 'lastUpdatedDate', 'content']);
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name) ? node.name.text : '';
      if (acceptedNames.has(name)) {
        const value = evaluateStringExpression(node.initializer);
        if (value) keys.add(value.trim());
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

function evaluateStringExpression(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return evaluateStringExpression(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluateStringExpression(node.left);
    const right = evaluateStringExpression(node.right);
    if (left == null || right == null) return null;
    return left + right;
  }
  return null;
}

async function loadRuntimeTranslator() {
  const entry = `export { translateUiTextForCoverageCheck } from ${JSON.stringify(path.join(ROOT, 'i18n', 'uiI18n.tsx'))};`;
  const result = await build({
    stdin: { contents: entry, resolveDir: ROOT, sourcefile: 'i18n-coverage-entry.ts' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    write: false,
    logLevel: 'silent'
  });
  const bundled = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`);
}

const keys = new Set();
for (const filePath of SOURCE_ROOTS.flatMap(listFiles)) collectLiteralTKeys(keys, filePath);
for (const relativePath of DYNAMIC_UI_FILES) collectDynamicOptionKeys(keys, path.join(ROOT, relativePath));
collectPolicyKeys(keys);
keys.delete('');

const { translateUiTextForCoverageCheck } = await loadRuntimeTranslator();
const findings = [];
for (const language of LANGUAGES) {
  for (const key of keys) {
    if (INVARIANT_KEYS.has(key)) continue;
    const translated = await translateUiTextForCoverageCheck(language, key);
    if (
      translated === key &&
      !LEGITIMATE_SAME_TRANSLATIONS[language]?.has(key)
    ) findings.push({ language, key });
  }
}

const byLanguage = new Map();
for (const finding of findings) {
  const list = byLanguage.get(finding.language) || [];
  list.push(finding.key);
  byLanguage.set(finding.language, list);
}

console.log(`i18n translation coverage: ${keys.size} keys, ${findings.length} untranslated locale entries`);
for (const language of LANGUAGES) {
  const missing = byLanguage.get(language) || [];
  console.log(`${language}: ${missing.length}`);
  if (process.argv.includes('--verbose')) {
    for (const key of missing) console.log(`  ${key.replace(/\n/g, '\\n')}`);
  }
}

const jsonOutArg = process.argv.find((argument) => argument.startsWith('--json-out='));
if (jsonOutArg) {
  const outputPath = path.resolve(ROOT, jsonOutArg.slice('--json-out='.length));
  fs.writeFileSync(outputPath, `${JSON.stringify({ keys: [...keys], findings }, null, 2)}\n`, 'utf8');
  console.log(`coverage report: ${outputPath}`);
}

if (process.argv.includes('--fail-on-missing') && findings.length > 0) process.exitCode = 1;
