export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = typeof CEFR_LEVELS[number];
export const LEARNING_LANGUAGES = ['ar','da','de','el','en','es','fi','fr','hi','id','it','ja','ko','nl','no','pl','pt-BR','sv','th','tr'] as const;
export interface LanguageLearningProfile {
  version: 1;
  purpose: 'language_learning';
  targetLanguage: string;
  explanationLanguage: string;
  cefrLevel: CefrLevel;
  audience?: '1-6' | '7-11' | '12-18' | 'general';
  goals?: string[];
  vocabulary?: string[];
  grammar?: string[];
}
export interface ReadingExplanation {
  selection: string;
  translation: string;
  meaning: string;
  grammar: string;
  usage: string;
  example: string;
  exampleTranslation: string;
}
export const CEFR_GUIDANCE: Record<CefrLevel, string> = {
  A1: 'Very frequent concrete everyday vocabulary; very short sentences; basic one-clause patterns. Repeat useful words naturally. Explain unfamiliar ideas through the story, using familiar words. Avoid idioms, long subordinate clauses and dense exposition.',
  A2: 'Frequent vocabulary on familiar topics, short connected sentences, simple past/present/future and basic connectors where appropriate to the target language. Limit unfamiliar expressions, introduce them in clear context and repeat naturally.',
  B1: 'Clear connected narrative on familiar subjects; moderate sentence length; common subordinate clauses and everyday expressions. Make causes, chronology and opinions explicit; introduce unfamiliar vocabulary with inferable context.',
  B2: 'Varied vocabulary and sentence structures; nuanced descriptions and common idiomatic expressions; clear but richer narrative and arguments. Avoid unexplained highly specialized or archaic language.',
  C1: 'Rich precise vocabulary, natural idioms, varied syntax, implicit meaning and nuanced characterization. Keep prose coherent, purposeful and age-appropriate rather than artificially difficult.',
  C2: 'Sophisticated natural literary or educational prose, fine distinctions of meaning, flexible complex syntax and stylistic nuance. Prefer authentic expression over obscure vocabulary added solely to increase difficulty.'
};
const list = (v: unknown) => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string').map(x => x.trim().slice(0,100)).filter(Boolean))].slice(0,12) : undefined;
export function normalizeLanguageLearning(raw: unknown): LanguageLearningProfile | undefined {
  if (raw == null) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid language learning profile.');
  const r = raw as Record<string, unknown>;
  const language = (v: unknown) => {
    const code = String(v || '').trim();
    const known = LEARNING_LANGUAGES.find(x => x.toLowerCase() === code.toLowerCase());
    if (!known) throw new Error('Unsupported learning language.');
    return known;
  };
  if (r.purpose !== 'language_learning' || !CEFR_LEVELS.includes(r.cefrLevel as CefrLevel)) throw new Error('Invalid CEFR level or learning purpose.');
  const targetLanguage = language(r.targetLanguage), explanationLanguage = language(r.explanationLanguage);
  const audience = r.audience == null ? undefined : r.audience;
  if (audience && !['1-6','7-11','12-18','general'].includes(String(audience))) throw new Error('Invalid learning audience.');
  return { version: 1, purpose: 'language_learning', targetLanguage, explanationLanguage, cefrLevel: r.cefrLevel as CefrLevel,
    ...(audience ? { audience: audience as LanguageLearningProfile['audience'] } : {}),
    ...(list(r.goals) ? {goals:list(r.goals)} : {}), ...(list(r.vocabulary) ? {vocabulary:list(r.vocabulary)} : {}), ...(list(r.grammar) ? {grammar:list(r.grammar)} : {}) };
}
export function readLanguageLearning(raw: unknown): LanguageLearningProfile | undefined {
  try { return normalizeLanguageLearning(raw); } catch { return undefined; }
}
export function learningInstruction(profile?: LanguageLearningProfile): string {
  if (!profile) return '';
  const audienceInstruction = profile.audience === '1-6'
    ? 'The requested audience is ages 0–6. Preserve the fairy-tale product’s preschool-safe content, short read-aloud-friendly sentences and reassuring stakes while grading vocabulary and grammar to CEFR. Do not reinterpret A1 as permission to change this age audience.'
    : profile.audience === '7-11'
      ? 'Write for ages 7–11 at the selected language level; keep language acquisition difficulty separate from age suitability.'
      : profile.audience === '12-18'
        ? 'Write for ages 12–18 at the selected language level; keep language acquisition difficulty separate from age suitability.'
        : 'Age and language level are independent: an adult beginner needs adult-interest content in accessible language, never a preschool story solely because they are A1.';
  return `LANGUAGE-LEARNING READER — authoritative constraints:
Write the book entirely in language code ${profile.targetLanguage}, targeting CEFR ${profile.cefrLevel} reading proficiency.
${CEFR_GUIDANCE[profile.cefrLevel]}
${audienceInstruction} Respect the selected book format and audience.
Adapt grammar and vocabulary for THIS target language, not English-specific rules copied into another language. CEFR is a proficiency framework, not a universal fixed word-count list.
Learning goals: ${(profile.goals || []).join('; ') || 'Enjoyable comprehensible reading'}.
Useful vocabulary to revisit naturally: ${(profile.vocabulary || []).join(', ')}.
Grammar focus: ${(profile.grammar || []).join('; ')}.
Maintain narrative quality, character continuity and natural repetition; avoid inserting vocabulary lists, translations, tests or teacher commentary into narrative pages. Workbook explanations and exercises must also use the target language at the selected level.
Reader help will use ${profile.explanationLanguage} separately; do not mix that language into book prose.`;
}
export function normalizeExplanation(raw: unknown, selection: string): ReadingExplanation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid explanation.');
  const r = raw as Record<string, unknown>;
  const result = { selection } as ReadingExplanation;
  for (const key of ['translation','meaning','grammar','usage','example','exampleTranslation'] as const) {
    const value = typeof r[key] === 'string' ? r[key].trim().slice(0,1600) : '';
    if ((key === 'translation' || key === 'meaning') && !value) throw new Error('Incomplete explanation.');
    result[key] = value;
  }
  return result;
}
export function selectionContext(text: string, selection: string, offset?: number): string {
  const index = typeof offset === 'number' && offset >= 0 ? offset : text.indexOf(selection);
  if (index < 0) return text.slice(0,4500);
  return text.slice(Math.max(0,index-1300), Math.min(text.length,index+selection.length+1300));
}
