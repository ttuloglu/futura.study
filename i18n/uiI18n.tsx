import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { AppLanguageCode } from '../data/appLanguages';
import { getAppLanguageLocale } from '../data/appLanguages';
import { UI_TRANSLATION_SAFE_KEYS } from '../data/uiTranslationSafeKeys.generated';
import { UI_TRANSLATIONS } from '../data/uiTranslations.generated';

// Pre-built per-language lookup maps for O(1) translation performance
const translationMaps = new Map<AppLanguageCode, Map<string, string>>();
function getTranslationMap(language: AppLanguageCode): Map<string, string> {
  let map = translationMaps.get(language);
  if (!map) {
    const dict = UI_TRANSLATIONS[language];
    map = dict ? new Map(Object.entries(dict)) : new Map();
    translationMaps.set(language, map);
  }
  return map;
}

type UiI18nContextValue = {
  language: AppLanguageCode;
  locale: string;
  t: (value: string) => string;
};

const UiI18nContext = createContext<UiI18nContextValue | null>(null);
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const textNodeOriginals = new WeakMap<Text, string>();
const elementAttributeOriginals = new WeakMap<Element, Map<string, string>>();

const UI_FALLBACK_TRANSLATIONS: Partial<Record<AppLanguageCode, Record<string, string>>> = {
  en: {
    'Masal': 'Fairy Tale',
    'Hikaye': 'Story',
    'Roman': 'Novel',
    'Akademik': 'Academic',
    'Genel': 'General',
    '4-6 Yaş': 'Ages 4-6',
    '7-9 Yaş': 'Ages 7-9',
    '7-11': 'Ages 7-11',
    '12-18': 'Ages 12-18',
    'kredi': 'credits',
    'Kitap Rafın': 'Your Bookshelf',
    'Fortale Oluştur': 'Create with Fortale',
    'Mutlu Son': 'Happy Ending',
    'Hüzünlü-Anlamlı': 'Bittersweet',
    'Sürpriz Son': 'Twist Ending',
    'Gizlilik': 'Privacy',
    'Profil': 'Profile',
    'Yasal': 'Legal',
    'dk': 'min',
    'saat': 'hr',
    'Geri': 'Back',
    'İleri': 'Next',
    'Tahmini okuma süresi': 'Estimated reading time',
    'Kategori:': 'Category:',
    'Yaş Grubu:': 'Age Group:',
    'Oluşturucu:': 'Creator:',
    'Sayfa:': 'Pages:',
    'Alt Tür:': 'Subgenre:',
    'Belirtilmedi': 'Not specified',
    'Anonim': 'Anonymous',
    'Giriş yapmadan devam et': 'Continue without signing in',
    'Kullanım Şartları': 'Terms of Use',
    'Profil Bilgileri': 'Profile Information',
    'Gizlilik & güvenlik': 'Privacy & Security',
    'Hesap Yönetimi': 'Account Management',
    'kitap': 'books',
    'Diller': 'Languages',
    'Uygulama Dili': 'App Language',
    'Kredi Bakiyesi': 'Credit Balance',
    'Oluşturma Kredisi:': 'Creation Credits:',
    'Kredi Satın Al': 'Buy Credits',
    'Mevcut Kredi': 'Current Credit',
    'Kredi': 'Credit',
    'Misafir oturumu': 'Guest session',
    'Fortale oluşturmak için oluşturma kredisi gerekir.': 'Creation credits are required to create with Fortale.',
    'Kredi bakiyenizi yükselterek kesintisiz devam edebilirsiniz.': 'You can continue uninterrupted by increasing your credit balance.',
    'Podcast Oluştur': 'Create Podcast',
    'Tam Kitap Podcast Oluştur': 'Create Full Book Podcast',
    'Tek parça sesli anlatım': 'Single-track audio narration',
    'Podcast henüz hazır değil.': 'Podcast is not ready yet.',
    'Eski kısa podcast bulundu. Tam kitap podcast için yeniden oluşturun.': 'An older short podcast was found. Recreate it for the full-book podcast.',
    'İçerik Hazırlanıyor': 'Content is being prepared',
    'Hazırlanıyor': 'Preparing',
    'Hazırlanıyor...': 'Preparing...',
    'Build Your Epic': 'Build Your Epic',
    'Kitaplar senkronize ediliyor': 'Books are syncing',
    'Hatırlatıcı zamanı': 'Reminder time',
    'E-posta': 'Email',
    'Giriş kodu': 'Login code',
    'Mail ile gelen 6 haneli kod': 'Enter the 6-digit code from your email',
    'E-posta kutunu kontrol et ve gelen kodu gir.': 'Check your inbox and enter the code you received.',
    'Kodu gönder': 'Send code',
    'Kodu doğrula': 'Verify code',
    'E-postayı değiştir': 'Change email',
    'Kodu tekrar gönder': 'Resend code',
    'Veya': 'Or',
    'Bu bölüm arka planda hazırlanıyor. Hazır olduğunda içerik burada görünecek.': 'This section is being prepared in the background. It will appear here when ready.',
    'İçerik üretiliyor. Lütfen bekleyin.': 'Content is being generated. Please wait.',
    'Okuduklarım': 'Completed',
    'Tamamlandı': 'Completed',
    'Devam Ediyor': 'In Progress',
    'ilerleme': 'progress',
    'Başarı puanı:': 'Success score:',
    'Henüz yok': 'Not yet',
    'gün önce': 'days ago',
    'saat önce': 'hours ago',
    'dk önce': 'min ago',
    'Henüz hiç kitap yok.': 'There are no books yet.',
    'Bu filtrede kitap bulunamadı.': 'No books were found for this filter.',
    'Bölüm': 'Section',
    'Tam Podcast': 'Full Podcast',
    'Podcast Oynatıcı': 'Podcast Player',
    'Podcast indir': 'Download podcast',
    'Tüm Diller': 'All Languages',
    'Kitap Türü': 'Book Type',
    'Alt Tür': 'Subgenre',
    'Yaş Grubu': 'Age Group',
    'Dil (Yazın)': 'Language (Write it)',
    'Kurgu Modu': 'Story Mode',
    'Zaman': 'Time',
    'Mekan': 'Setting',
    'Kitap Adı': 'Book Title',
    'Kahramanlar ve Oluşturucu': 'Characters and Creator',
    'Dram': 'Drama',
    'Komedi': 'Comedy',
    'Korku': 'Horror',
    'Bilim Kurgu': 'Science Fiction',
    'Distopik': 'Dystopian',
    'Ütopik': 'Utopian',
    'Gizem': 'Mystery',
    'Psikolojik': 'Psychological',
    'Macera': 'Adventure',
    'Romantik': 'Romance',
    'Aile': 'Family',
    'Gerilim': 'Thriller',
    'Tarihsel': 'Historical',
    'Polisiye': 'Crime',
    'Fantastik': 'Fantasy',
    'Mizah': 'Humor',
    'Klasik Masal': 'Classic Fairy Tale',
    'Modern Masal': 'Modern Fairy Tale',
    'Macera Masalı': 'Adventure Fairy Tale',
    'Mitolojik Esintili': 'Mythology Inspired',
    'Eğitici Masal': 'Educational Fairy Tale'
  },
  de: {
    'Masal': 'Märchen',
    'Hikaye': 'Geschichte',
    'Roman': 'Roman',
    'Akademik': 'Akademisch',
    'Genel': 'Allgemein',
    '4-6 Yaş': '4-6 Jahre',
    '7-9 Yaş': '7-9 Jahre',
    '7-11': '7-11 Jahre',
    '12-18': '12-18 Jahre',
    'kredi': 'Credits',
    'Kitap Rafın': 'Dein Buecherregal',
    'Fortale Oluştur': 'Mit Fortale erstellen',
    'Mutlu Son': 'Happy End',
    'Hüzünlü-Anlamlı': 'Bittersuess',
    'Sürpriz Son': 'Ueberraschendes Ende',
    'Gizlilik': 'Datenschutz',
    'Profil': 'Profil',
    'Yasal': 'Rechtliches',
    'Geri': 'Zurueck',
    'İleri': 'Weiter',
    'Tahmini okuma süresi': 'Geschaetzte Lesezeit',
    'Kategori:': 'Kategorie:',
    'Yaş Grubu:': 'Altersgruppe:',
    'Oluşturucu:': 'Ersteller:',
    'Sayfa:': 'Seiten:',
    'Alt Tür:': 'Untergenre:',
    'Belirtilmedi': 'Nicht angegeben',
    'Anonim': 'Anonym',
    'Giriş yapmadan devam et': 'Ohne Anmeldung fortfahren',
    'Kullanım Şartları': 'Nutzungsbedingungen',
    'Profil Bilgileri': 'Profilinformationen',
    'Gizlilik & güvenlik': 'Datenschutz & Sicherheit',
    'Hesap Yönetimi': 'Kontoverwaltung',
    'kitap': 'Buecher',
    'Diller': 'Sprachen',
    'Uygulama Dili': 'App-Sprache',
    'Kredi Bakiyesi': 'Guthaben',
    'Oluşturma Kredisi:': 'Erstellungsguthaben:',
    'Kredi Satın Al': 'Credits kaufen',
    'Mevcut Kredi': 'Aktuelles Guthaben',
    'Kredi': 'Credit',
    'Misafir oturumu': 'Gastmodus',
    'Fortale oluşturmak için oluşturma kredisi gerekir.': 'Zum Erstellen mit Fortale werden Erstellungsguthaben benoetigt.',
    'Kredi bakiyenizi yükselterek kesintisiz devam edebilirsiniz.': 'Erhoehe dein Guthaben, um ohne Unterbrechung fortzufahren.',
    'Podcast Oluştur': 'Podcast erstellen',
    'Tam Kitap Podcast Oluştur': 'Vollstaendigen Buch-Podcast erstellen',
    'Tek parça sesli anlatım': 'Einspurige Audioerzaehlung',
    'Podcast henüz hazır değil.': 'Der Podcast ist noch nicht bereit.',
    'Eski kısa podcast bulundu. Tam kitap podcast için yeniden oluşturun.': 'Ein alter Kurz-Podcast wurde gefunden. Fuer den vollstaendigen Buch-Podcast bitte neu erstellen.',
    'İçerik Hazırlanıyor': 'Inhalt wird vorbereitet',
    'Hazırlanıyor': 'Wird vorbereitet',
    'Hazırlanıyor...': 'Wird vorbereitet...',
    'Build Your Epic': 'Build Your Epic',
    'Kitaplar senkronize ediliyor': 'Buecher werden synchronisiert',
    'Hatırlatıcı zamanı': 'Erinnerungszeit',
    'E-posta': 'E-Mail',
    'Giriş kodu': 'Anmeldecode',
    'Mail ile gelen 6 haneli kod': 'Gib den 6-stelligen Code aus der E-Mail ein',
    'E-posta kutunu kontrol et ve gelen kodu gir.': 'Pruefe dein Postfach und gib den erhaltenen Code ein.',
    'Kodu gönder': 'Code senden',
    'Kodu doğrula': 'Code bestaetigen',
    'E-postayı değiştir': 'E-Mail aendern',
    'Kodu tekrar gönder': 'Code erneut senden',
    'Veya': 'Oder',
    'Bu bölüm arka planda hazırlanıyor. Hazır olduğunda içerik burada görünecek.': 'Dieser Abschnitt wird im Hintergrund vorbereitet. Sobald er bereit ist, erscheint der Inhalt hier.',
    'İçerik üretiliyor. Lütfen bekleyin.': 'Inhalt wird erstellt. Bitte warten.',
    'Okuduklarım': 'Gelesen',
    'Tamamlandı': 'Abgeschlossen',
    'Devam Ediyor': 'Laeuft',
    'ilerleme': 'Fortschritt',
    'Başarı puanı:': 'Erfolgspunktzahl:',
    'Henüz yok': 'Noch nicht',
    'gün önce': 'Tage zuvor',
    'saat önce': 'Stunden zuvor',
    'dk önce': 'Min zuvor',
    'Henüz hiç kitap yok.': 'Es gibt noch keine Buecher.',
    'Bu filtrede kitap bulunamadı.': 'Fuer diesen Filter wurden keine Buecher gefunden.',
    'Bölüm': 'Kapitel',
    'Tam Podcast': 'Vollstaendiger Podcast',
    'Podcast Oynatıcı': 'Podcast-Player',
    'Podcast indir': 'Podcast herunterladen',
    'Tüm Diller': 'Alle Sprachen',
    'Kitap Türü': 'Buchtyp',
    'Alt Tür': 'Untergenre',
    'Yaş Grubu': 'Altersgruppe',
    'Dil (Yazın)': 'Sprache (eingeben)',
    'Kurgu Modu': 'Erzaehlmodus',
    'Zaman': 'Zeit',
    'Mekan': 'Ort',
    'Kitap Adı': 'Buchtitel',
    'Kahramanlar ve Oluşturucu': 'Figuren und Ersteller',
    'Dram': 'Drama',
    'Komedi': 'Komoedie',
    'Korku': 'Horror',
    'Bilim Kurgu': 'Science-Fiction',
    'Distopik': 'Dystopisch',
    'Ütopik': 'Utopisch',
    'Gizem': 'Mystery',
    'Psikolojik': 'Psychologisch',
    'Macera': 'Abenteuer',
    'Romantik': 'Romantik',
    'Aile': 'Familie',
    'Gerilim': 'Thriller',
    'Tarihsel': 'Historisch',
    'Polisiye': 'Krimi',
    'Fantastik': 'Fantastik',
    'Mizah': 'Humor',
    'Klasik Masal': 'Klassisches Maerchen',
    'Modern Masal': 'Modernes Maerchen',
    'Macera Masalı': 'Abenteuermaerchen',
    'Mitolojik Esintili': 'Mythologisch inspiriert',
    'Eğitici Masal': 'Lehrreiches Maerchen'
  }
};

function isSuspiciousTranslation(value: string): boolean {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  return (
    normalized.length > 180 ||
    normalized.includes('\n') ||
    normalized.includes('{{var') ||
    normalized.includes('className') ||
    normalized.includes('hover:') ||
    normalized.includes('focus:') ||
    normalized.includes('rounded-') ||
    normalized.includes('border-') ||
    normalized.includes('px-') ||
    normalized.includes('py-') ||
    normalized.includes('text-[') ||
    normalized.includes('bg-[') ||
    normalized.includes('rgba(') ||
    normalized.includes('linear-gradient(') ||
    normalized.includes('nodes/') ||
    normalized.includes('/podcast-') ||
    normalized.includes('absolute ') ||
    normalized.includes('fixed ') ||
    normalized.includes('inline-flex') ||
    normalized.includes('ease-in-out') ||
    normalized.includes('shadow-[') ||
    /\b(w|h|min-w|max-w|min-h|max-h|px|py|pt|pb|pl|pr|mt|mb|ml|mr|gap|grid-cols|rounded|border|text|font|items|justify|leading|tracking)-/.test(normalized) ||
    /\[\d+px\]/.test(normalized)
  );
}

function resolveSafeUiKey(value: string): string | null {
  const raw = String(value || '').replace(/\r/g, '');
  const candidates = [
    raw,
    raw.trim(),
    normalizeInlineText(raw)
  ].filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);

  for (const candidate of candidates) {
    if (/[<>]/.test(candidate)) continue;
    if (UI_TRANSLATION_SAFE_KEYS.has(candidate as never)) {
      return candidate;
    }
  }

  return null;
}

function isSafeUiKey(value: string): boolean {
  return Boolean(resolveSafeUiKey(value));
}

function normalizeInlineText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function shouldSkipTranslationForElement(element: Element | null): boolean {
  if (!element) return true;
  if (element.closest('[data-no-ui-translate="true"]')) return true;
  const tagName = element.tagName.toLowerCase();
  return tagName === 'script' || tagName === 'style' || tagName === 'code' || tagName === 'pre' || tagName === 'textarea';
}

function applyTranslationToTextNode(node: Text, language: AppLanguageCode) {
  const parentElement = node.parentElement;
  if (shouldSkipTranslationForElement(parentElement)) return;

  const original = textNodeOriginals.get(node) ?? node.nodeValue ?? '';
  if (!textNodeOriginals.has(node)) {
    textNodeOriginals.set(node, original);
  }

  const normalized = normalizeInlineText(original);
  if (!isSafeUiKey(normalized)) return;

  const translated = translateText(language, normalized);
  const nextValue = original.includes(normalized)
    ? original.replace(normalized, translated)
    : translated;

  if (node.nodeValue !== nextValue) {
    node.nodeValue = nextValue;
  }
}

function applyTranslationToElementAttributes(element: Element, language: AppLanguageCode) {
  if (shouldSkipTranslationForElement(element)) return;

  let originalAttributes = elementAttributeOriginals.get(element);
  if (!originalAttributes) {
    originalAttributes = new Map<string, string>();
    elementAttributeOriginals.set(element, originalAttributes);
  }

  for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
    const currentValue = element.getAttribute(attributeName);
    if (currentValue == null) continue;

    const originalValue = originalAttributes.get(attributeName) ?? currentValue;
    if (!originalAttributes.has(attributeName)) {
      originalAttributes.set(attributeName, originalValue);
    }

    const normalized = normalizeInlineText(originalValue);
    if (!isSafeUiKey(normalized)) continue;

    const translated = translateText(language, normalized);
    const nextValue = originalValue.includes(normalized)
      ? originalValue.replace(normalized, translated)
      : translated;

    if (element.getAttribute(attributeName) !== nextValue) {
      element.setAttribute(attributeName, nextValue);
    }
  }
}

function applyDomTranslations(language: AppLanguageCode, root: ParentNode = document.body) {
  if (typeof document === 'undefined' || !root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  let currentNode = walker.currentNode;
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      applyTranslationToTextNode(currentNode as Text, language);
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      applyTranslationToElementAttributes(currentNode as Element, language);
    }
    currentNode = walker.nextNode();
  }
}

function translateText(language: AppLanguageCode, value: string): string {
  if (!value || language === 'tr') return value;

  // Primary: generated translations from UI_TRANSLATIONS
  const map = getTranslationMap(language);
  const primary = map.get(value);
  if (primary && primary !== value) return primary;

  // Secondary: hand-curated fallback entries
  const fallback = UI_FALLBACK_TRANSLATIONS[language]?.[value];
  if (fallback) return fallback;

  return value;
}

export function UiI18nProvider({
  language,
  children
}: {
  language: AppLanguageCode;
  children: React.ReactNode;
}) {
  const value = useMemo<UiI18nContextValue>(() => ({
    language,
    locale: getAppLanguageLocale(language),
    t: (input: string) => translateText(language, input)
  }), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    applyDomTranslations(language, document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          applyTranslationToTextNode(mutation.target as Text, language);
          continue;
        }

        if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
          applyTranslationToElementAttributes(mutation.target as Element, language);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            applyTranslationToTextNode(node as Text, language);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            applyDomTranslations(language, node as ParentNode);
          }
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES]
    });

    return () => observer.disconnect();
  }, [language]);

  return (
    <UiI18nContext.Provider value={value}>
      {children}
    </UiI18nContext.Provider>
  );
}

export function useUiI18n(): UiI18nContextValue {
  const context = useContext(UiI18nContext);
  if (!context) {
    throw new Error('useUiI18n must be used within UiI18nProvider');
  }
  return context;
}
