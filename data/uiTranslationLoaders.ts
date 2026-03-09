import type { AppLanguageCode } from './appLanguages';

type UiTranslationModule = {
  default: Record<string, string>;
};

export const UI_TRANSLATION_LOADERS: Record<AppLanguageCode, () => Promise<UiTranslationModule>> = {
  ar: () => import('./uiTranslations/ar.generated'),
  da: () => import('./uiTranslations/da.generated'),
  de: () => import('./uiTranslations/de.generated'),
  el: () => import('./uiTranslations/el.generated'),
  en: () => import('./uiTranslations/en.generated'),
  es: () => import('./uiTranslations/es.generated'),
  fi: () => import('./uiTranslations/fi.generated'),
  fr: () => import('./uiTranslations/fr.generated'),
  hi: () => import('./uiTranslations/hi.generated'),
  id: () => import('./uiTranslations/id.generated'),
  it: () => import('./uiTranslations/it.generated'),
  ja: () => import('./uiTranslations/ja.generated'),
  ko: () => import('./uiTranslations/ko.generated'),
  nl: () => import('./uiTranslations/nl.generated'),
  no: () => import('./uiTranslations/no.generated'),
  pl: () => import('./uiTranslations/pl.generated'),
  'pt-BR': () => import('./uiTranslations/pt-BR.generated'),
  sv: () => import('./uiTranslations/sv.generated'),
  th: () => import('./uiTranslations/th.generated'),
  tr: () => import('./uiTranslations/tr.generated')
};
