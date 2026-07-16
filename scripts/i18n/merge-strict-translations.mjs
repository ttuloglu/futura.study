import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'data', 'strictUiTranslations.generated.ts');
const TRANSLATIONS_DIR = path.join(ROOT, 'data', 'uiTranslations');
const START_MARKER = '// BEGIN FORTALE STRICT UI OVERRIDES';
const END_MARKER = '// END FORTALE STRICT UI OVERRIDES';

function readOverrideBlock(contents) {
  const match = contents.match(new RegExp(`${START_MARKER}\\nObject\\.assign\\(UI_TRANSLATIONS, ([\\s\\S]*?)\\);\\n${END_MARKER}`));
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function propertyName(property) {
  return ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : '';
}

const source = ts.createSourceFile(
  SOURCE_PATH,
  fs.readFileSync(SOURCE_PATH, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
let root = null;
const visit = (node) => {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'STRICT_UI_TRANSLATIONS' &&
    ts.isObjectLiteralExpression(node.initializer)
  ) root = node.initializer;
  ts.forEachChild(node, visit);
};
visit(source);
if (!root) throw new Error('STRICT_UI_TRANSLATIONS object was not found.');

for (const languageProperty of root.properties) {
  if (!ts.isPropertyAssignment(languageProperty) || !ts.isObjectLiteralExpression(languageProperty.initializer)) continue;
  const language = propertyName(languageProperty);
  const translations = {};
  for (const property of languageProperty.initializer.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) continue;
    translations[propertyName(property)] = property.initializer.text;
  }

  const filePath = path.join(TRANSLATIONS_DIR, `${language}.generated.ts`);
  let contents = fs.readFileSync(filePath, 'utf8');
  const relativeFilePath = path.relative(ROOT, filePath).replaceAll(path.sep, '/');
  let committedContents = '';
  try {
    committedContents = execFileSync('git', ['show', `HEAD:${relativeFilePath}`], { cwd: ROOT, encoding: 'utf8' });
  } catch {
    committedContents = '';
  }
  const mergedTranslations = {
    ...readOverrideBlock(committedContents),
    ...readOverrideBlock(contents),
    ...translations
  };
  const previousBlock = new RegExp(`\\n${START_MARKER}[\\s\\S]*?${END_MARKER}\\n`, 'g');
  contents = contents.replace(previousBlock, '\n');
  const block = [
    START_MARKER,
    `Object.assign(UI_TRANSLATIONS, ${JSON.stringify(mergedTranslations, null, 2)});`,
    END_MARKER,
    ''
  ].join('\n');
  const exportLine = 'export default UI_TRANSLATIONS;';
  if (!contents.includes(exportLine)) throw new Error(`${filePath} does not contain the expected export.`);
  contents = contents.replace(exportLine, `${block}\n${exportLine}`);
  fs.writeFileSync(filePath, contents, 'utf8');
  console.log(`${language}: merged ${Object.keys(translations).length} new translations (${Object.keys(mergedTranslations).length} total overrides)`);
}
