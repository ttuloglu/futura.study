import { normalizeAppLanguageCode, type AppLanguageCode } from '../data/appLanguages';

type CommunityBookSectionLabels = {
  description: string;
  contents: string;
  firstChapterPreview: string;
};

const COMMUNITY_BOOK_SECTION_LABELS: Record<AppLanguageCode, CommunityBookSectionLabels> = {
  ar: { description: 'الوصف', contents: 'المحتويات', firstChapterPreview: 'معاينة الفصل الأول' },
  da: { description: 'Beskrivelse', contents: 'Indhold', firstChapterPreview: 'Forhåndsvisning af første kapitel' },
  de: { description: 'Beschreibung', contents: 'Inhalt', firstChapterPreview: 'Vorschau des ersten Kapitels' },
  el: { description: 'Περιγραφή', contents: 'Περιεχόμενα', firstChapterPreview: 'Προεπισκόπηση πρώτου κεφαλαίου' },
  en: { description: 'Description', contents: 'Contents', firstChapterPreview: 'First chapter preview' },
  es: { description: 'Descripción', contents: 'Contenido', firstChapterPreview: 'Vista previa del primer capítulo' },
  fi: { description: 'Kuvaus', contents: 'Sisällys', firstChapterPreview: 'Ensimmäisen luvun esikatselu' },
  fr: { description: 'Description', contents: 'Sommaire', firstChapterPreview: 'Aperçu du premier chapitre' },
  hi: { description: 'विवरण', contents: 'विषय-सूची', firstChapterPreview: 'पहले अध्याय का पूर्वावलोकन' },
  id: { description: 'Deskripsi', contents: 'Daftar isi', firstChapterPreview: 'Pratinjau bab pertama' },
  it: { description: 'Descrizione', contents: 'Contenuti', firstChapterPreview: 'Anteprima del primo capitolo' },
  ja: { description: '説明', contents: '目次', firstChapterPreview: '第1章のプレビュー' },
  ko: { description: '설명', contents: '목차', firstChapterPreview: '첫 번째 장 미리보기' },
  nl: { description: 'Beschrijving', contents: 'Inhoud', firstChapterPreview: 'Voorbeeld van het eerste hoofdstuk' },
  no: { description: 'Beskrivelse', contents: 'Innhold', firstChapterPreview: 'Forhåndsvisning av første kapittel' },
  pl: { description: 'Opis', contents: 'Spis treści', firstChapterPreview: 'Podgląd pierwszego rozdziału' },
  'pt-BR': { description: 'Descrição', contents: 'Conteúdo', firstChapterPreview: 'Prévia do primeiro capítulo' },
  sv: { description: 'Beskrivning', contents: 'Innehåll', firstChapterPreview: 'Förhandsvisning av första kapitlet' },
  th: { description: 'คำอธิบาย', contents: 'สารบัญ', firstChapterPreview: 'ตัวอย่างบทแรก' },
  tr: { description: 'Açıklama', contents: 'İçindekiler', firstChapterPreview: 'İlk bölüm önizlemesi' }
};

export function getCommunityBookSectionLabels(language: string | undefined): CommunityBookSectionLabels {
  const normalized = normalizeAppLanguageCode(language) || 'en';
  return COMMUNITY_BOOK_SECTION_LABELS[normalized];
}
