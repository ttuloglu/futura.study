import type { AppLanguageCode } from './appLanguages';

import ar from './uiTranslations/ar.generated';
import da from './uiTranslations/da.generated';
import de from './uiTranslations/de.generated';
import el from './uiTranslations/el.generated';
import en from './uiTranslations/en.generated';
import es from './uiTranslations/es.generated';
import fi from './uiTranslations/fi.generated';
import fr from './uiTranslations/fr.generated';
import hi from './uiTranslations/hi.generated';
import id from './uiTranslations/id.generated';
import it from './uiTranslations/it.generated';
import ja from './uiTranslations/ja.generated';
import ko from './uiTranslations/ko.generated';
import nl from './uiTranslations/nl.generated';
import no from './uiTranslations/no.generated';
import pl from './uiTranslations/pl.generated';
import ptBR from './uiTranslations/pt-BR.generated';
import sv from './uiTranslations/sv.generated';
import th from './uiTranslations/th.generated';
import tr from './uiTranslations/tr.generated';

export type UiTranslationDictionary = Record<AppLanguageCode, Record<string, string>>;

export const UI_TRANSLATIONS: UiTranslationDictionary = {
  ar,
  da,
  de,
  el,
  en,
  es,
  fi,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  'pt-BR': ptBR,
  sv,
  th,
  tr
};
