export type AppLanguageCode =
  | 'ar'
  | 'da'
  | 'de'
  | 'el'
  | 'en'
  | 'es'
  | 'fi'
  | 'fr'
  | 'hi'
  | 'id'
  | 'it'
  | 'ja'
  | 'ko'
  | 'nl'
  | 'no'
  | 'pl'
  | 'pt-BR'
  | 'sv'
  | 'th'
  | 'tr';

export type AppLanguageOption = {
  code: AppLanguageCode;
  label: string;
};

export const DEFAULT_APP_LANGUAGE: AppLanguageCode = 'tr';

export const APP_LANGUAGE_OPTIONS: AppLanguageOption[] = [
  { code: 'ar', label: 'Arabic' },
  { code: 'da', label: 'Danish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'en', label: 'English' },
  { code: 'fi', label: 'Finnish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'el', label: 'Greek' },
  { code: 'hi', label: 'Hindi' },
  { code: 'id', label: 'Indonesian' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'no', label: 'Norwegian' },
  { code: 'pl', label: 'Polish' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'es', label: 'Spanish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' }
];

const APP_LANGUAGE_LABELS = new Map<AppLanguageCode, string>(
  APP_LANGUAGE_OPTIONS.map((option) => [option.code, option.label])
);

export function getAppLanguageLabel(code: AppLanguageCode): string {
  return APP_LANGUAGE_LABELS.get(code) || APP_LANGUAGE_LABELS.get(DEFAULT_APP_LANGUAGE) || 'Turkish';
}

const APP_LANGUAGE_LOCALES: Record<AppLanguageCode, string> = {
  ar: 'ar',
  da: 'da-DK',
  de: 'de-DE',
  el: 'el-GR',
  en: 'en-US',
  es: 'es-ES',
  fi: 'fi-FI',
  fr: 'fr-FR',
  hi: 'hi-IN',
  id: 'id-ID',
  it: 'it-IT',
  ja: 'ja-JP',
  ko: 'ko-KR',
  nl: 'nl-NL',
  no: 'nb-NO',
  pl: 'pl-PL',
  'pt-BR': 'pt-BR',
  sv: 'sv-SE',
  th: 'th-TH',
  tr: 'tr-TR'
};

export function getAppLanguageLocale(code: AppLanguageCode): string {
  return APP_LANGUAGE_LOCALES[code] || APP_LANGUAGE_LOCALES[DEFAULT_APP_LANGUAGE];
}

export function normalizeAppLanguageCode(value: unknown): AppLanguageCode | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/_/g, '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const aliasMap: Record<string, AppLanguageCode> = {
    arabic: 'ar',
    arapca: 'ar',
    danish: 'da',
    danca: 'da',
    dutch: 'nl',
    flamanca: 'nl',
    hollandaca: 'nl',
    english: 'en',
    ingilizce: 'en',
    finnish: 'fi',
    fince: 'fi',
    french: 'fr',
    fransizca: 'fr',
    german: 'de',
    almanca: 'de',
    greek: 'el',
    yunanca: 'el',
    hindi: 'hi',
    indonesian: 'id',
    endonezce: 'id',
    italian: 'it',
    italyanca: 'it',
    japanese: 'ja',
    japonca: 'ja',
    korean: 'ko',
    korece: 'ko',
    norwegian: 'no',
    norvecce: 'no',
    polish: 'pl',
    lehce: 'pl',
    portuguese: 'pt-BR',
    'portuguese brazil': 'pt-BR',
    'portuguese brasil': 'pt-BR',
    'brezilya portekizcesi': 'pt-BR',
    'portekizce brezilya': 'pt-BR',
    spanish: 'es',
    ispanyolca: 'es',
    swedish: 'sv',
    isvecce: 'sv',
    thai: 'th',
    tayca: 'th',
    turkish: 'tr',
    turkce: 'tr'
  };

  if (aliasMap[normalized]) return aliasMap[normalized];

  if (normalized === 'pt' || normalized.startsWith('pt-br')) return 'pt-BR';
  if (normalized === 'no' || normalized.startsWith('nb') || normalized.startsWith('nn')) return 'no';

  const base = normalized.split('-')[0];
  const directMatch = APP_LANGUAGE_OPTIONS.find((option) => option.code.toLowerCase() === normalized);
  if (directMatch) return directMatch.code;

  const baseMatch = APP_LANGUAGE_OPTIONS.find((option) => option.code.toLowerCase() === base);
  return baseMatch?.code || null;
}
