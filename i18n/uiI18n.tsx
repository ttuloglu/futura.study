import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppLanguageCode } from '../data/appLanguages';
import { getAppLanguageLocale } from '../data/appLanguages';
import { UI_TRANSLATION_LOADERS } from '../data/uiTranslationLoaders';
import { UI_TRANSLATION_SAFE_KEYS } from '../data/uiTranslationSafeKeys.generated';
import { UI_TRANSLATION_SUPPLEMENTS } from '../data/uiTranslationSupplements';
import { COMMUNITY_UI_TRANSLATIONS } from '../data/communityUiTranslations.generated';
import { LIBRARY_DASHBOARD_UI_TRANSLATIONS } from '../data/libraryDashboardUiTranslations';

const translationMaps = new Map<AppLanguageCode, Map<string, string>>();
const translationLoadPromises = new Map<AppLanguageCode, Promise<Map<string, string>>>();

function getTranslationMap(language: AppLanguageCode): Map<string, string> {
  return translationMaps.get(language) ?? new Map();
}

function ensureTranslationMap(language: AppLanguageCode): Promise<Map<string, string>> {
  const existingMap = translationMaps.get(language);
  if (existingMap) {
    return Promise.resolve(existingMap);
  }

  const pending = translationLoadPromises.get(language);
  if (pending) {
    return pending;
  }

  const load = UI_TRANSLATION_LOADERS[language]().then((module) => {
    const map = new Map(Object.entries(module.default || {}));
    translationMaps.set(language, map);
    translationLoadPromises.delete(language);
    return map;
  }).catch((error) => {
    translationLoadPromises.delete(language);
    throw error;
  });

  translationLoadPromises.set(language, load);
  return load;
}

type UiI18nContextValue = {
  language: AppLanguageCode;
  locale: string;
  t: (value: string) => string;
};

const UiI18nContext = createContext<UiI18nContextValue | null>(null);
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const textNodeOriginals = new WeakMap<Text, string>();
const textNodeLastAppliedTranslations = new WeakMap<Text, string>();
const elementAttributeOriginals = new WeakMap<Element, Map<string, string>>();
const elementAttributeLastAppliedTranslations = new WeakMap<Element, Map<string, string>>();

const UI_FALLBACK_TRANSLATIONS: Partial<Record<AppLanguageCode, Record<string, string>>> = {
  en: {
    'Masal': 'Fairy Tale',
    'Hikaye': 'Story',
    'Roman': 'Novel',
    'Akademik': 'Academic',
    'Genel': 'General',
    '1-3 Yaş': 'Ages 1-3',
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
    '1-3 Yaş': '1-3 Jahre',
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
    'Fantastik': 'Fantasy',
    'Mizah': 'Humor',
    'Klasik Masal': 'Klassisches Maerchen',
    'Modern Masal': 'Modernes Maerchen',
    'Macera Masalı': 'Abenteuermaerchen',
    'Mitolojik Esintili': 'Mythologisch inspiriert',
    'Eğitici Masal': 'Lehrreiches Maerchen'
  }
};

const PDF_PALETTE_UI_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: {
    'Arka Plan Rengi Seçin': 'اختر لون الخلفية',
    'Süt beyaz': 'أبيض حليبي',
    'Şeker mavi': 'أزرق سكري',
    'Şeker pembe': 'وردي سكري',
    'Şeker yeşil': 'أخضر سكري',
    'Şeker sarı': 'أصفر سكري',
    'Şeker kahverengi': 'بني سكري',
    'Şeker lila': 'ليلكي سكري',
    'Şeker mercan': 'مرجاني سكري',
    'Şeker bulut': 'سحابي سكري'
  },
  da: {
    'Arka Plan Rengi Seçin': 'Vælg baggrundsfarve',
    'Süt beyaz': 'Mælkehvid',
    'Şeker mavi': 'Slikblå',
    'Şeker pembe': 'Slikpink',
    'Şeker yeşil': 'Slikgrøn',
    'Şeker sarı': 'Slikgul',
    'Şeker kahverengi': 'Slikbrun',
    'Şeker lila': 'Sliklilla',
    'Şeker mercan': 'Slikkoral',
    'Şeker bulut': 'Sliksky'
  },
  de: {
    'Arka Plan Rengi Seçin': 'Hintergrundfarbe wählen',
    'Süt beyaz': 'Milchweiß',
    'Şeker mavi': 'Zuckerblau',
    'Şeker pembe': 'Zuckerrosa',
    'Şeker yeşil': 'Zuckergrün',
    'Şeker sarı': 'Zuckergelb',
    'Şeker kahverengi': 'Zuckerbraun',
    'Şeker lila': 'Zuckerlila',
    'Şeker mercan': 'Zuckerkoralle',
    'Şeker bulut': 'Zuckerwolke'
  },
  el: {
    'Arka Plan Rengi Seçin': 'Επιλέξτε χρώμα φόντου',
    'Süt beyaz': 'Γαλακτερό λευκό',
    'Şeker mavi': 'Γαλάζιο ζαχαρωτό',
    'Şeker pembe': 'Ροζ ζαχαρωτό',
    'Şeker yeşil': 'Πράσινο ζαχαρωτό',
    'Şeker sarı': 'Κίτρινο ζαχαρωτό',
    'Şeker kahverengi': 'Καφέ ζαχαρωτό',
    'Şeker lila': 'Λιλά ζαχαρωτό',
    'Şeker mercan': 'Κοραλλί ζαχαρωτό',
    'Şeker bulut': 'Συννεφένιο ζαχαρωτό'
  },
  en: {
    'Arka Plan Rengi Seçin': 'Choose Background Color',
    'Süt beyaz': 'Milk white',
    'Şeker mavi': 'Candy Blue',
    'Şeker pembe': 'Candy Pink',
    'Şeker yeşil': 'Candy Green',
    'Şeker sarı': 'Candy Yellow',
    'Şeker kahverengi': 'Candy Brown',
    'Şeker lila': 'Candy Lilac',
    'Şeker mercan': 'Candy Coral',
    'Şeker bulut': 'Candy Cloud'
  },
  es: {
    'Arka Plan Rengi Seçin': 'Elige el color de fondo',
    'Süt beyaz': 'Blanco leche',
    'Şeker mavi': 'Azul caramelo',
    'Şeker pembe': 'Rosa caramelo',
    'Şeker yeşil': 'Verde caramelo',
    'Şeker sarı': 'Amarillo caramelo',
    'Şeker kahverengi': 'Marrón caramelo',
    'Şeker lila': 'Lila caramelo',
    'Şeker mercan': 'Coral caramelo',
    'Şeker bulut': 'Nube caramelo'
  },
  fi: {
    'Arka Plan Rengi Seçin': 'Valitse taustaväri',
    'Süt beyaz': 'Maidonvalkoinen',
    'Şeker mavi': 'Karkinsininen',
    'Şeker pembe': 'Karkinvaaleanpunainen',
    'Şeker yeşil': 'Karkinvihreä',
    'Şeker sarı': 'Karkinkeltainen',
    'Şeker kahverengi': 'Karkinruskea',
    'Şeker lila': 'Karkinliila',
    'Şeker mercan': 'Karkinkoralli',
    'Şeker bulut': 'Karkkipilvi'
  },
  fr: {
    'Arka Plan Rengi Seçin': 'Choisissez la couleur de fond',
    'Süt beyaz': 'Blanc lait',
    'Şeker mavi': 'Bleu bonbon',
    'Şeker pembe': 'Rose bonbon',
    'Şeker yeşil': 'Vert bonbon',
    'Şeker sarı': 'Jaune bonbon',
    'Şeker kahverengi': 'Brun bonbon',
    'Şeker lila': 'Lilas bonbon',
    'Şeker mercan': 'Corail bonbon',
    'Şeker bulut': 'Nuage bonbon'
  },
  hi: {
    'Arka Plan Rengi Seçin': 'पृष्ठभूमि का रंग चुनें',
    'Süt beyaz': 'दूधिया सफेद',
    'Şeker mavi': 'कैंडी नीला',
    'Şeker pembe': 'कैंडी गुलाबी',
    'Şeker yeşil': 'कैंडी हरा',
    'Şeker sarı': 'कैंडी पीला',
    'Şeker kahverengi': 'कैंडी भूरा',
    'Şeker lila': 'कैंडी लैवेंडर',
    'Şeker mercan': 'कैंडी कोरल',
    'Şeker bulut': 'कैंडी बादल'
  },
  id: {
    'Arka Plan Rengi Seçin': 'Pilih warna latar',
    'Süt beyaz': 'Putih susu',
    'Şeker mavi': 'Biru permen',
    'Şeker pembe': 'Merah muda permen',
    'Şeker yeşil': 'Hijau permen',
    'Şeker sarı': 'Kuning permen',
    'Şeker kahverengi': 'Cokelat permen',
    'Şeker lila': 'Lila permen',
    'Şeker mercan': 'Koral permen',
    'Şeker bulut': 'Awan permen'
  },
  it: {
    'Arka Plan Rengi Seçin': 'Scegli il colore di sfondo',
    'Süt beyaz': 'Bianco latte',
    'Şeker mavi': 'Blu confetto',
    'Şeker pembe': 'Rosa confetto',
    'Şeker yeşil': 'Verde confetto',
    'Şeker sarı': 'Giallo confetto',
    'Şeker kahverengi': 'Marrone confetto',
    'Şeker lila': 'Lilla confetto',
    'Şeker mercan': 'Corallo confetto',
    'Şeker bulut': 'Nuvola confetto'
  },
  ja: {
    'Arka Plan Rengi Seçin': '背景色を選択',
    'Süt beyaz': 'ミルクホワイト',
    'Şeker mavi': 'キャンディブルー',
    'Şeker pembe': 'キャンディピンク',
    'Şeker yeşil': 'キャンディグリーン',
    'Şeker sarı': 'キャンディイエロー',
    'Şeker kahverengi': 'キャンディブラウン',
    'Şeker lila': 'キャンディライラック',
    'Şeker mercan': 'キャンディコーラル',
    'Şeker bulut': 'キャンディクラウド'
  },
  ko: {
    'Arka Plan Rengi Seçin': '배경 색상을 선택하세요',
    'Süt beyaz': '밀크 화이트',
    'Şeker mavi': '캔디 블루',
    'Şeker pembe': '캔디 핑크',
    'Şeker yeşil': '캔디 그린',
    'Şeker sarı': '캔디 옐로',
    'Şeker kahverengi': '캔디 브라운',
    'Şeker lila': '캔디 라일락',
    'Şeker mercan': '캔디 코랄',
    'Şeker bulut': '캔디 클라우드'
  },
  nl: {
    'Arka Plan Rengi Seçin': 'Kies achtergrondkleur',
    'Süt beyaz': 'Melkwit',
    'Şeker mavi': 'Snoepblauw',
    'Şeker pembe': 'Snoeproze',
    'Şeker yeşil': 'Snoepgroen',
    'Şeker sarı': 'Snoepgeel',
    'Şeker kahverengi': 'Snoepbruin',
    'Şeker lila': 'Snoeplila',
    'Şeker mercan': 'Snoepkoraal',
    'Şeker bulut': 'Snoepwolk'
  },
  no: {
    'Arka Plan Rengi Seçin': 'Velg bakgrunnsfarge',
    'Süt beyaz': 'Melkehvit',
    'Şeker mavi': 'Godteblå',
    'Şeker pembe': 'Godterosa',
    'Şeker yeşil': 'Godtegrønn',
    'Şeker sarı': 'Godtegul',
    'Şeker kahverengi': 'Godtebrun',
    'Şeker lila': 'Godtelilla',
    'Şeker mercan': 'Godtekorall',
    'Şeker bulut': 'Godtesky'
  },
  pl: {
    'Arka Plan Rengi Seçin': 'Wybierz kolor tła',
    'Süt beyaz': 'Mleczna biel',
    'Şeker mavi': 'Cukierkowy niebieski',
    'Şeker pembe': 'Cukierkowy róż',
    'Şeker yeşil': 'Cukierkowa zieleń',
    'Şeker sarı': 'Cukierkowy żółty',
    'Şeker kahverengi': 'Cukierkowy brąz',
    'Şeker lila': 'Cukierkowy liliowy',
    'Şeker mercan': 'Cukierkowy koral',
    'Şeker bulut': 'Cukierkowa chmura'
  },
  'pt-BR': {
    'Arka Plan Rengi Seçin': 'Escolha a cor de fundo',
    'Süt beyaz': 'Branco leite',
    'Şeker mavi': 'Azul doce',
    'Şeker pembe': 'Rosa doce',
    'Şeker yeşil': 'Verde doce',
    'Şeker sarı': 'Amarelo doce',
    'Şeker kahverengi': 'Marrom doce',
    'Şeker lila': 'Lilás doce',
    'Şeker mercan': 'Coral doce',
    'Şeker bulut': 'Nuvem doce'
  },
  sv: {
    'Arka Plan Rengi Seçin': 'Välj bakgrundsfärg',
    'Süt beyaz': 'Mjölkvit',
    'Şeker mavi': 'Godisblå',
    'Şeker pembe': 'Godisrosa',
    'Şeker yeşil': 'Godisgrön',
    'Şeker sarı': 'Godisgul',
    'Şeker kahverengi': 'Godisbrun',
    'Şeker lila': 'Godislila',
    'Şeker mercan': 'Godiskorall',
    'Şeker bulut': 'Godismoln'
  },
  th: {
    'Arka Plan Rengi Seçin': 'เลือกสีพื้นหลัง',
    'Süt beyaz': 'ขาวน้ำนม',
    'Şeker mavi': 'ฟ้าลูกกวาด',
    'Şeker pembe': 'ชมพูลูกกวาด',
    'Şeker yeşil': 'เขียวลูกกวาด',
    'Şeker sarı': 'เหลืองลูกกวาด',
    'Şeker kahverengi': 'น้ำตาลลูกกวาด',
    'Şeker lila': 'ไลแลคลูกกวาด',
    'Şeker mercan': 'ปะการังลูกกวาด',
    'Şeker bulut': 'เมฆลูกกวาด'
  },
  tr: {
    'Arka Plan Rengi Seçin': 'Arka Plan Rengi Seçin',
    'Süt beyaz': 'Süt beyaz',
    'Şeker mavi': 'Şeker mavi',
    'Şeker pembe': 'Şeker pembe',
    'Şeker yeşil': 'Şeker yeşil',
    'Şeker sarı': 'Şeker sarı',
    'Şeker kahverengi': 'Şeker kahverengi',
    'Şeker lila': 'Şeker lila',
    'Şeker mercan': 'Şeker mercan',
    'Şeker bulut': 'Şeker bulut'
  }
};

for (const [language, translations] of Object.entries(PDF_PALETTE_UI_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

const UI_EXTRA_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: {
    'Geri': 'رجوع',
    'Üretim için giriş gerekli': 'تسجيل الدخول مطلوب للإنتاج',
    'Üretime devam etmek için lütfen giriş yapın.': 'يرجى تسجيل الدخول للمتابعة في الإنتاج.',
    'Şeker siyah': 'أسود حلوى',
    'Kitabınız yükleniyor': 'يتم تحميل كتابك',
    'Podcast oluştur': 'أنشئ البودكاست',
    'Önce sesi test et, sonra oluştur.': 'اختبر الصوت أولاً ثم أنشئه.',
    'Podcast sesini seç': 'اختر صوت البودكاست',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'يمكنك الاستماع إلى كل صوت بلغة الكتاب ثم اختياره.',
    'Seçildi': 'تم الاختيار',
    'Ses örneğini dinle': 'استمع إلى نموذج الصوت',
    'Dinle': 'استمع',
    'Durdur': 'إيقاف',
    'Seçili sesle podcast oluştur': 'أنشئ البودكاست بالصوت المحدد',
    'Ses önizlemesi oynatılamadı.': 'تعذر تشغيل معاينة الصوت.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'ستجعل التفاصيل التي تدخلها بناء الكتاب مخصصًا لك. اكتب الشخصيات والموضوع الرئيسي والصراع والحبكة والتفاصيل التي تريد التركيز عليها معًا.'
  },
  da: {
    'Geri': 'Tilbage',
    'Üretim için giriş gerekli': 'Login kraeves for oprettelse',
    'Üretime devam etmek için lütfen giriş yapın.': 'Log ind for at fortsaette med oprettelsen.',
    'Şeker siyah': 'Sliksort',
    'Kitabınız yükleniyor': 'Din bog indlaeses',
    'Podcast oluştur': 'Opret podcast',
    'Önce sesi test et, sonra oluştur.': 'Test stemmen først, opret derefter.',
    'Podcast sesini seç': 'Vaelg podcaststemme',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Du kan lytte til hver stemme pa bogens sprog og derefter vaelge.',
    'Seçildi': 'Valgt',
    'Ses örneğini dinle': 'Lyt til stemmeproven',
    'Dinle': 'Lyt',
    'Durdur': 'Stop',
    'Seçili sesle podcast oluştur': 'Opret podcast med den valgte stemme',
    'Ses önizlemesi oynatılamadı.': 'Kunne ikke afspille stemmeforhandsvisning.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'De detaljer, du indtaster, gor bogens plot personligt for dig. Skriv karaktererne, bogens hovedtema, konflikten, handlingsforlobet og de detaljer, du vil fokusere pa, samlet.'
  },
  de: {
    'Geri': 'Zurueck',
    'Üretim için giriş gerekli': 'Anmeldung fuer die Erstellung erforderlich',
    'Üretime devam etmek için lütfen giriş yapın.': 'Bitte melde dich an, um mit der Erstellung fortzufahren.',
    'Şeker siyah': 'Bonbonschwarz',
    'Kitabınız yükleniyor': 'Dein Buch wird geladen',
    'Podcast oluştur': 'Podcast erstellen',
    'Önce sesi test et, sonra oluştur.': 'Teste zuerst die Stimme und erstelle dann den Podcast.',
    'Podcast sesini seç': 'Podcast-Stimme waehlen',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Du kannst jede Stimme in der Buchsprache anhoeren und dann auswaehlen.',
    'Seçildi': 'Ausgewaehlt',
    'Ses örneğini dinle': 'Stimmprobe anhoeren',
    'Dinle': 'Anhoeren',
    'Durdur': 'Stoppen',
    'Seçili sesle podcast oluştur': 'Podcast mit der gewaehlten Stimme erstellen',
    'Ses önizlemesi oynatılamadı.': 'Die Stimmvorschau konnte nicht abgespielt werden.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Die eingegebenen Details sorgen fuer einen auf dich zugeschnittenen Buchplot. Schreibe die Figuren, das Hauptthema des Buches, den Konflikt, den Handlungsverlauf und die Details, auf die du dich konzentrieren moechtest, zusammen auf.'
  },
  el: {
    'Geri': 'Πίσω',
    'Üretim için giriş gerekli': 'Απαιτείται σύνδεση για δημιουργία',
    'Üretime devam etmek için lütfen giriş yapın.': 'Συνδεθείτε για να συνεχίσετε τη δημιουργία.',
    'Şeker siyah': 'Mavro karamela',
    'Kitabınız yükleniyor': 'To vivlio sas fortonetai',
    'Podcast oluştur': 'Dimiourgise podcast',
    'Önce sesi test et, sonra oluştur.': 'Dokimase prota ti foni kai meta dimiourgise.',
    'Podcast sesini seç': 'Epilogi fonis podcast',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Mporeis na akouseis kathe foni sti glossa tou vivliou kai meta na epilexeis.',
    'Seçildi': 'Epilechthike',
    'Ses örneğini dinle': 'Akouse to deigma fonis',
    'Dinle': 'Akouse',
    'Durdur': 'Stamatima',
    'Seçili sesle podcast oluştur': 'Dimiourgise podcast me ti epilegmeni foni',
    'Ses önizlemesi oynatılamadı.': 'I proepiskopisi fonis den borese na anaparachthei.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Oi leptomeries pou eisagete tha voithisoun sti dimiourgia enos bibliou prosarmosenou se esas. Grapste mazi tous charaktires, to kyrio thema tou vivliou, ti sygkrousi, tin ploti kai tis leptomeries stis opoies thelete na estiasete.'
  },
  en: {
    'Geri': 'Back',
    'Üretim için giriş gerekli': 'Login required for generation',
    'Üretime devam etmek için lütfen giriş yapın.': 'Please log in to continue generating.',
    'Şeker siyah': 'Candy black',
    'Kitabınız yükleniyor': 'Your book is loading',
    'Podcast oluştur': 'Create podcast',
    'Önce sesi test et, sonra oluştur.': 'Test the voice first, then create it.',
    'Podcast sesini seç': 'Choose podcast voice',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'You can listen to each voice in the book language and then choose it.',
    'Seçildi': 'Selected',
    'Ses örneğini dinle': 'Listen to the voice sample',
    'Dinle': 'Listen',
    'Durdur': 'Stop',
    'Seçili sesle podcast oluştur': 'Create podcast with selected voice',
    'Ses önizlemesi oynatılamadı.': 'Voice preview could not be played.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'The details you enter will help create a book plot tailored to you. Write the characters, the book main theme, the conflict, the plotline, and the details you want to emphasize together.'
  },
  es: {
    'Geri': 'Atras',
    'Üretim için giriş gerekli': 'Se requiere inicio de sesion para generar',
    'Üretime devam etmek için lütfen giriş yapın.': 'Inicia sesion para continuar con la generacion.',
    'Şeker siyah': 'Negro dulce',
    'Kitabınız yükleniyor': 'Tu libro se esta cargando',
    'Podcast oluştur': 'Crear podcast',
    'Önce sesi test et, sonra oluştur.': 'Primero prueba la voz y luego crealo.',
    'Podcast sesini seç': 'Elige la voz del podcast',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Puedes escuchar cada voz en el idioma del libro y luego elegirla.',
    'Seçildi': 'Seleccionado',
    'Ses örneğini dinle': 'Escucha la muestra de voz',
    'Dinle': 'Escuchar',
    'Durdur': 'Detener',
    'Seçili sesle podcast oluştur': 'Crear podcast con la voz seleccionada',
    'Ses önizlemesi oynatılamadı.': 'No se pudo reproducir la vista previa de voz.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Los detalles que ingreses ayudaran a crear una trama del libro adaptada a ti. Escribe juntos los personajes, el tema principal del libro, el conflicto, la trama y los detalles en los que quieres centrarte.'
  },
  fi: {
    'Geri': 'Takaisin',
    'Üretim için giriş gerekli': 'Luonti vaatii kirjautumisen',
    'Üretime devam etmek için lütfen giriş yapın.': 'Kirjaudu sisaan jatkaaksesi luontia.',
    'Şeker siyah': 'Karkkimusta',
    'Kitabınız yükleniyor': 'Kirjaasi ladataan',
    'Podcast oluştur': 'Luo podcast',
    'Önce sesi test et, sonra oluştur.': 'Testaa aani ensin ja luo sitten.',
    'Podcast sesini seç': 'Valitse podcast-aani',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Voit kuunnella jokaista aanta kirjan kielella ja valita sitten.',
    'Seçildi': 'Valittu',
    'Ses örneğini dinle': 'Kuuntele aaninayte',
    'Dinle': 'Kuuntele',
    'Durdur': 'Pysayta',
    'Seçili sesle podcast oluştur': 'Luo podcast valitulla aanella',
    'Ses önizlemesi oynatılamadı.': 'Aaninaytetta ei voitu toistaa.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Kirjoittamasi yksityiskohdat auttavat rakentamaan sinulle oman kirjan juonen. Kirjoita yhdessa hahmot, kirjan paateema, ristiriita, juoni ja yksityiskohdat, joihin haluat keskittya.'
  },
  fr: {
    'Geri': 'Retour',
    'Üretim için giriş gerekli': 'Connexion requise pour la generation',
    'Üretime devam etmek için lütfen giriş yapın.': 'Connectez-vous pour continuer la generation.',
    'Şeker siyah': 'Noir bonbon',
    'Kitabınız yükleniyor': 'Votre livre se charge',
    'Podcast oluştur': 'Creer le podcast',
    'Önce sesi test et, sonra oluştur.': 'Testez d abord la voix, puis creez le podcast.',
    'Podcast sesini seç': 'Choisir la voix du podcast',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Vous pouvez ecouter chaque voix dans la langue du livre puis la choisir.',
    'Seçildi': 'Selectionne',
    'Ses örneğini dinle': 'Ecouter un extrait de voix',
    'Dinle': 'Ecouter',
    'Durdur': 'Arreter',
    'Seçili sesle podcast oluştur': 'Creer le podcast avec la voix selectionnee',
    'Ses önizlemesi oynatılamadı.': 'Impossible de lire l apercu vocal.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Les details que vous saisissez aideront a creer une intrigue de livre adaptee a vous. Ecrivez ensemble les personnages, le theme principal du livre, le conflit, l intrigue et les details sur lesquels vous voulez vous concentrer.'
  },
  hi: {
    'Geri': 'वापस',
    'Üretim için giriş gerekli': 'उत्पादन के लिए लॉगिन आवश्यक है',
    'Üretime devam etmek için lütfen giriş yapın.': 'उत्पादन जारी रखने के लिए कृपया लॉगिन करें।',
    'Şeker siyah': 'Candy kala',
    'Kitabınız yükleniyor': 'Aapki kitab load ho rahi hai',
    'Podcast oluştur': 'Podcast banaen',
    'Önce sesi test et, sonra oluştur.': 'Pehle awaaz test karein, phir banaen.',
    'Podcast sesini seç': 'Podcast ki awaaz chunen',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Aap har awaaz ko kitab ki bhasha mein sun kar phir chun sakte hain.',
    'Seçildi': 'Chuna gaya',
    'Ses örneğini dinle': 'Awaaz ka namoona sunein',
    'Dinle': 'Sunein',
    'Durdur': 'Roken',
    'Seçili sesle podcast oluştur': 'Chuni hui awaaz ke saath podcast banaen',
    'Ses önizlemesi oynatılamadı.': 'Awaaz preview chalaya nahin ja saka.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Jo vivaran aap dete hain, ve aapke liye khas kitab ki kahani banane mein madad karenge. Kirdaron, kitab ke mukhya vishay, takraav, plot aur jin baton par dhyan dena hai unhen saath mein likhen.'
  },
  id: {
    'Geri': 'Kembali',
    'Üretim için giriş gerekli': 'Login diperlukan untuk produksi',
    'Üretime devam etmek için lütfen giriş yapın.': 'Silakan login untuk melanjutkan produksi.',
    'Şeker siyah': 'Hitam permen',
    'Kitabınız yükleniyor': 'Bukumu sedang dimuat',
    'Podcast oluştur': 'Buat podcast',
    'Önce sesi test et, sonra oluştur.': 'Tes suaranya dulu, lalu buat.',
    'Podcast sesini seç': 'Pilih suara podcast',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Kamu bisa mendengarkan tiap suara dalam bahasa buku lalu memilihnya.',
    'Seçildi': 'Dipilih',
    'Ses örneğini dinle': 'Dengarkan contoh suara',
    'Dinle': 'Dengar',
    'Durdur': 'Berhenti',
    'Seçili sesle podcast oluştur': 'Buat podcast dengan suara terpilih',
    'Ses önizlemesi oynatılamadı.': 'Pratinjau suara tidak dapat diputar.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Detail yang kamu masukkan akan membantu membentuk alur buku yang khusus untukmu. Tulis bersama tokoh, tema utama buku, konflik, alur cerita, dan detail yang ingin kamu tonjolkan.'
  },
  it: {
    'Geri': 'Indietro',
    'Üretim için giriş gerekli': 'Accesso richiesto per la generazione',
    'Üretime devam etmek için lütfen giriş yapın.': 'Effettua il login per continuare la generazione.',
    'Şeker siyah': 'Nero zucchero',
    'Kitabınız yükleniyor': 'Il tuo libro si sta caricando',
    'Podcast oluştur': 'Crea podcast',
    'Önce sesi test et, sonra oluştur.': 'Prova prima la voce, poi crea.',
    'Podcast sesini seç': 'Scegli la voce del podcast',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Puoi ascoltare ogni voce nella lingua del libro e poi sceglierla.',
    'Seçildi': 'Selezionato',
    'Ses örneğini dinle': 'Ascolta l anteprima della voce',
    'Dinle': 'Ascolta',
    'Durdur': 'Ferma',
    'Seçili sesle podcast oluştur': 'Crea podcast con la voce selezionata',
    'Ses önizlemesi oynatılamadı.': 'Impossibile riprodurre l anteprima vocale.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'I dettagli che inserisci aiuteranno a creare una trama del libro su misura per te. Scrivi insieme i personaggi, il tema principale del libro, il conflitto, la trama e i dettagli su cui vuoi concentrarti.'
  },
  ja: {
    'Geri': '戻る',
    'Üretim için giriş gerekli': '生成にはログインが必要です',
    'Üretime devam etmek için lütfen giriş yapın.': '生成を続けるにはログインしてください。',
    'Şeker siyah': 'キャンディーブラック',
    'Kitabınız yükleniyor': 'あなたの本を読み込み中',
    'Podcast oluştur': 'ポッドキャストを作成',
    'Önce sesi test et, sonra oluştur.': 'まず声を試してから作成します。',
    'Podcast sesini seç': 'ポッドキャストの声を選択',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': '本の言語で各音声を聞いてから選べます。',
    'Seçildi': '選択済み',
    'Ses örneğini dinle': '音声サンプルを聞く',
    'Dinle': '聞く',
    'Durdur': '停止',
    'Seçili sesle podcast oluştur': '選択した声でポッドキャストを作成',
    'Ses önizlemesi oynatılamadı.': '音声プレビューを再生できませんでした。',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': '入力した詳細は、あなた向けの本のプロット作りに役立ちます。登場人物、本の中心テーマ、対立、筋書き、強調したい詳細をまとめて書いてください。'
  },
  ko: {
    'Geri': '뒤로',
    'Üretim için giriş gerekli': '생성을 하려면 로그인이 필요합니다',
    'Üretime devam etmek için lütfen giriş yapın.': '생성을 계속하려면 로그인해 주세요.',
    'Şeker siyah': '캔디 블랙',
    'Kitabınız yükleniyor': '책을 불러오는 중입니다',
    'Podcast oluştur': '팟캐스트 만들기',
    'Önce sesi test et, sonra oluştur.': '먼저 목소리를 들어 보고 만든다.',
    'Podcast sesini seç': '팟캐스트 목소리 선택',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': '책 언어로 각 목소리를 들어 본 뒤 선택할 수 있습니다.',
    'Seçildi': '선택됨',
    'Ses örneğini dinle': '음성 샘플 듣기',
    'Dinle': '듣기',
    'Durdur': '중지',
    'Seçili sesle podcast oluştur': '선택한 목소리로 팟캐스트 만들기',
    'Ses önizlemesi oynatılamadı.': '음성 미리보기를 재생할 수 없습니다.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': '입력한 디테일은 당신만의 책 줄거리를 만드는 데 도움이 됩니다. 등장인물, 책의 핵심 주제, 갈등, 전개, 그리고 강조하고 싶은 디테일을 함께 적어 주세요.'
  },
  nl: {
    'Geri': 'Terug',
    'Üretim için giriş gerekli': 'Inloggen is vereist voor genereren',
    'Üretime devam etmek için lütfen giriş yapın.': 'Log in om door te gaan met genereren.',
    'Şeker siyah': 'Snoepzwart',
    'Kitabınız yükleniyor': 'Je boek wordt geladen',
    'Podcast oluştur': 'Podcast maken',
    'Önce sesi test et, sonra oluştur.': 'Test eerst de stem en maak daarna de podcast.',
    'Podcast sesini seç': 'Kies podcaststem',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Je kunt elke stem in de boektaal beluisteren en daarna kiezen.',
    'Seçildi': 'Geselecteerd',
    'Ses örneğini dinle': 'Luister naar het stemvoorbeeld',
    'Dinle': 'Luisteren',
    'Durdur': 'Stop',
    'Seçili sesle podcast oluştur': 'Maak podcast met geselecteerde stem',
    'Ses önizlemesi oynatılamadı.': 'Stemvoorbeeld kon niet worden afgespeeld.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'De details die je invoert helpen een boekplot te maken dat bij jou past. Schrijf samen de personages, het hoofdthema van het boek, het conflict, de verhaallijn en de details waarop je je wilt richten.'
  },
  no: {
    'Geri': 'Tilbake',
    'Üretim için giriş gerekli': 'Innlogging kreves for generering',
    'Üretime devam etmek için lütfen giriş yapın.': 'Logg inn for a fortsette genereringen.',
    'Şeker siyah': 'Godtesvart',
    'Kitabınız yükleniyor': 'Boken din lastes inn',
    'Podcast oluştur': 'Lag podcast',
    'Önce sesi test et, sonra oluştur.': 'Test stemmen forst, og lag den deretter.',
    'Podcast sesini seç': 'Velg podcaststemme',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Du kan lytte til hver stemme pa bokens sprak og deretter velge.',
    'Seçildi': 'Valgt',
    'Ses örneğini dinle': 'Lytt til stemmeprove',
    'Dinle': 'Lytt',
    'Durdur': 'Stopp',
    'Seçili sesle podcast oluştur': 'Lag podcast med valgt stemme',
    'Ses önizlemesi oynatılamadı.': 'Kunne ikke spille av stemmeforhandsvisning.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Detaljene du skriver inn hjelper med a lage et bokplot som passer for deg. Skriv sammen karakterene, bokas hovedtema, konflikten, handlingsforlopet og detaljene du vil fokusere pa.'
  },
  pl: {
    'Geri': 'Wstecz',
    'Üretim için giriş gerekli': 'Logowanie wymagane do generowania',
    'Üretime devam etmek için lütfen giriş yapın.': 'Zaloguj sie, aby kontynuowac generowanie.',
    'Şeker siyah': 'Cukierkowa czerń',
    'Kitabınız yükleniyor': 'Twoja ksiazka sie laduje',
    'Podcast oluştur': 'Utwórz podcast',
    'Önce sesi test et, sonra oluştur.': 'Najpierw przetestuj głos, potem utwórz podcast.',
    'Podcast sesini seç': 'Wybierz głos podcastu',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Możesz posłuchać każdego głosu w języku książki, a potem wybrać.',
    'Seçildi': 'Wybrano',
    'Ses örneğini dinle': 'Posłuchaj próbki głosu',
    'Dinle': 'Słuchaj',
    'Durdur': 'Zatrzymaj',
    'Seçili sesle podcast oluştur': 'Utwórz podcast wybranym głosem',
    'Ses önizlemesi oynatılamadı.': 'Nie udało się odtworzyć podglądu głosu.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Wprowadzone szczegoly pomoga stworzyc fabule ksiazki dopasowana do Ciebie. Napisz razem bohaterow, glowny temat ksiazki, konflikt, przebieg fabuly i szczegoly, na ktorych chcesz sie skupic.'
  },
  'pt-BR': {
    'Geri': 'Voltar',
    'Üretim için giriş gerekli': 'Login necessario para gerar',
    'Üretime devam etmek için lütfen giriş yapın.': 'Faca login para continuar a geracao.',
    'Şeker siyah': 'Preto doce',
    'Kitabınız yükleniyor': 'Seu livro esta carregando',
    'Podcast oluştur': 'Criar podcast',
    'Önce sesi test et, sonra oluştur.': 'Teste a voz primeiro e depois crie.',
    'Podcast sesini seç': 'Escolha a voz do podcast',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Você pode ouvir cada voz no idioma do livro e depois escolher.',
    'Seçildi': 'Selecionado',
    'Ses örneğini dinle': 'Ouça a amostra de voz',
    'Dinle': 'Ouvir',
    'Durdur': 'Parar',
    'Seçili sesle podcast oluştur': 'Criar podcast com a voz selecionada',
    'Ses önizlemesi oynatılamadı.': 'Nao foi possivel reproduzir a previa da voz.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Os detalhes que voce inserir ajudarao a criar uma trama de livro feita para voce. Escreva juntos os personagens, o tema principal do livro, o conflito, a trama e os detalhes em que voce quer se concentrar.'
  },
  sv: {
    'Geri': 'Tillbaka',
    'Üretim için giriş gerekli': 'Inloggning kravs for generering',
    'Üretime devam etmek için lütfen giriş yapın.': 'Logga in for att fortsatta genereringen.',
    'Şeker siyah': 'Godissvart',
    'Kitabınız yükleniyor': 'Din bok laddas',
    'Podcast oluştur': 'Skapa podcast',
    'Önce sesi test et, sonra oluştur.': 'Testa rosten forst och skapa sedan.',
    'Podcast sesini seç': 'Valj podcastrost',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Du kan lyssna pa varje rost pa bokens sprak och sedan valja.',
    'Seçildi': 'Vald',
    'Ses örneğini dinle': 'Lyssna pa rostprov',
    'Dinle': 'Lyssna',
    'Durdur': 'Stoppa',
    'Seçili sesle podcast oluştur': 'Skapa podcast med vald rost',
    'Ses önizlemesi oynatılamadı.': 'Rostforhandsvisningen kunde inte spelas upp.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Detaljerna du skriver in hjalper till att skapa en bokintrig som passar dig. Skriv tillsammans karaktarerna, bokens huvudtema, konflikten, handlingen och de detaljer du vill fokusera pa.'
  },
  th: {
    'Geri': 'ย้อนกลับ',
    'Üretim için giriş gerekli': 'ต้องเข้าสู่ระบบเพื่อสร้าง',
    'Üretime devam etmek için lütfen giriş yapın.': 'โปรดเข้าสู่ระบบเพื่อสร้างต่อ',
    'Şeker siyah': 'ดำลูกกวาด',
    'Kitabınız yükleniyor': 'กำลังโหลดหนังสือของคุณ',
    'Podcast oluştur': 'สร้างพอดแคสต์',
    'Önce sesi test et, sonra oluştur.': 'ลองฟังเสียงก่อน แล้วค่อยสร้าง',
    'Podcast sesini seç': 'เลือกเสียงพอดแคสต์',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'คุณสามารถฟังแต่ละเสียงในภาษาของหนังสือแล้วค่อยเลือกได้',
    'Seçildi': 'เลือกแล้ว',
    'Ses örneğini dinle': 'ฟังตัวอย่างเสียง',
    'Dinle': 'ฟัง',
    'Durdur': 'หยุด',
    'Seçili sesle podcast oluştur': 'สร้างพอดแคสต์ด้วยเสียงที่เลือก',
    'Ses önizlemesi oynatılamadı.': 'ไม่สามารถเล่นตัวอย่างเสียงได้',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'รายละเอียดที่คุณกรอกจะช่วยสร้างโครงเรื่องหนังสือที่เหมาะกับคุณ เขียนตัวละคร ธีมหลักของหนังสือ ความขัดแย้ง โครงเรื่อง และรายละเอียดที่คุณอยากเน้นรวมกันได้เลย'
  },
  tr: {
    'Geri': 'Geri',
    'Üretim için giriş gerekli': 'Üretim için giriş gerekli',
    'Üretime devam etmek için lütfen giriş yapın.': 'Üretime devam etmek için lütfen giriş yapın.',
    'Şeker siyah': 'Şeker siyah',
    'Kitabınız yükleniyor': 'Kitabınız yükleniyor',
    'Podcast oluştur': 'Podcast oluştur',
    'Önce sesi test et, sonra oluştur.': 'Önce sesi test et, sonra oluştur.',
    'Podcast sesini seç': 'Podcast sesini seç',
    'Her sesi kitap dilinde dinleyip sonra seçebilirsin.': 'Her sesi kitap dilinde dinleyip sonra seçebilirsin.',
    'Seçildi': 'Seçildi',
    'Ses örneğini dinle': 'Ses örneğini dinle',
    'Dinle': 'Dinle',
    'Durdur': 'Durdur',
    'Seçili sesle podcast oluştur': 'Seçili sesle podcast oluştur',
    'Ses önizlemesi oynatılamadı.': 'Ses önizlemesi oynatılamadı.',
    'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın': 'Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın'
  }
};

for (const [language, translations] of Object.entries(UI_EXTRA_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

const PORTRAIT_UI_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: {
    'Portre Ekle': 'إضافة صورة شخصية',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'إضافة صورة شخصية اختيارية · +1 رصيد',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'إذا أضفت صورة شخصية، فسيصبح هذا الشخص الشخصية الرئيسية في الحكاية. إنشاء الحكاية المصورة يستخدم +1 رصيد.',
    'Ana karakter adı': 'اسم الشخصية الرئيسية',
    'Ana karakter adını yazın.': 'اكتب اسم الشخصية الرئيسية.',
    'Portreyi kaldır': 'إزالة الصورة الشخصية',
    'Portre görseli 16 MB sınırını aşıyor.': 'صورة البورتريه تتجاوز حد 16 ميغابايت.',
    'Portre hazırlanamadı.': 'تعذر تجهيز الصورة الشخصية.',
    'Portreyi Hazırla': 'تجهيز الصورة الشخصية',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'كلما كانت صورتك أوضح كانت جودة الصورة أفضل. ضع وجهك وشعرك بوضوح في الوسط.',
    'Portreyi Kullan': 'استخدام الصورة الشخصية',
    '+1 kredi': '+1 رصيد',
    'Örn: Aras': 'مثال: Aras'
  },
  da: {
    'Portre Ekle': 'Tilfoj portraet',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Portraet er valgfrit · +1 kredit',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Hvis du tilfojer et portraet, bliver personen eventyrets hovedperson. Visuel eventyrgenerering bruger +1 kredit.',
    'Ana karakter adı': 'Hovedpersonens navn',
    'Ana karakter adını yazın.': 'Skriv hovedpersonens navn.',
    'Portreyi kaldır': 'Fjern portraet',
    'Portre görseli 16 MB sınırını aşıyor.': 'Portraetbilledet overskrider graensen pa 16 MB.',
    'Portre hazırlanamadı.': 'Portraettet kunne ikke klargores.',
    'Portreyi Hazırla': 'Klargor portraet',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Jo tydeligere portraettet er, desto bedre bliver billedkvaliteten. Centrer ansigt og har klart.',
    'Portreyi Kullan': 'Brug portraet',
    '+1 kredi': '+1 kredit',
    'Örn: Aras': 'Fx: Aras'
  },
  de: {
    'Portre Ekle': 'Portrat hinzufugen',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Portrat ist optional · +1 Guthaben',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Wenn du ein Portrat hinzufugst, wird diese Person zur Hauptfigur des Marchens. Die Erstellung des visuellen Marchens nutzt +1 Guthaben.',
    'Ana karakter adı': 'Name der Hauptfigur',
    'Ana karakter adını yazın.': 'Gib den Namen der Hauptfigur ein.',
    'Portreyi kaldır': 'Portrat entfernen',
    'Portre görseli 16 MB sınırını aşıyor.': 'Das Portratbild uberschreitet die Grenze von 16 MB.',
    'Portre hazırlanamadı.': 'Das Portrat konnte nicht vorbereitet werden.',
    'Portreyi Hazırla': 'Portrat vorbereiten',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Je klarer dein Portrat ist, desto besser wird die Bildqualitat. Zentriere Gesicht und Haare deutlich.',
    'Portreyi Kullan': 'Portrat verwenden',
    '+1 kredi': '+1 Guthaben',
    'Örn: Aras': 'z. B.: Aras'
  },
  el: {
    'Portre Ekle': 'Προσθήκη πορτρέτου',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Η προσθήκη πορτρέτου είναι προαιρετική · +1 πίστωση',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Αν προσθέσετε πορτρέτο, αυτό το άτομο γίνεται ο κύριος χαρακτήρας του παραμυθιού. Η δημιουργία οπτικού παραμυθιού χρησιμοποιεί +1 πίστωση.',
    'Ana karakter adı': 'Όνομα κύριου χαρακτήρα',
    'Ana karakter adını yazın.': 'Γράψτε το όνομα του κύριου χαρακτήρα.',
    'Portreyi kaldır': 'Αφαίρεση πορτρέτου',
    'Portre görseli 16 MB sınırını aşıyor.': 'Η εικόνα πορτρέτου υπερβαίνει το όριο των 16 MB.',
    'Portre hazırlanamadı.': 'Δεν ήταν δυνατή η προετοιμασία του πορτρέτου.',
    'Portreyi Hazırla': 'Προετοιμασία πορτρέτου',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Όσο πιο καθαρό είναι το πορτρέτο σας, τόσο καλύτερη θα είναι η ποιότητα της εικόνας. Κεντράρετε καθαρά το πρόσωπο και τα μαλλιά σας.',
    'Portreyi Kullan': 'Χρήση πορτρέτου',
    '+1 kredi': '+1 πίστωση',
    'Örn: Aras': 'Π.χ.: Aras'
  },
  en: {
    'Portre Ekle': 'Add Portrait',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Adding a portrait is optional · +1 credit',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'If you add a portrait, this person becomes the main character of the fairy tale. Visual fairy tale generation uses +1 credit.',
    'Ana karakter adı': 'Main character name',
    'Ana karakter adını yazın.': 'Enter the main character name.',
    'Portreyi kaldır': 'Remove portrait',
    'Portre görseli 16 MB sınırını aşıyor.': 'Portrait image exceeds the 16 MB limit.',
    'Portre hazırlanamadı.': 'Portrait could not be prepared.',
    'Portreyi Hazırla': 'Prepare Portrait',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'The clearer your portrait is, the better your image quality will be. Center your face and hair clearly.',
    'Portreyi Kullan': 'Use Portrait',
    '+1 kredi': '+1 credit',
    'Örn: Aras': 'e.g. Aras'
  },
  es: {
    'Portre Ekle': 'Anadir retrato',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Anadir un retrato es opcional · +1 credito',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Si anades un retrato, esta persona sera el personaje principal del cuento. La generacion del cuento visual usa +1 credito.',
    'Ana karakter adı': 'Nombre del personaje principal',
    'Ana karakter adını yazın.': 'Escribe el nombre del personaje principal.',
    'Portreyi kaldır': 'Quitar retrato',
    'Portre görseli 16 MB sınırını aşıyor.': 'La imagen del retrato supera el limite de 16 MB.',
    'Portre hazırlanamadı.': 'No se pudo preparar el retrato.',
    'Portreyi Hazırla': 'Preparar retrato',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Cuanto mas claro sea tu retrato, mejor sera la calidad de la imagen. Centra claramente tu rostro y tu cabello.',
    'Portreyi Kullan': 'Usar retrato',
    '+1 kredi': '+1 credito',
    'Örn: Aras': 'Ej.: Aras'
  },
  fi: {
    'Portre Ekle': 'Lisaa muotokuva',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Muotokuvan lisaaminen on valinnaista · +1 krediitti',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Jos lisäät muotokuvan, tästä henkilöstä tulee sadun päähenkilö. Kuvitetun sadun luonti käyttää +1 krediitin.',
    'Ana karakter adı': 'Päähenkilön nimi',
    'Ana karakter adını yazın.': 'Kirjoita päähenkilön nimi.',
    'Portreyi kaldır': 'Poista muotokuva',
    'Portre görseli 16 MB sınırını aşıyor.': 'Muotokuvan kuva ylittää 16 Mt:n rajan.',
    'Portre hazırlanamadı.': 'Muotokuvaa ei voitu valmistella.',
    'Portreyi Hazırla': 'Valmistele muotokuva',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Mitä selkeämpi muotokuva on, sitä parempi kuvanlaatu on. Keskitä kasvot ja hiukset selvästi.',
    'Portreyi Kullan': 'Käytä muotokuvaa',
    '+1 kredi': '+1 krediitti',
    'Örn: Aras': 'Esim.: Aras'
  },
  fr: {
    'Portre Ekle': 'Ajouter un portrait',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Ajouter un portrait est facultatif · +1 credit',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Si vous ajoutez un portrait, cette personne devient le personnage principal du conte. La generation du conte visuel utilise +1 credit.',
    'Ana karakter adı': 'Nom du personnage principal',
    'Ana karakter adını yazın.': 'Saisissez le nom du personnage principal.',
    'Portreyi kaldır': 'Supprimer le portrait',
    'Portre görseli 16 MB sınırını aşıyor.': "L'image du portrait depasse la limite de 16 Mo.",
    'Portre hazırlanamadı.': "Le portrait n'a pas pu etre prepare.",
    'Portreyi Hazırla': 'Preparer le portrait',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Plus votre portrait est net, meilleure sera la qualite de l’image. Centrez clairement votre visage et vos cheveux.',
    'Portreyi Kullan': 'Utiliser le portrait',
    '+1 kredi': '+1 credit',
    'Örn: Aras': 'Ex. : Aras'
  },
  hi: {
    'Portre Ekle': 'पोर्ट्रेट जोड़ें',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'पोर्ट्रेट जोड़ना वैकल्पिक है · +1 क्रेडिट',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'यदि आप पोर्ट्रेट जोड़ते हैं, तो यह व्यक्ति परी कथा का मुख्य पात्र बन जाएगा। दृश्य परी कथा बनाने में +1 क्रेडिट लगेगा।',
    'Ana karakter adı': 'मुख्य पात्र का नाम',
    'Ana karakter adını yazın.': 'मुख्य पात्र का नाम लिखें।',
    'Portreyi kaldır': 'पोर्ट्रेट हटाएं',
    'Portre görseli 16 MB sınırını aşıyor.': 'पोर्ट्रेट छवि 16 MB सीमा से अधिक है।',
    'Portre hazırlanamadı.': 'पोर्ट्रेट तैयार नहीं किया जा सका।',
    'Portreyi Hazırla': 'पोर्ट्रेट तैयार करें',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'आपका पोर्ट्रेट जितना स्पष्ट होगा, छवि की गुणवत्ता उतनी बेहतर होगी। अपना चेहरा और बाल साफ़ तौर पर बीच में रखें।',
    'Portreyi Kullan': 'पोर्ट्रेट इस्तेमाल करें',
    '+1 kredi': '+1 क्रेडिट',
    'Örn: Aras': 'जैसे: Aras'
  },
  id: {
    'Portre Ekle': 'Tambahkan potret',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Menambahkan potret bersifat opsional · +1 kredit',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Jika Anda menambahkan potret, orang ini akan menjadi karakter utama dongeng. Pembuatan dongeng visual memakai +1 kredit.',
    'Ana karakter adı': 'Nama karakter utama',
    'Ana karakter adını yazın.': 'Masukkan nama karakter utama.',
    'Portreyi kaldır': 'Hapus potret',
    'Portre görseli 16 MB sınırını aşıyor.': 'Gambar potret melebihi batas 16 MB.',
    'Portre hazırlanamadı.': 'Potret tidak dapat disiapkan.',
    'Portreyi Hazırla': 'Siapkan Potret',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Semakin jelas potret Anda, semakin baik kualitas gambarnya. Pusatkan wajah dan rambut Anda dengan jelas.',
    'Portreyi Kullan': 'Gunakan Potret',
    '+1 kredi': '+1 kredit',
    'Örn: Aras': 'Mis.: Aras'
  },
  it: {
    'Portre Ekle': 'Aggiungi ritratto',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Aggiungere un ritratto e facoltativo · +1 credito',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Se aggiungi un ritratto, questa persona diventera il personaggio principale della fiaba. La generazione della fiaba visiva usa +1 credito.',
    'Ana karakter adı': 'Nome del personaggio principale',
    'Ana karakter adını yazın.': 'Inserisci il nome del personaggio principale.',
    'Portreyi kaldır': 'Rimuovi ritratto',
    'Portre görseli 16 MB sınırını aşıyor.': "L'immagine del ritratto supera il limite di 16 MB.",
    'Portre hazırlanamadı.': 'Non e stato possibile preparare il ritratto.',
    'Portreyi Hazırla': 'Prepara ritratto',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Piu il ritratto e nitido, migliore sara la qualita dell’immagine. Centra chiaramente viso e capelli.',
    'Portreyi Kullan': 'Usa ritratto',
    '+1 kredi': '+1 credito',
    'Örn: Aras': 'Es.: Aras'
  },
  ja: {
    'Portre Ekle': 'ポートレートを追加',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'ポートレートの追加は任意です · +1クレジット',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'ポートレートを追加すると、この人物が童話のメインキャラクターになります。ビジュアル童話の生成には+1クレジットを使用します。',
    'Ana karakter adı': 'メインキャラクター名',
    'Ana karakter adını yazın.': 'メインキャラクター名を入力してください。',
    'Portreyi kaldır': 'ポートレートを削除',
    'Portre görseli 16 MB sınırını aşıyor.': 'ポートレート画像が16 MBの上限を超えています。',
    'Portre hazırlanamadı.': 'ポートレートを準備できませんでした。',
    'Portreyi Hazırla': 'ポートレートを準備',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'ポートレートがはっきりしているほど、画像の品質が高くなります。顔と髪がはっきり見えるよう中央に合わせてください。',
    'Portreyi Kullan': 'ポートレートを使用',
    '+1 kredi': '+1クレジット',
    'Örn: Aras': '例: Aras'
  },
  ko: {
    'Portre Ekle': '초상화 추가',
    'Portre eklemek isteğe bağlıdır · +1 kredi': '초상화 추가는 선택 사항입니다 · +1 크레딧',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': '초상화를 추가하면 이 사람이 동화의 주인공이 됩니다. 비주얼 동화 생성에는 +1 크레딧이 사용됩니다.',
    'Ana karakter adı': '주인공 이름',
    'Ana karakter adını yazın.': '주인공 이름을 입력하세요.',
    'Portreyi kaldır': '초상화 제거',
    'Portre görseli 16 MB sınırını aşıyor.': '초상화 이미지가 16 MB 제한을 초과합니다.',
    'Portre hazırlanamadı.': '초상화를 준비할 수 없습니다.',
    'Portreyi Hazırla': '초상화 준비',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': '초상화가 선명할수록 이미지 품질이 좋아집니다. 얼굴과 머리카락이 잘 보이도록 중앙에 맞춰 주세요.',
    'Portreyi Kullan': '초상화 사용',
    '+1 kredi': '+1 크레딧',
    'Örn: Aras': '예: Aras'
  },
  nl: {
    'Portre Ekle': 'Portret toevoegen',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Een portret toevoegen is optioneel · +1 credit',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Als je een portret toevoegt, wordt deze persoon de hoofdpersoon van het sprookje. Het maken van een visueel sprookje gebruikt +1 credit.',
    'Ana karakter adı': 'Naam hoofdpersonage',
    'Ana karakter adını yazın.': 'Voer de naam van het hoofdpersonage in.',
    'Portreyi kaldır': 'Portret verwijderen',
    'Portre görseli 16 MB sınırını aşıyor.': 'De portretafbeelding overschrijdt de limiet van 16 MB.',
    'Portre hazırlanamadı.': 'Het portret kon niet worden voorbereid.',
    'Portreyi Hazırla': 'Portret voorbereiden',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Hoe duidelijker je portret is, hoe beter de beeldkwaliteit wordt. Centreer je gezicht en haar duidelijk.',
    'Portreyi Kullan': 'Portret gebruiken',
    '+1 kredi': '+1 credit',
    'Örn: Aras': 'Bijv.: Aras'
  },
  no: {
    'Portre Ekle': 'Legg til portrett',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'A legge til portrett er valgfritt · +1 kreditt',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Hvis du legger til et portrett, blir denne personen eventyrets hovedperson. Generering av visuelt eventyr bruker +1 kreditt.',
    'Ana karakter adı': 'Hovedpersonens navn',
    'Ana karakter adını yazın.': 'Skriv navnet pa hovedpersonen.',
    'Portreyi kaldır': 'Fjern portrett',
    'Portre görseli 16 MB sınırını aşıyor.': 'Portrettbildet overskrider grensen pa 16 MB.',
    'Portre hazırlanamadı.': 'Portrettet kunne ikke klargjores.',
    'Portreyi Hazırla': 'Klargjor portrett',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Jo tydeligere portrettet er, desto bedre blir bildekvaliteten. Sentrer ansikt og har tydelig.',
    'Portreyi Kullan': 'Bruk portrett',
    '+1 kredi': '+1 kreditt',
    'Örn: Aras': 'F.eks.: Aras'
  },
  pl: {
    'Portre Ekle': 'Dodaj portret',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Dodanie portretu jest opcjonalne · +1 kredyt',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Jesli dodasz portret, ta osoba stanie sie glowna postacia bajki. Generowanie bajki wizualnej zuzywa +1 kredyt.',
    'Ana karakter adı': 'Imie glownej postaci',
    'Ana karakter adını yazın.': 'Wpisz imie glownej postaci.',
    'Portreyi kaldır': 'Usun portret',
    'Portre görseli 16 MB sınırını aşıyor.': 'Obraz portretu przekracza limit 16 MB.',
    'Portre hazırlanamadı.': 'Nie udalo sie przygotowac portretu.',
    'Portreyi Hazırla': 'Przygotuj portret',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Im wyrazniejszy portret, tym lepsza bedzie jakosc obrazu. Wyraznie wycentruj twarz i wlosy.',
    'Portreyi Kullan': 'Uzyj portretu',
    '+1 kredi': '+1 kredyt',
    'Örn: Aras': 'Np.: Aras'
  },
  'pt-BR': {
    'Portre Ekle': 'Adicionar retrato',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Adicionar retrato e opcional · +1 credito',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Se voce adicionar um retrato, essa pessoa sera o personagem principal do conto. A geracao do conto visual usa +1 credito.',
    'Ana karakter adı': 'Nome do personagem principal',
    'Ana karakter adını yazın.': 'Digite o nome do personagem principal.',
    'Portreyi kaldır': 'Remover retrato',
    'Portre görseli 16 MB sınırını aşıyor.': 'A imagem do retrato excede o limite de 16 MB.',
    'Portre hazırlanamadı.': 'Nao foi possivel preparar o retrato.',
    'Portreyi Hazırla': 'Preparar retrato',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Quanto mais claro for o seu retrato, melhor sera a qualidade da imagem. Centralize bem o rosto e o cabelo.',
    'Portreyi Kullan': 'Usar retrato',
    '+1 kredi': '+1 credito',
    'Örn: Aras': 'Ex.: Aras'
  },
  sv: {
    'Portre Ekle': 'Lagg till portratt',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Att lagga till portratt ar valfritt · +1 kredit',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Om du lagger till ett portratt blir personen sagans huvudperson. Generering av visuell saga anvander +1 kredit.',
    'Ana karakter adı': 'Huvudpersonens namn',
    'Ana karakter adını yazın.': 'Skriv huvudpersonens namn.',
    'Portreyi kaldır': 'Ta bort portratt',
    'Portre görseli 16 MB sınırını aşıyor.': 'Portrattbilden overskrider gransen pa 16 MB.',
    'Portre hazırlanamadı.': 'Portrattet kunde inte forberedas.',
    'Portreyi Hazırla': 'Forbered portratt',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Ju tydligare portrattet ar, desto battre blir bildkvaliteten. Centrera ansikte och har tydligt.',
    'Portreyi Kullan': 'Anvand portratt',
    '+1 kredi': '+1 kredit',
    'Örn: Aras': 'T.ex.: Aras'
  },
  th: {
    'Portre Ekle': 'เพิ่มภาพบุคคล',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'การเพิ่มภาพบุคคลเป็นทางเลือก · +1 เครดิต',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'หากคุณเพิ่มภาพบุคคล คนนี้จะเป็นตัวละครหลักของนิทาน การสร้างนิทานภาพใช้ +1 เครดิต',
    'Ana karakter adı': 'ชื่อตัวละครหลัก',
    'Ana karakter adını yazın.': 'กรอกชื่อตัวละครหลัก',
    'Portreyi kaldır': 'ลบภาพบุคคล',
    'Portre görseli 16 MB sınırını aşıyor.': 'ภาพบุคคลมีขนาดเกินขีดจำกัด 16 MB',
    'Portre hazırlanamadı.': 'ไม่สามารถเตรียมภาพบุคคลได้',
    'Portreyi Hazırla': 'เตรียมภาพบุคคล',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'ยิ่งภาพบุคคลชัดเท่าไร คุณภาพภาพก็จะยิ่งดีขึ้น จัดใบหน้าและผมให้อยู่กึ่งกลางอย่างชัดเจน',
    'Portreyi Kullan': 'ใช้ภาพบุคคล',
    '+1 kredi': '+1 เครดิต',
    'Örn: Aras': 'เช่น: Aras'
  },
  tr: {
    'Portre Ekle': 'Portre Ekle',
    'Portre eklemek isteğe bağlıdır · +1 kredi': 'Portre eklemek isteğe bağlıdır · +1 kredi',
    'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.': 'Portre eklerseniz bu kişi masalın ana karakteri olur. Görsel masal üretimi +1 kredi kullanır.',
    'Ana karakter adı': 'Ana karakter adı',
    'Ana karakter adını yazın.': 'Ana karakter adını yazın.',
    'Portreyi kaldır': 'Portreyi kaldır',
    'Portre görseli 16 MB sınırını aşıyor.': 'Portre görseli 16 MB sınırını aşıyor.',
    'Portre hazırlanamadı.': 'Portre hazırlanamadı.',
    'Portreyi Hazırla': 'Portreyi Hazırla',
    'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.': 'Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.',
    'Portreyi Kullan': 'Portreyi Kullan',
    '+1 kredi': '+1 kredi',
    'Örn: Aras': 'Örn: Aras'
  }
};

for (const [language, translations] of Object.entries(PORTRAIT_UI_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

const ACTION_UI_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: {
    'Ekle': 'إضافة',
    'Değiştir': 'تغيير',
    'Oluştur': 'إنشاء',
    'Satın Al': 'شراء',
    'PDF İndir': 'تنزيل PDF',
    'EPUB İndir': 'تنزيل EPUB',
    'PDF arka planı': 'خلفية PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'إذا أضفت صورة شخصية، فسيصبح هذا الشخص الشخصية الرئيسية في الكتاب. سيتم تكييف الصور الناتجة مع النمط نفسه وسيتم استخدام +1 رصيد.'
  },
  da: {
    'Ekle': 'Tilføj',
    'Değiştir': 'Skift',
    'Oluştur': 'Opret',
    'Satın Al': 'Køb',
    'PDF İndir': 'Download PDF',
    'EPUB İndir': 'Download EPUB',
    'PDF arka planı': 'PDF-baggrund',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Hvis du tilføjer et portræt, bliver personen bogens hovedperson. De genererede billeder tilpasses samme stil og bruger +1 kredit.'
  },
  de: {
    'Ekle': 'Hinzufügen',
    'Değiştir': 'Ändern',
    'Oluştur': 'Erstellen',
    'Satın Al': 'Kaufen',
    'PDF İndir': 'PDF herunterladen',
    'EPUB İndir': 'EPUB herunterladen',
    'PDF arka planı': 'PDF-Hintergrund',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Wenn du ein Porträt hinzufügst, wird diese Person zur Hauptfigur des Buches. Die erzeugten Bilder werden im selben Stil angepasst und verbrauchen +1 Guthaben.'
  },
  el: {
    'Ekle': 'Προσθήκη',
    'Değiştir': 'Αλλαγή',
    'Oluştur': 'Δημιουργία',
    'Satın Al': 'Αγορά',
    'PDF İndir': 'Λήψη PDF',
    'EPUB İndir': 'Λήψη EPUB',
    'PDF arka planı': 'Φόντο PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Αν προσθέσετε πορτρέτο, αυτό το άτομο γίνεται ο κύριος χαρακτήρας του βιβλίου. Οι παραγόμενες εικόνες προσαρμόζονται στο ίδιο στυλ και χρησιμοποιούν +1 πίστωση.'
  },
  en: {
    'Ekle': 'Add',
    'Değiştir': 'Change',
    'Oluştur': 'Create',
    'Satın Al': 'Buy',
    'PDF İndir': 'Download PDF',
    'EPUB İndir': 'Download EPUB',
    'PDF arka planı': 'PDF background',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'If you add a portrait, this person becomes the book main character. Generated images will match the same style and use +1 credit.'
  },
  es: {
    'Ekle': 'Añadir',
    'Değiştir': 'Cambiar',
    'Oluştur': 'Crear',
    'Satın Al': 'Comprar',
    'PDF İndir': 'Descargar PDF',
    'EPUB İndir': 'Descargar EPUB',
    'PDF arka planı': 'Fondo del PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Si añades un retrato, esta persona será el personaje principal del libro. Las imágenes generadas se adaptarán al mismo estilo y usarán +1 crédito.'
  },
  fi: {
    'Ekle': 'Lisää',
    'Değiştir': 'Vaihda',
    'Oluştur': 'Luo',
    'Satın Al': 'Osta',
    'PDF İndir': 'Lataa PDF',
    'EPUB İndir': 'Lataa EPUB',
    'PDF arka planı': 'PDF-tausta',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Jos lisäät muotokuvan, tästä henkilöstä tulee kirjan päähenkilö. Luodut kuvat sovitetaan samaan tyyliin ja käyttävät +1 krediitin.'
  },
  fr: {
    'Ekle': 'Ajouter',
    'Değiştir': 'Changer',
    'Oluştur': 'Créer',
    'Satın Al': 'Acheter',
    'PDF İndir': 'Télécharger le PDF',
    'EPUB İndir': "Télécharger l'EPUB",
    'PDF arka planı': 'Fond du PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Si vous ajoutez un portrait, cette personne devient le personnage principal du livre. Les images générées seront adaptées au même style et utiliseront +1 crédit.'
  },
  hi: {
    'Ekle': 'जोड़ें',
    'Değiştir': 'बदलें',
    'Oluştur': 'बनाएँ',
    'Satın Al': 'खरीदें',
    'PDF İndir': 'PDF डाउनलोड करें',
    'EPUB İndir': 'EPUB डाउनलोड करें',
    'PDF arka planı': 'PDF पृष्ठभूमि',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'यदि आप पोर्ट्रेट जोड़ते हैं, तो यह व्यक्ति पुस्तक का मुख्य पात्र बन जाएगा। बनाई गई छवियां उसी शैली में ढाली जाएंगी और +1 क्रेडिट इस्तेमाल करेंगी।'
  },
  id: {
    'Ekle': 'Tambah',
    'Değiştir': 'Ubah',
    'Oluştur': 'Buat',
    'Satın Al': 'Beli',
    'PDF İndir': 'Unduh PDF',
    'EPUB İndir': 'Unduh EPUB',
    'PDF arka planı': 'Latar PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Jika Anda menambahkan potret, orang ini akan menjadi karakter utama buku. Gambar yang dibuat akan disesuaikan dengan gaya yang sama dan memakai +1 kredit.'
  },
  it: {
    'Ekle': 'Aggiungi',
    'Değiştir': 'Cambia',
    'Oluştur': 'Crea',
    'Satın Al': 'Acquista',
    'PDF İndir': 'Scarica PDF',
    'EPUB İndir': 'Scarica EPUB',
    'PDF arka planı': 'Sfondo PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Se aggiungi un ritratto, questa persona diventa il personaggio principale del libro. Le immagini generate saranno adattate allo stesso stile e useranno +1 credito.'
  },
  ja: {
    'Ekle': '追加',
    'Değiştir': '変更',
    'Oluştur': '作成',
    'Satın Al': '購入',
    'PDF İndir': 'PDFをダウンロード',
    'EPUB İndir': 'EPUBをダウンロード',
    'PDF arka planı': 'PDFの背景',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'ポートレートを追加すると、この人物が本のメインキャラクターになります。生成される画像は同じスタイルに調整され、+1クレジットを使用します。'
  },
  ko: {
    'Ekle': '추가',
    'Değiştir': '변경',
    'Oluştur': '만들기',
    'Satın Al': '구매',
    'PDF İndir': 'PDF 다운로드',
    'EPUB İndir': 'EPUB 다운로드',
    'PDF arka planı': 'PDF 배경',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': '초상화를 추가하면 이 사람이 책의 주인공이 됩니다. 생성된 이미지는 같은 스타일로 맞춰지며 +1 크레딧이 사용됩니다.'
  },
  nl: {
    'Ekle': 'Toevoegen',
    'Değiştir': 'Wijzigen',
    'Oluştur': 'Maken',
    'Satın Al': 'Kopen',
    'PDF İndir': 'PDF downloaden',
    'EPUB İndir': 'EPUB downloaden',
    'PDF arka planı': 'PDF-achtergrond',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Als je een portret toevoegt, wordt deze persoon de hoofdpersoon van het boek. Gegenereerde afbeeldingen worden in dezelfde stijl aangepast en gebruiken +1 credit.'
  },
  no: {
    'Ekle': 'Legg til',
    'Değiştir': 'Endre',
    'Oluştur': 'Opprett',
    'Satın Al': 'Kjøp',
    'PDF İndir': 'Last ned PDF',
    'EPUB İndir': 'Last ned EPUB',
    'PDF arka planı': 'PDF-bakgrunn',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Hvis du legger til et portrett, blir denne personen hovedpersonen i boken. Genererte bilder tilpasses samme stil og bruker +1 kreditt.'
  },
  pl: {
    'Ekle': 'Dodaj',
    'Değiştir': 'Zmień',
    'Oluştur': 'Utwórz',
    'Satın Al': 'Kup',
    'PDF İndir': 'Pobierz PDF',
    'EPUB İndir': 'Pobierz EPUB',
    'PDF arka planı': 'Tło PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Jeśli dodasz portret, ta osoba stanie się główną postacią książki. Wygenerowane obrazy zostaną dopasowane do tego samego stylu i zużyją +1 kredyt.'
  },
  'pt-BR': {
    'Ekle': 'Adicionar',
    'Değiştir': 'Alterar',
    'Oluştur': 'Criar',
    'Satın Al': 'Comprar',
    'PDF İndir': 'Baixar PDF',
    'EPUB İndir': 'Baixar EPUB',
    'PDF arka planı': 'Fundo do PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Se você adicionar um retrato, essa pessoa será o personagem principal do livro. As imagens geradas serão adaptadas ao mesmo estilo e usarão +1 crédito.'
  },
  sv: {
    'Ekle': 'Lägg till',
    'Değiştir': 'Ändra',
    'Oluştur': 'Skapa',
    'Satın Al': 'Köp',
    'PDF İndir': 'Ladda ner PDF',
    'EPUB İndir': 'Ladda ner EPUB',
    'PDF arka planı': 'PDF-bakgrund',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Om du lägger till ett porträtt blir personen bokens huvudperson. Genererade bilder anpassas till samma stil och använder +1 kredit.'
  },
  th: {
    'Ekle': 'เพิ่ม',
    'Değiştir': 'เปลี่ยน',
    'Oluştur': 'สร้าง',
    'Satın Al': 'ซื้อ',
    'PDF İndir': 'ดาวน์โหลด PDF',
    'EPUB İndir': 'ดาวน์โหลด EPUB',
    'PDF arka planı': 'พื้นหลัง PDF',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'หากคุณเพิ่มภาพบุคคล คนนี้จะเป็นตัวละครหลักของหนังสือ ภาพที่สร้างจะปรับให้เข้ากับสไตล์เดียวกันและใช้ +1 เครดิต'
  },
  tr: {
    'Ekle': 'Ekle',
    'Değiştir': 'Değiştir',
    'Oluştur': 'Oluştur',
    'Satın Al': 'Satın Al',
    'PDF İndir': 'PDF İndir',
    'EPUB İndir': 'EPUB İndir',
    'PDF arka planı': 'PDF arka planı',
    'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.': 'Portre eklerseniz bu kişi kitabın ana karakteri olur. Üretilen görsellerde aynı stile uyarlanır ve +1 kredi kullanır.'
  }
};

for (const [language, translations] of Object.entries(ACTION_UI_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

const FAIRY_TALE_AGE_UI_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: {
    '1-6 Yaş': '1-6 سنوات',
    '7+ Yaş': '7 سنوات فأكثر'
  },
  da: {
    '1-6 Yaş': '1-6 år',
    '7+ Yaş': '7+ år'
  },
  de: {
    '1-6 Yaş': '1-6 Jahre',
    '7+ Yaş': '7+ Jahre'
  },
  el: {
    '1-6 Yaş': '1-6 ετών',
    '7+ Yaş': '7+ ετών'
  },
  en: {
    '1-6 Yaş': 'Ages 1-6',
    '7+ Yaş': 'Ages 7+'
  },
  es: {
    '1-6 Yaş': '1-6 años',
    '7+ Yaş': '7+ años'
  },
  fi: {
    '1-6 Yaş': '1-6 vuotta',
    '7+ Yaş': '7+ vuotta'
  },
  fr: {
    '1-6 Yaş': '1-6 ans',
    '7+ Yaş': '7 ans et plus'
  },
  hi: {
    '1-6 Yaş': '1-6 वर्ष',
    '7+ Yaş': '7+ वर्ष'
  },
  id: {
    '1-6 Yaş': '1-6 tahun',
    '7+ Yaş': '7+ tahun'
  },
  it: {
    '1-6 Yaş': '1-6 anni',
    '7+ Yaş': '7+ anni'
  },
  ja: {
    '1-6 Yaş': '1～6歳',
    '7+ Yaş': '7歳以上'
  },
  ko: {
    '1-6 Yaş': '1-6세',
    '7+ Yaş': '7세 이상'
  },
  nl: {
    '1-6 Yaş': '1-6 jaar',
    '7+ Yaş': '7+ jaar'
  },
  no: {
    '1-6 Yaş': '1-6 år',
    '7+ Yaş': '7+ år'
  },
  pl: {
    '1-6 Yaş': '1-6 lat',
    '7+ Yaş': '7+ lat'
  },
  'pt-BR': {
    '1-6 Yaş': '1-6 anos',
    '7+ Yaş': '7+ anos'
  },
  sv: {
    '1-6 Yaş': '1-6 år',
    '7+ Yaş': '7+ år'
  },
  th: {
    '1-6 Yaş': '1-6 ปี',
    '7+ Yaş': '7+ ปี'
  },
  tr: {
    '1-6 Yaş': '1-6 Yaş',
    '7+ Yaş': '7+ Yaş'
  }
};

for (const [language, translations] of Object.entries(FAIRY_TALE_AGE_UI_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

const CREATE_CONFIRM_UI_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: {
    'Fortale oluşturulsun mu?': 'هل تريد إنشاء Fortale؟',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'سيتم إعداد Fortale جديد بناءً على اختياراتك. راجع الملخص قبل البدء.',
    'Kitap Türü': 'نوع الكتاب',
    'Alt Tür': 'النوع الفرعي',
    'Final': 'النهاية',
    'Yaş Grubu': 'الفئة العمرية',
    'Kitap Dili': 'لغة الكتاب',
    'Kurgu Modu': 'وضع الحبكة',
    'Kitabın Adı': 'اسم الكتاب',
    'Hikayenin Zamanı': 'زمن القصة',
    'Hikayenin Mekanı': 'مكان القصة',
    'Otomatik kurgu': 'حبكة تلقائية',
    'Detaylı kurgu': 'حبكة مفصلة',
    'Portre': 'صورة شخصية',
    'Portre eklendi': 'تمت إضافة صورة شخصية',
    'Portre eklenmedi': 'لم تتم إضافة صورة شخصية',
    'Belirtilmedi': 'غير محدد',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'سيستخدم هذا الإجراء {{creditCount}} رصيدًا.'
  },
  da: {
    'Fortale oluşturulsun mu?': 'Skal Fortale oprettes?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'En ny Fortale forberedes ud fra dine valg. Gennemgå oversigten, før du starter.',
    'Kitap Türü': 'Bogtype',
    'Alt Tür': 'Undergenre',
    'Final': 'Slutning',
    'Yaş Grubu': 'Aldersgruppe',
    'Kitap Dili': 'Bogens sprog',
    'Kurgu Modu': 'Plottilstand',
    'Kitabın Adı': 'Bogens titel',
    'Hikayenin Zamanı': 'Historiens tid',
    'Hikayenin Mekanı': 'Historiens sted',
    'Otomatik kurgu': 'Automatisk plot',
    'Detaylı kurgu': 'Detaljeret plot',
    'Portre': 'Portræt',
    'Portre eklendi': 'Portræt tilføjet',
    'Portre eklenmedi': 'Intet portræt tilføjet',
    'Belirtilmedi': 'Ikke angivet',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Denne handling bruger {{creditCount}} kreditter.'
  },
  de: {
    'Fortale oluşturulsun mu?': 'Fortale erstellen?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Auf Basis deiner Auswahl wird ein neues Fortale vorbereitet. Prüfe vor dem Start die Zusammenfassung.',
    'Kitap Türü': 'Buchtyp',
    'Alt Tür': 'Untergenre',
    'Final': 'Ende',
    'Yaş Grubu': 'Altersgruppe',
    'Kitap Dili': 'Buchsprache',
    'Kurgu Modu': 'Handlungsmodus',
    'Kitabın Adı': 'Buchtitel',
    'Hikayenin Zamanı': 'Zeit der Geschichte',
    'Hikayenin Mekanı': 'Ort der Geschichte',
    'Otomatik kurgu': 'Automatische Handlung',
    'Detaylı kurgu': 'Detaillierte Handlung',
    'Portre': 'Porträt',
    'Portre eklendi': 'Porträt hinzugefügt',
    'Portre eklenmedi': 'Kein Porträt hinzugefügt',
    'Belirtilmedi': 'Nicht angegeben',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Für diesen Vorgang werden {{creditCount}} Credits verwendet.'
  },
  el: {
    'Fortale oluşturulsun mu?': 'Να δημιουργηθεί το Fortale;',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Θα ετοιμαστεί ένα νέο Fortale με βάση τις επιλογές σας. Ελέγξτε τη σύνοψη πριν ξεκινήσετε.',
    'Kitap Türü': 'Τύπος βιβλίου',
    'Alt Tür': 'Υποείδος',
    'Final': 'Τελικό',
    'Yaş Grubu': 'Ηλικιακή ομάδα',
    'Kitap Dili': 'Γλώσσα βιβλίου',
    'Kurgu Modu': 'Λειτουργία πλοκής',
    'Kitabın Adı': 'Τίτλος βιβλίου',
    'Hikayenin Zamanı': 'Χρόνος ιστορίας',
    'Hikayenin Mekanı': 'Τόπος ιστορίας',
    'Otomatik kurgu': 'Αυτόματη πλοκή',
    'Detaylı kurgu': 'Λεπτομερής πλοκή',
    'Portre': 'Πορτρέτο',
    'Portre eklendi': 'Προστέθηκε πορτρέτο',
    'Portre eklenmedi': 'Δεν προστέθηκε πορτρέτο',
    'Belirtilmedi': 'Δεν ορίστηκε',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Αυτή η ενέργεια θα χρησιμοποιήσει {{creditCount}} πιστώσεις.'
  },
  en: {
    'Fortale oluşturulsun mu?': 'Create this Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'A new Fortale will be prepared from your selections. Review the summary before starting.',
    'Kitap Türü': 'Book type',
    'Alt Tür': 'Subgenre',
    'Final': 'Ending',
    'Yaş Grubu': 'Age group',
    'Kitap Dili': 'Book language',
    'Kurgu Modu': 'Story mode',
    'Kitabın Adı': 'Book title',
    'Hikayenin Zamanı': 'Story time',
    'Hikayenin Mekanı': 'Story setting',
    'Otomatik kurgu': 'Automatic story',
    'Detaylı kurgu': 'Detailed story',
    'Portre': 'Portrait',
    'Portre eklendi': 'Portrait added',
    'Portre eklenmedi': 'No portrait added',
    'Belirtilmedi': 'Not specified',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'This action will use {{creditCount}} credits.'
  },
  es: {
    'Fortale oluşturulsun mu?': '¿Crear este Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Se preparará un nuevo Fortale según tus selecciones. Revisa el resumen antes de empezar.',
    'Kitap Türü': 'Tipo de libro',
    'Alt Tür': 'Subgénero',
    'Final': 'Final',
    'Yaş Grubu': 'Grupo de edad',
    'Kitap Dili': 'Idioma del libro',
    'Kurgu Modu': 'Modo de trama',
    'Kitabın Adı': 'Título del libro',
    'Hikayenin Zamanı': 'Tiempo de la historia',
    'Hikayenin Mekanı': 'Lugar de la historia',
    'Otomatik kurgu': 'Trama automática',
    'Detaylı kurgu': 'Trama detallada',
    'Portre': 'Retrato',
    'Portre eklendi': 'Retrato añadido',
    'Portre eklenmedi': 'Sin retrato añadido',
    'Belirtilmedi': 'No especificado',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Esta acción usará {{creditCount}} créditos.'
  },
  fi: {
    'Fortale oluşturulsun mu?': 'Luodaanko tämä Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Uusi Fortale valmistellaan valintojesi perusteella. Tarkista yhteenveto ennen aloittamista.',
    'Kitap Türü': 'Kirjatyyppi',
    'Alt Tür': 'Alalaji',
    'Final': 'Loppu',
    'Yaş Grubu': 'Ikäryhmä',
    'Kitap Dili': 'Kirjan kieli',
    'Kurgu Modu': 'Juonitila',
    'Kitabın Adı': 'Kirjan nimi',
    'Hikayenin Zamanı': 'Tarinan aika',
    'Hikayenin Mekanı': 'Tarinan paikka',
    'Otomatik kurgu': 'Automaattinen juoni',
    'Detaylı kurgu': 'Yksityiskohtainen juoni',
    'Portre': 'Muotokuva',
    'Portre eklendi': 'Muotokuva lisätty',
    'Portre eklenmedi': 'Muotokuvaa ei lisätty',
    'Belirtilmedi': 'Ei määritetty',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Tämä toiminto käyttää {{creditCount}} krediittiä.'
  },
  fr: {
    'Fortale oluşturulsun mu?': 'Créer ce Fortale ?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Un nouveau Fortale sera préparé selon vos choix. Vérifiez le résumé avant de commencer.',
    'Kitap Türü': 'Type de livre',
    'Alt Tür': 'Sous-genre',
    'Final': 'Fin',
    'Yaş Grubu': 'Tranche d’âge',
    'Kitap Dili': 'Langue du livre',
    'Kurgu Modu': 'Mode d’intrigue',
    'Kitabın Adı': 'Titre du livre',
    'Hikayenin Zamanı': 'Époque de l’histoire',
    'Hikayenin Mekanı': 'Lieu de l’histoire',
    'Otomatik kurgu': 'Intrigue automatique',
    'Detaylı kurgu': 'Intrigue détaillée',
    'Portre': 'Portrait',
    'Portre eklendi': 'Portrait ajouté',
    'Portre eklenmedi': 'Aucun portrait ajouté',
    'Belirtilmedi': 'Non indiqué',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Cette action utilisera {{creditCount}} crédits.'
  },
  hi: {
    'Fortale oluşturulsun mu?': 'क्या यह Fortale बनाया जाए?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'आपके चुनावों के आधार पर नया Fortale तैयार किया जाएगा। शुरू करने से पहले सारांश देख लें।',
    'Kitap Türü': 'पुस्तक प्रकार',
    'Alt Tür': 'उप-शैली',
    'Final': 'अंत',
    'Yaş Grubu': 'आयु समूह',
    'Kitap Dili': 'पुस्तक की भाषा',
    'Kurgu Modu': 'कथानक मोड',
    'Kitabın Adı': 'पुस्तक का नाम',
    'Hikayenin Zamanı': 'कहानी का समय',
    'Hikayenin Mekanı': 'कहानी का स्थान',
    'Otomatik kurgu': 'स्वचालित कथानक',
    'Detaylı kurgu': 'विस्तृत कथानक',
    'Portre': 'पोर्ट्रेट',
    'Portre eklendi': 'पोर्ट्रेट जोड़ा गया',
    'Portre eklenmedi': 'पोर्ट्रेट नहीं जोड़ा गया',
    'Belirtilmedi': 'निर्दिष्ट नहीं',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'इस प्रक्रिया में {{creditCount}} क्रेडिट उपयोग होंगे.'
  },
  id: {
    'Fortale oluşturulsun mu?': 'Buat Fortale ini?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Fortale baru akan disiapkan berdasarkan pilihan Anda. Tinjau ringkasannya sebelum memulai.',
    'Kitap Türü': 'Jenis buku',
    'Alt Tür': 'Subgenre',
    'Final': 'Akhir',
    'Yaş Grubu': 'Kelompok usia',
    'Kitap Dili': 'Bahasa buku',
    'Kurgu Modu': 'Mode alur',
    'Kitabın Adı': 'Judul buku',
    'Hikayenin Zamanı': 'Waktu cerita',
    'Hikayenin Mekanı': 'Lokasi cerita',
    'Otomatik kurgu': 'Alur otomatis',
    'Detaylı kurgu': 'Alur terperinci',
    'Portre': 'Potret',
    'Portre eklendi': 'Potret ditambahkan',
    'Portre eklenmedi': 'Tidak ada potret',
    'Belirtilmedi': 'Tidak ditentukan',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Tindakan ini akan memakai {{creditCount}} kredit.'
  },
  it: {
    'Fortale oluşturulsun mu?': 'Creare questo Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Verrà preparato un nuovo Fortale in base alle tue scelte. Controlla il riepilogo prima di iniziare.',
    'Kitap Türü': 'Tipo di libro',
    'Alt Tür': 'Sottogenere',
    'Final': 'Finale',
    'Yaş Grubu': 'Fascia d’età',
    'Kitap Dili': 'Lingua del libro',
    'Kurgu Modu': 'Modalità trama',
    'Kitabın Adı': 'Titolo del libro',
    'Hikayenin Zamanı': 'Tempo della storia',
    'Hikayenin Mekanı': 'Ambientazione',
    'Otomatik kurgu': 'Trama automatica',
    'Detaylı kurgu': 'Trama dettagliata',
    'Portre': 'Ritratto',
    'Portre eklendi': 'Ritratto aggiunto',
    'Portre eklenmedi': 'Nessun ritratto aggiunto',
    'Belirtilmedi': 'Non specificato',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Questa azione userà {{creditCount}} crediti.'
  },
  ja: {
    'Fortale oluşturulsun mu?': 'このFortaleを作成しますか？',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': '選択内容に基づいて新しいFortaleが準備されます。開始前に概要を確認してください。',
    'Kitap Türü': '本の種類',
    'Alt Tür': 'サブジャンル',
    'Final': '結末',
    'Yaş Grubu': '年齢層',
    'Kitap Dili': '本の言語',
    'Kurgu Modu': 'ストーリーモード',
    'Kitabın Adı': '本のタイトル',
    'Hikayenin Zamanı': '物語の時代',
    'Hikayenin Mekanı': '物語の舞台',
    'Otomatik kurgu': '自動ストーリー',
    'Detaylı kurgu': '詳細ストーリー',
    'Portre': 'ポートレート',
    'Portre eklendi': 'ポートレート追加済み',
    'Portre eklenmedi': 'ポートレートなし',
    'Belirtilmedi': '未指定',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'この操作には{{creditCount}}クレジットが使用されます。'
  },
  ko: {
    'Fortale oluşturulsun mu?': '이 Fortale을 만들까요?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': '선택한 내용으로 새 Fortale이 준비됩니다. 시작하기 전에 요약을 확인하세요.',
    'Kitap Türü': '책 유형',
    'Alt Tür': '하위 장르',
    'Final': '결말',
    'Yaş Grubu': '연령대',
    'Kitap Dili': '책 언어',
    'Kurgu Modu': '줄거리 모드',
    'Kitabın Adı': '책 제목',
    'Hikayenin Zamanı': '이야기 시간',
    'Hikayenin Mekanı': '이야기 배경',
    'Otomatik kurgu': '자동 줄거리',
    'Detaylı kurgu': '상세 줄거리',
    'Portre': '초상화',
    'Portre eklendi': '초상화 추가됨',
    'Portre eklenmedi': '초상화 없음',
    'Belirtilmedi': '지정되지 않음',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': '이 작업에는 {{creditCount}} 크레딧이 사용됩니다.'
  },
  nl: {
    'Fortale oluşturulsun mu?': 'Deze Fortale maken?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Er wordt een nieuwe Fortale voorbereid op basis van je keuzes. Controleer de samenvatting voordat je start.',
    'Kitap Türü': 'Boektype',
    'Alt Tür': 'Subgenre',
    'Final': 'Einde',
    'Yaş Grubu': 'Leeftijdsgroep',
    'Kitap Dili': 'Boektaal',
    'Kurgu Modu': 'Verhaalmodus',
    'Kitabın Adı': 'Boektitel',
    'Hikayenin Zamanı': 'Tijd van het verhaal',
    'Hikayenin Mekanı': 'Locatie van het verhaal',
    'Otomatik kurgu': 'Automatisch verhaal',
    'Detaylı kurgu': 'Gedetailleerd verhaal',
    'Portre': 'Portret',
    'Portre eklendi': 'Portret toegevoegd',
    'Portre eklenmedi': 'Geen portret toegevoegd',
    'Belirtilmedi': 'Niet opgegeven',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Deze actie gebruikt {{creditCount}} credits.'
  },
  no: {
    'Fortale oluşturulsun mu?': 'Opprette denne Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'En ny Fortale forberedes basert på valgene dine. Se gjennom sammendraget før du starter.',
    'Kitap Türü': 'Boktype',
    'Alt Tür': 'Undersjanger',
    'Final': 'Avslutning',
    'Yaş Grubu': 'Aldersgruppe',
    'Kitap Dili': 'Bokspråk',
    'Kurgu Modu': 'Handlingsmodus',
    'Kitabın Adı': 'Boktittel',
    'Hikayenin Zamanı': 'Historiens tid',
    'Hikayenin Mekanı': 'Historiens sted',
    'Otomatik kurgu': 'Automatisk handling',
    'Detaylı kurgu': 'Detaljert handling',
    'Portre': 'Portrett',
    'Portre eklendi': 'Portrett lagt til',
    'Portre eklenmedi': 'Ingen portrett lagt til',
    'Belirtilmedi': 'Ikke angitt',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Denne handlingen bruker {{creditCount}} kreditter.'
  },
  pl: {
    'Fortale oluşturulsun mu?': 'Utworzyć ten Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Nowy Fortale zostanie przygotowany na podstawie Twoich wyborów. Sprawdź podsumowanie przed rozpoczęciem.',
    'Kitap Türü': 'Typ książki',
    'Alt Tür': 'Podgatunek',
    'Final': 'Zakończenie',
    'Yaş Grubu': 'Grupa wiekowa',
    'Kitap Dili': 'Język książki',
    'Kurgu Modu': 'Tryb fabuły',
    'Kitabın Adı': 'Tytuł książki',
    'Hikayenin Zamanı': 'Czas historii',
    'Hikayenin Mekanı': 'Miejsce historii',
    'Otomatik kurgu': 'Automatyczna fabuła',
    'Detaylı kurgu': 'Szczegółowa fabuła',
    'Portre': 'Portret',
    'Portre eklendi': 'Portret dodany',
    'Portre eklenmedi': 'Nie dodano portretu',
    'Belirtilmedi': 'Nie określono',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Ta czynność użyje {{creditCount}} kredytów.'
  },
  'pt-BR': {
    'Fortale oluşturulsun mu?': 'Criar este Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Um novo Fortale será preparado com base nas suas escolhas. Revise o resumo antes de começar.',
    'Kitap Türü': 'Tipo de livro',
    'Alt Tür': 'Subgênero',
    'Final': 'Final',
    'Yaş Grubu': 'Faixa etária',
    'Kitap Dili': 'Idioma do livro',
    'Kurgu Modu': 'Modo de enredo',
    'Kitabın Adı': 'Título do livro',
    'Hikayenin Zamanı': 'Tempo da história',
    'Hikayenin Mekanı': 'Local da história',
    'Otomatik kurgu': 'Enredo automático',
    'Detaylı kurgu': 'Enredo detalhado',
    'Portre': 'Retrato',
    'Portre eklendi': 'Retrato adicionado',
    'Portre eklenmedi': 'Nenhum retrato adicionado',
    'Belirtilmedi': 'Não especificado',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Esta ação usará {{creditCount}} créditos.'
  },
  sv: {
    'Fortale oluşturulsun mu?': 'Skapa denna Fortale?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'En ny Fortale förbereds utifrån dina val. Kontrollera sammanfattningen innan du startar.',
    'Kitap Türü': 'Boktyp',
    'Alt Tür': 'Undergenre',
    'Final': 'Slut',
    'Yaş Grubu': 'Åldersgrupp',
    'Kitap Dili': 'Bokens språk',
    'Kurgu Modu': 'Handlingsläge',
    'Kitabın Adı': 'Boktitel',
    'Hikayenin Zamanı': 'Berättelsens tid',
    'Hikayenin Mekanı': 'Berättelsens plats',
    'Otomatik kurgu': 'Automatisk handling',
    'Detaylı kurgu': 'Detaljerad handling',
    'Portre': 'Porträtt',
    'Portre eklendi': 'Porträtt tillagt',
    'Portre eklenmedi': 'Inget porträtt tillagt',
    'Belirtilmedi': 'Inte angivet',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Den här åtgärden använder {{creditCount}} krediter.'
  },
  th: {
    'Fortale oluşturulsun mu?': 'สร้าง Fortale นี้หรือไม่?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Fortale ใหม่จะถูกเตรียมตามตัวเลือกของคุณ โปรดตรวจสอบสรุปก่อนเริ่มต้น',
    'Kitap Türü': 'ประเภทหนังสือ',
    'Alt Tür': 'ประเภทย่อย',
    'Final': 'ตอนจบ',
    'Yaş Grubu': 'กลุ่มอายุ',
    'Kitap Dili': 'ภาษาของหนังสือ',
    'Kurgu Modu': 'โหมดโครงเรื่อง',
    'Kitabın Adı': 'ชื่อหนังสือ',
    'Hikayenin Zamanı': 'เวลาของเรื่อง',
    'Hikayenin Mekanı': 'สถานที่ของเรื่อง',
    'Otomatik kurgu': 'โครงเรื่องอัตโนมัติ',
    'Detaylı kurgu': 'โครงเรื่องแบบละเอียด',
    'Portre': 'ภาพบุคคล',
    'Portre eklendi': 'เพิ่มภาพบุคคลแล้ว',
    'Portre eklenmedi': 'ไม่ได้เพิ่มภาพบุคคล',
    'Belirtilmedi': 'ไม่ได้ระบุ',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'การดำเนินการนี้จะใช้ {{creditCount}} เครดิต'
  },
  tr: {
    'Fortale oluşturulsun mu?': 'Fortale oluşturulsun mu?',
    'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.': 'Seçimlerinize göre yeni bir Fortale hazırlanacak. Başlamadan önce özeti kontrol edin.',
    'Kitap Türü': 'Kitap Türü',
    'Alt Tür': 'Alt Tür',
    'Final': 'Final',
    'Yaş Grubu': 'Yaş Grubu',
    'Kitap Dili': 'Kitap Dili',
    'Kurgu Modu': 'Kurgu Modu',
    'Kitabın Adı': 'Kitabın Adı',
    'Hikayenin Zamanı': 'Hikayenin Zamanı',
    'Hikayenin Mekanı': 'Hikayenin Mekanı',
    'Otomatik kurgu': 'Otomatik kurgu',
    'Detaylı kurgu': 'Detaylı kurgu',
    'Portre': 'Portre',
    'Portre eklendi': 'Portre eklendi',
    'Portre eklenmedi': 'Portre eklenmedi',
    'Belirtilmedi': 'Belirtilmedi',
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.': 'Bu işlem için {{creditCount}} kredi kullanılacaktır.'
  }
};

for (const [language, translations] of Object.entries(CREATE_CONFIRM_UI_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

const CANCEL_UI_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: { 'İptal': 'إلغاء' },
  da: { 'İptal': 'Annuller' },
  de: { 'İptal': 'Abbrechen' },
  el: { 'İptal': 'Ακύρωση' },
  en: { 'İptal': 'Cancel' },
  es: { 'İptal': 'Cancelar' },
  fi: { 'İptal': 'Peruuta' },
  fr: { 'İptal': 'Annuler' },
  hi: { 'İptal': 'रद्द करें' },
  id: { 'İptal': 'Batal' },
  it: { 'İptal': 'Annulla' },
  ja: { 'İptal': 'キャンセル' },
  ko: { 'İptal': '취소' },
  nl: { 'İptal': 'Annuleren' },
  no: { 'İptal': 'Avbryt' },
  pl: { 'İptal': 'Anuluj' },
  'pt-BR': { 'İptal': 'Cancelar' },
  sv: { 'İptal': 'Avbryt' },
  th: { 'İptal': 'ยกเลิก' },
  tr: { 'İptal': 'İptal' }
};

for (const [language, translations] of Object.entries(CANCEL_UI_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

const OPTIONAL_BOOK_DETAILS_UI_FALLBACK_TRANSLATIONS: Record<AppLanguageCode, Record<string, string>> = {
  ar: {
    'Kitap Detayları': 'تفاصيل الكتاب',
    'Hikayenin Yeri': 'مكان القصة',
    'Opsiyonel': 'اختياري',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'في الوضع التلقائي، ينشئ النموذج تفاصيل الحبكة بنفسه.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'إذا تركت هذه الحقول فارغة، سيحدد Fortale وقت الكتاب ومكانه واسمه بنفسه.'
  },
  da: {
    'Kitap Detayları': 'Bogdetaljer',
    'Hikayenin Yeri': 'Historiens sted',
    'Opsiyonel': 'Valgfrit',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'I automatisk tilstand opretter modellen selv plotdetaljerne.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Hvis du lader felterne stå tomme, vælger Fortale selv bogens tid, sted og titel.'
  },
  de: {
    'Kitap Detayları': 'Buchdetails',
    'Hikayenin Yeri': 'Ort der Geschichte',
    'Opsiyonel': 'Optional',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'Im automatischen Modus erstellt das Modell die Handlungsdetails selbst.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Wenn du diese Felder leer lässt, bestimmt Fortale Zeit, Ort und Titel des Buches selbst.'
  },
  el: {
    'Kitap Detayları': 'Λεπτομέρειες βιβλίου',
    'Hikayenin Yeri': 'Τόπος ιστορίας',
    'Opsiyonel': 'Προαιρετικό',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'Στην αυτόματη λειτουργία, το μοντέλο δημιουργεί μόνο του τις λεπτομέρειες της πλοκής.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Αν αφήσετε αυτά τα πεδία κενά, το Fortale θα ορίσει μόνο του τον χρόνο, τον τόπο και τον τίτλο του βιβλίου.'
  },
  en: {
    'Kitap Detayları': 'Book details',
    'Hikayenin Yeri': 'Story location',
    'Opsiyonel': 'Optional',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'In automatic mode, the model creates the story details itself.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'If you leave these fields empty, Fortale will choose the book time, location, and title.'
  },
  es: {
    'Kitap Detayları': 'Detalles del libro',
    'Hikayenin Yeri': 'Lugar de la historia',
    'Opsiyonel': 'Opcional',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'En modo automático, el modelo crea los detalles de la trama por sí mismo.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Si dejas estos campos vacíos, Fortale elegirá el tiempo, el lugar y el título del libro.'
  },
  fi: {
    'Kitap Detayları': 'Kirjan tiedot',
    'Hikayenin Yeri': 'Tarinan paikka',
    'Opsiyonel': 'Valinnainen',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'Automaattisessa tilassa malli luo juonen yksityiskohdat itse.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Jos jätät kentät tyhjiksi, Fortale valitsee kirjan ajan, paikan ja nimen itse.'
  },
  fr: {
    'Kitap Detayları': 'Détails du livre',
    'Hikayenin Yeri': 'Lieu de l’histoire',
    'Opsiyonel': 'Facultatif',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'En mode automatique, le modèle crée lui-même les détails de l’intrigue.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Si vous laissez ces champs vides, Fortale choisira le moment, le lieu et le titre du livre.'
  },
  hi: {
    'Kitap Detayları': 'पुस्तक विवरण',
    'Hikayenin Yeri': 'कहानी का स्थान',
    'Opsiyonel': 'वैकल्पिक',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'स्वचालित मोड में मॉडल कहानी के विवरण स्वयं बनाता है।',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'यदि आप ये फ़ील्ड खाली छोड़ते हैं, तो Fortale पुस्तक का समय, स्थान और नाम स्वयं चुनेगा।'
  },
  id: {
    'Kitap Detayları': 'Detail buku',
    'Hikayenin Yeri': 'Lokasi cerita',
    'Opsiyonel': 'Opsional',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'Dalam mode otomatis, model membuat detail alur sendiri.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Jika kolom ini dibiarkan kosong, Fortale akan memilih waktu, lokasi, dan judul buku.'
  },
  it: {
    'Kitap Detayları': 'Dettagli del libro',
    'Hikayenin Yeri': 'Luogo della storia',
    'Opsiyonel': 'Facoltativo',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'In modalità automatica, il modello crea da solo i dettagli della trama.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Se lasci vuoti questi campi, Fortale sceglierà tempo, luogo e titolo del libro.'
  },
  ja: {
    'Kitap Detayları': '本の詳細',
    'Hikayenin Yeri': '物語の場所',
    'Opsiyonel': '任意',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': '自動モードでは、モデルがストーリーの詳細を自分で作成します。',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'これらを空欄にすると、Fortaleが本の時代、場所、タイトルを自動で決めます。'
  },
  ko: {
    'Kitap Detayları': '책 세부 정보',
    'Hikayenin Yeri': '이야기 장소',
    'Opsiyonel': '선택 사항',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': '자동 모드에서는 모델이 줄거리 세부 내용을 직접 만듭니다.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': '이 항목을 비워 두면 Fortale이 책의 시간, 장소, 제목을 직접 정합니다.'
  },
  nl: {
    'Kitap Detayları': 'Boekdetails',
    'Hikayenin Yeri': 'Locatie van het verhaal',
    'Opsiyonel': 'Optioneel',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'In automatische modus maakt het model zelf de verhaaldetails.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Als je deze velden leeg laat, kiest Fortale zelf de tijd, locatie en titel van het boek.'
  },
  no: {
    'Kitap Detayları': 'Bokdetaljer',
    'Hikayenin Yeri': 'Historiens sted',
    'Opsiyonel': 'Valgfritt',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'I automatisk modus lager modellen handlingsdetaljene selv.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Hvis du lar feltene stå tomme, velger Fortale bokas tid, sted og tittel selv.'
  },
  pl: {
    'Kitap Detayları': 'Szczegóły książki',
    'Hikayenin Yeri': 'Miejsce historii',
    'Opsiyonel': 'Opcjonalne',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'W trybie automatycznym model sam tworzy szczegóły fabuły.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Jeśli zostawisz te pola puste, Fortale sam wybierze czas, miejsce i tytuł książki.'
  },
  'pt-BR': {
    'Kitap Detayları': 'Detalhes do livro',
    'Hikayenin Yeri': 'Local da história',
    'Opsiyonel': 'Opcional',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'No modo automático, o modelo cria os detalhes do enredo por conta própria.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Se você deixar esses campos vazios, o Fortale escolherá o tempo, o local e o título do livro.'
  },
  sv: {
    'Kitap Detayları': 'Bokdetaljer',
    'Hikayenin Yeri': 'Berättelsens plats',
    'Opsiyonel': 'Valfritt',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'I automatiskt läge skapar modellen själv berättelsedetaljerna.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Om du lämnar fälten tomma väljer Fortale själv bokens tid, plats och titel.'
  },
  th: {
    'Kitap Detayları': 'รายละเอียดหนังสือ',
    'Hikayenin Yeri': 'สถานที่ของเรื่อง',
    'Opsiyonel': 'ไม่บังคับ',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'ในโหมดอัตโนมัติ โมเดลจะสร้างรายละเอียดโครงเรื่องเอง',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'หากเว้นช่องเหล่านี้ไว้ Fortale จะเลือกเวลา สถานที่ และชื่อหนังสือให้เอง'
  },
  tr: {
    'Kitap Detayları': 'Kitap Detayları',
    'Hikayenin Yeri': 'Hikayenin Yeri',
    'Opsiyonel': 'Opsiyonel',
    'Otomatik modda model kurgu detaylarını kendisi oluşturur.': 'Otomatik modda model kurgu detaylarını kendisi oluşturur.',
    'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.': 'Bu alanları boş bırakırsanız Fortale kitabın zamanını, yerini ve adını kendisi belirler.'
  }
};

for (const [language, translations] of Object.entries(OPTIONAL_BOOK_DETAILS_UI_FALLBACK_TRANSLATIONS) as Array<[AppLanguageCode, Record<string, string>]>) {
  UI_FALLBACK_TRANSLATIONS[language] = {
    ...(UI_FALLBACK_TRANSLATIONS[language] || {}),
    ...translations
  };
}

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

function resolveInlineTranslatedValue(language: AppLanguageCode, originalValue: string): string | null {
  const normalized = normalizeInlineText(originalValue);
  if (!isSafeUiKey(normalized)) return null;

  const translated = translateText(language, normalized);
  return originalValue.includes(normalized)
    ? originalValue.replace(normalized, translated)
    : translated;
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

  const currentValue = node.nodeValue ?? '';
  let original = textNodeOriginals.get(node);
  const lastApplied = textNodeLastAppliedTranslations.get(node);

  if (!original && !textNodeOriginals.has(node)) {
    original = currentValue;
    textNodeOriginals.set(node, original);
  } else if (
    typeof original === 'string' &&
    currentValue !== original &&
    currentValue !== lastApplied
  ) {
    // React may update dynamic text nodes (e.g. "Indir" -> "Oku");
    // refresh the translation source instead of forcing stale cached text back.
    original = currentValue;
    textNodeOriginals.set(node, original);
  }

  const originalValue = original ?? currentValue;
  const nextValue = resolveInlineTranslatedValue(language, originalValue);
  if (nextValue == null) {
    textNodeLastAppliedTranslations.delete(node);
    return;
  }

  textNodeLastAppliedTranslations.set(node, nextValue);

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
  let lastAppliedAttributes = elementAttributeLastAppliedTranslations.get(element);
  if (!lastAppliedAttributes) {
    lastAppliedAttributes = new Map<string, string>();
    elementAttributeLastAppliedTranslations.set(element, lastAppliedAttributes);
  }

  for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
    const currentValue = element.getAttribute(attributeName);
    if (currentValue == null) continue;

    const currentOriginalValue = originalAttributes.get(attributeName);
    const lastAppliedValue = lastAppliedAttributes.get(attributeName);
    let originalValue = currentOriginalValue ?? currentValue;

    if (!originalAttributes.has(attributeName)) {
      originalAttributes.set(attributeName, originalValue);
    } else if (
      currentValue !== originalValue &&
      currentValue !== lastAppliedValue
    ) {
      // Keep attribute translations in sync with runtime UI updates.
      originalValue = currentValue;
      originalAttributes.set(attributeName, originalValue);
    }

    const nextValue = resolveInlineTranslatedValue(language, originalValue);
    if (nextValue == null) {
      lastAppliedAttributes.delete(attributeName);
      continue;
    }
    lastAppliedAttributes.set(attributeName, nextValue);

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

const COMMON_UI_FALLBACK_TRANSLATIONS: Partial<Record<AppLanguageCode, Record<string, string>>> = {
  ar: {
    'Masalı Seslendir': 'اسرد الحكاية',
    'Tam ekran': 'ملء الشاشة',
    'Tam ekran aç': 'افتح ملء الشاشة',
    'Tam ekran okuma': 'قراءة بملء الشاشة',
    'Tam ekranı kapat': 'إغلاق ملء الشاشة',
    'Başa dön': 'العودة إلى البداية',
    'Yazıyı küçült': 'تصغير النص',
    'Yazı boyutunu sıfırla': 'إعادة ضبط حجم النص',
    'Yazıyı büyüt': 'تكبير النص',
    'Görünüm değiştir': 'تغيير العرض',
    'Kart': 'بطاقة',
    'Kapak': 'غلاف',
    'Oku': 'اقرأ',
    'Aç': 'افتح',
    'İndiriliyor': 'جارٍ التنزيل',
    'Tekrar dene': 'حاول مرة أخرى',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'السرد الصوتي للحكايات متاح فقط لكتب الحكايات.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'لم يتم العثور على قسم مناسب لإنشاء البودكاست.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'لم يتم العثور على محتوى للسرد الصوتي للبودكاست.',
    'Podcast hazır.': 'البودكاست جاهز.',
    'Bu kitap için podcast bulunamadı.': 'لم يتم العثور على بودكاست لهذا الكتاب.',
    'Önce podcast oluşturmalısınız.': 'يجب إنشاء البودكاست أولاً.',
    'Podcast indirilemedi.': 'تعذر تنزيل البودكاست.',
    'Ses önizlemesi oynatılamadı.': 'تعذر تشغيل معاينة الصوت.'
  },
  da: {
    'Masalı Seslendir': 'Fortæl eventyret',
    'Tam ekran': 'Fuld skærm',
    'Tam ekran aç': 'Åbn fuld skærm',
    'Tam ekran okuma': 'Læsning i fuld skærm',
    'Tam ekranı kapat': 'Luk fuld skærm',
    'Başa dön': 'Tilbage til toppen',
    'Yazıyı küçült': 'Gør teksten mindre',
    'Yazı boyutunu sıfırla': 'Nulstil tekststørrelse',
    'Yazıyı büyüt': 'Gør teksten større',
    'Görünüm değiştir': 'Skift visning',
    'Kart': 'Kort',
    'Kapak': 'Omslag',
    'Oku': 'Læs',
    'Aç': 'Åbn',
    'İndiriliyor': 'Downloader',
    'Tekrar dene': 'Prøv igen',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Eventyroplæsning kan kun bruges til eventyrbøger.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Der blev ikke fundet et egnet afsnit til podcastproduktion.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Der blev ikke fundet indhold til podcastoplæsning.',
    'Podcast hazır.': 'Podcasten er klar.',
    'Bu kitap için podcast bulunamadı.': 'Der blev ikke fundet en podcast til denne bog.',
    'Önce podcast oluşturmalısınız.': 'Du skal oprette podcasten først.',
    'Podcast indirilemedi.': 'Podcasten kunne ikke downloades.',
    'Ses önizlemesi oynatılamadı.': 'Stemmeprøven kunne ikke afspilles.'
  },
  de: {
    'Masalı Seslendir': 'Märchen vorlesen',
    'Tam ekran': 'Vollbild',
    'Tam ekran aç': 'Vollbild öffnen',
    'Tam ekran okuma': 'Vollbild-Lesen',
    'Tam ekranı kapat': 'Vollbild schließen',
    'Başa dön': 'Zum Anfang',
    'Yazıyı küçült': 'Text verkleinern',
    'Yazı boyutunu sıfırla': 'Textgröße zurücksetzen',
    'Yazıyı büyüt': 'Text vergrößern',
    'Görünüm değiştir': 'Ansicht wechseln',
    'Kart': 'Karte',
    'Kapak': 'Cover',
    'Oku': 'Lesen',
    'Aç': 'Öffnen',
    'İndiriliyor': 'Wird heruntergeladen',
    'Tekrar dene': 'Erneut versuchen',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Märchenvorlesung ist nur für Märchenbücher verfügbar.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Kein geeigneter Abschnitt für die Podcast-Erstellung gefunden.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Es wurde kein Inhalt zum Vertonen des Podcasts gefunden.',
    'Podcast hazır.': 'Podcast ist bereit.',
    'Bu kitap için podcast bulunamadı.': 'Für dieses Buch wurde kein Podcast gefunden.',
    'Önce podcast oluşturmalısınız.': 'Du musst zuerst den Podcast erstellen.',
    'Podcast indirilemedi.': 'Podcast konnte nicht heruntergeladen werden.',
    'Ses önizlemesi oynatılamadı.': 'Stimmvorschau konnte nicht abgespielt werden.'
  },
  el: {
    'Masalı Seslendir': 'Αφήγηση παραμυθιού',
    'Tam ekran': 'Πλήρης οθόνη',
    'Tam ekran aç': 'Άνοιγμα πλήρους οθόνης',
    'Tam ekran okuma': 'Ανάγνωση σε πλήρη οθόνη',
    'Tam ekranı kapat': 'Κλείσιμο πλήρους οθόνης',
    'Başa dön': 'Επιστροφή στην αρχή',
    'Yazıyı küçült': 'Μείωση κειμένου',
    'Yazı boyutunu sıfırla': 'Επαναφορά μεγέθους κειμένου',
    'Yazıyı büyüt': 'Μεγέθυνση κειμένου',
    'Görünüm değiştir': 'Αλλαγή προβολής',
    'Kart': 'Κάρτα',
    'Kapak': 'Εξώφυλλο',
    'Oku': 'Ανάγνωση',
    'Aç': 'Άνοιγμα',
    'İndiriliyor': 'Λήψη',
    'Tekrar dene': 'Δοκιμάστε ξανά',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Η αφήγηση παραμυθιού είναι διαθέσιμη μόνο για βιβλία παραμυθιών.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Δεν βρέθηκε κατάλληλη ενότητα για δημιουργία podcast.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Δεν βρέθηκε περιεχόμενο για αφήγηση podcast.',
    'Podcast hazır.': 'Το podcast είναι έτοιμο.',
    'Bu kitap için podcast bulunamadı.': 'Δεν βρέθηκε podcast για αυτό το βιβλίο.',
    'Önce podcast oluşturmalısınız.': 'Πρέπει πρώτα να δημιουργήσετε το podcast.',
    'Podcast indirilemedi.': 'Δεν ήταν δυνατή η λήψη του podcast.',
    'Ses önizlemesi oynatılamadı.': 'Δεν ήταν δυνατή η αναπαραγωγή της προεπισκόπησης φωνής.'
  },
  en: {
    'Masalı Seslendir': 'Narrate Fairy Tale',
    'Tam ekran': 'Full screen',
    'Tam ekran aç': 'Open full screen',
    'Tam ekran okuma': 'Full-screen reading',
    'Tam ekranı kapat': 'Close full screen',
    'Başa dön': 'Back to top',
    'Yazıyı küçült': 'Decrease text',
    'Yazı boyutunu sıfırla': 'Reset text size',
    'Yazıyı büyüt': 'Increase text',
    'Görünüm değiştir': 'Change view',
    'Kart': 'Card',
    'Kapak': 'Cover',
    'Oku': 'Read',
    'Aç': 'Open',
    'İndiriliyor': 'Downloading',
    'Tekrar dene': 'Try again',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Fairy-tale narration is only available for fairy-tale books.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'No suitable section was found for podcast generation.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'No content was found to narrate for the podcast.',
    'Podcast hazır.': 'Podcast is ready.',
    'Bu kitap için podcast bulunamadı.': 'No podcast was found for this book.',
    'Önce podcast oluşturmalısınız.': 'You need to create the podcast first.',
    'Podcast indirilemedi.': 'The podcast could not be downloaded.',
    'Ses önizlemesi oynatılamadı.': 'The voice preview could not be played.'
  },
  es: {
    'Masalı Seslendir': 'Narrar cuento',
    'Tam ekran': 'Pantalla completa',
    'Tam ekran aç': 'Abrir pantalla completa',
    'Tam ekran okuma': 'Lectura en pantalla completa',
    'Tam ekranı kapat': 'Cerrar pantalla completa',
    'Başa dön': 'Volver arriba',
    'Yazıyı küçült': 'Reducir texto',
    'Yazı boyutunu sıfırla': 'Restablecer tamaño del texto',
    'Yazıyı büyüt': 'Aumentar texto',
    'Görünüm değiştir': 'Cambiar vista',
    'Kart': 'Tarjeta',
    'Kapak': 'Portada',
    'Oku': 'Leer',
    'Aç': 'Abrir',
    'İndiriliyor': 'Descargando',
    'Tekrar dene': 'Intentar de nuevo',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'La narración de cuentos solo está disponible para libros de cuentos.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'No se encontró una sección adecuada para generar el podcast.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'No se encontró contenido para narrar en el podcast.',
    'Podcast hazır.': 'El podcast está listo.',
    'Bu kitap için podcast bulunamadı.': 'No se encontró un podcast para este libro.',
    'Önce podcast oluşturmalısınız.': 'Primero debes crear el podcast.',
    'Podcast indirilemedi.': 'No se pudo descargar el podcast.',
    'Ses önizlemesi oynatılamadı.': 'No se pudo reproducir la vista previa de voz.'
  },
  fi: {
    'Masalı Seslendir': 'Kerro satu',
    'Tam ekran': 'Koko näyttö',
    'Tam ekran aç': 'Avaa koko näyttö',
    'Tam ekran okuma': 'Koko näytön lukutila',
    'Tam ekranı kapat': 'Sulje koko näyttö',
    'Başa dön': 'Takaisin alkuun',
    'Yazıyı küçült': 'Pienennä tekstiä',
    'Yazı boyutunu sıfırla': 'Palauta tekstin koko',
    'Yazıyı büyüt': 'Suurenna tekstiä',
    'Görünüm değiştir': 'Vaihda näkymää',
    'Kart': 'Kortti',
    'Kapak': 'Kansi',
    'Oku': 'Lue',
    'Aç': 'Avaa',
    'İndiriliyor': 'Ladataan',
    'Tekrar dene': 'Yritä uudelleen',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Sadun kerronta on käytettävissä vain satukirjoissa.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Podcastin luontiin sopivaa osiota ei löytynyt.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Podcastiin ei löytynyt ääneen luettavaa sisältöä.',
    'Podcast hazır.': 'Podcast on valmis.',
    'Bu kitap için podcast bulunamadı.': 'Tälle kirjalle ei löytynyt podcastia.',
    'Önce podcast oluşturmalısınız.': 'Sinun on ensin luotava podcast.',
    'Podcast indirilemedi.': 'Podcastia ei voitu ladata.',
    'Ses önizlemesi oynatılamadı.': 'Ääniesikatselua ei voitu toistaa.'
  },
  fr: {
    'Masalı Seslendir': 'Raconter le conte',
    'Tam ekran': 'Plein écran',
    'Tam ekran aç': 'Ouvrir le plein écran',
    'Tam ekran okuma': 'Lecture plein écran',
    'Tam ekranı kapat': 'Fermer le plein écran',
    'Başa dön': 'Retour en haut',
    'Yazıyı küçült': 'Réduire le texte',
    'Yazı boyutunu sıfırla': 'Réinitialiser la taille du texte',
    'Yazıyı büyüt': 'Agrandir le texte',
    'Görünüm değiştir': 'Changer la vue',
    'Kart': 'Carte',
    'Kapak': 'Couverture',
    'Oku': 'Lire',
    'Aç': 'Ouvrir',
    'İndiriliyor': 'Téléchargement',
    'Tekrar dene': 'Réessayer',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'La narration de conte est disponible uniquement pour les livres de contes.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Aucune section adaptée à la création du podcast n’a été trouvée.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Aucun contenu à narrer pour le podcast n’a été trouvé.',
    'Podcast hazır.': 'Le podcast est prêt.',
    'Bu kitap için podcast bulunamadı.': 'Aucun podcast n’a été trouvé pour ce livre.',
    'Önce podcast oluşturmalısınız.': 'Vous devez d’abord créer le podcast.',
    'Podcast indirilemedi.': 'Le podcast n’a pas pu être téléchargé.',
    'Ses önizlemesi oynatılamadı.': 'L’aperçu vocal n’a pas pu être lu.'
  },
  hi: {
    'Masalı Seslendir': 'परी कथा सुनाएँ',
    'Tam ekran': 'पूर्ण स्क्रीन',
    'Tam ekran aç': 'पूर्ण स्क्रीन खोलें',
    'Tam ekran okuma': 'पूर्ण स्क्रीन पठन',
    'Tam ekranı kapat': 'पूर्ण स्क्रीन बंद करें',
    'Başa dön': 'ऊपर जाएँ',
    'Yazıyı küçült': 'टेक्स्ट छोटा करें',
    'Yazı boyutunu sıfırla': 'टेक्स्ट आकार रीसेट करें',
    'Yazıyı büyüt': 'टेक्स्ट बड़ा करें',
    'Görünüm değiştir': 'दृश्य बदलें',
    'Kart': 'कार्ड',
    'Kapak': 'कवर',
    'Oku': 'पढ़ें',
    'Aç': 'खोलें',
    'İndiriliyor': 'डाउनलोड हो रहा है',
    'Tekrar dene': 'फिर कोशिश करें',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'परी कथा वाचन केवल परी कथा पुस्तकों के लिए उपलब्ध है।',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'पॉडकास्ट बनाने के लिए उपयुक्त भाग नहीं मिला।',
    'Podcast için seslendirilecek içerik bulunamadı.': 'पॉडकास्ट सुनाने के लिए कोई सामग्री नहीं मिली।',
    'Podcast hazır.': 'पॉडकास्ट तैयार है।',
    'Bu kitap için podcast bulunamadı.': 'इस पुस्तक के लिए कोई पॉडकास्ट नहीं मिला।',
    'Önce podcast oluşturmalısınız.': 'आपको पहले पॉडकास्ट बनाना होगा।',
    'Podcast indirilemedi.': 'पॉडकास्ट डाउनलोड नहीं किया जा सका।',
    'Ses önizlemesi oynatılamadı.': 'आवाज़ पूर्वावलोकन चलाया नहीं जा सका।'
  },
  id: {
    'Masalı Seslendir': 'Narasi dongeng',
    'Tam ekran': 'Layar penuh',
    'Tam ekran aç': 'Buka layar penuh',
    'Tam ekran okuma': 'Membaca layar penuh',
    'Tam ekranı kapat': 'Tutup layar penuh',
    'Başa dön': 'Kembali ke atas',
    'Yazıyı küçült': 'Perkecil teks',
    'Yazı boyutunu sıfırla': 'Reset ukuran teks',
    'Yazıyı büyüt': 'Perbesar teks',
    'Görünüm değiştir': 'Ubah tampilan',
    'Kart': 'Kartu',
    'Kapak': 'Sampul',
    'Oku': 'Baca',
    'Aç': 'Buka',
    'İndiriliyor': 'Mengunduh',
    'Tekrar dene': 'Coba lagi',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Narasi dongeng hanya tersedia untuk buku dongeng.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Tidak ditemukan bagian yang cocok untuk membuat podcast.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Tidak ditemukan konten untuk dinarasikan dalam podcast.',
    'Podcast hazır.': 'Podcast siap.',
    'Bu kitap için podcast bulunamadı.': 'Tidak ada podcast untuk buku ini.',
    'Önce podcast oluşturmalısınız.': 'Anda harus membuat podcast terlebih dahulu.',
    'Podcast indirilemedi.': 'Podcast tidak dapat diunduh.',
    'Ses önizlemesi oynatılamadı.': 'Pratinjau suara tidak dapat diputar.'
  },
  it: {
    'Masalı Seslendir': 'Narra la fiaba',
    'Tam ekran': 'Schermo intero',
    'Tam ekran aç': 'Apri schermo intero',
    'Tam ekran okuma': 'Lettura a schermo intero',
    'Tam ekranı kapat': 'Chiudi schermo intero',
    'Başa dön': 'Torna all’inizio',
    'Yazıyı küçült': 'Riduci testo',
    'Yazı boyutunu sıfırla': 'Ripristina dimensione testo',
    'Yazıyı büyüt': 'Ingrandisci testo',
    'Görünüm değiştir': 'Cambia vista',
    'Kart': 'Scheda',
    'Kapak': 'Copertina',
    'Oku': 'Leggi',
    'Aç': 'Apri',
    'İndiriliyor': 'Download in corso',
    'Tekrar dene': 'Riprova',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'La narrazione delle fiabe è disponibile solo per libri di fiabe.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Non è stata trovata una sezione adatta per creare il podcast.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Non è stato trovato contenuto da narrare per il podcast.',
    'Podcast hazır.': 'Il podcast è pronto.',
    'Bu kitap için podcast bulunamadı.': 'Non è stato trovato alcun podcast per questo libro.',
    'Önce podcast oluşturmalısınız.': 'Devi prima creare il podcast.',
    'Podcast indirilemedi.': 'Non è stato possibile scaricare il podcast.',
    'Ses önizlemesi oynatılamadı.': 'Non è stato possibile riprodurre l’anteprima vocale.'
  },
  ja: {
    'Masalı Seslendir': '童話を読み上げる',
    'Tam ekran': '全画面',
    'Tam ekran aç': '全画面で開く',
    'Tam ekran okuma': '全画面読書',
    'Tam ekranı kapat': '全画面を閉じる',
    'Başa dön': '先頭に戻る',
    'Yazıyı küçült': '文字を小さく',
    'Yazı boyutunu sıfırla': '文字サイズをリセット',
    'Yazıyı büyüt': '文字を大きく',
    'Görünüm değiştir': '表示を切り替え',
    'Kart': 'カード',
    'Kapak': '表紙',
    'Oku': '読む',
    'Aç': '開く',
    'İndiriliyor': 'ダウンロード中',
    'Tekrar dene': '再試行',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': '童話の読み上げは童話本でのみ利用できます。',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'ポッドキャスト作成に適したセクションが見つかりませんでした。',
    'Podcast için seslendirilecek içerik bulunamadı.': 'ポッドキャストで読み上げるコンテンツが見つかりませんでした。',
    'Podcast hazır.': 'ポッドキャストの準備ができました。',
    'Bu kitap için podcast bulunamadı.': 'この本のポッドキャストは見つかりませんでした。',
    'Önce podcast oluşturmalısınız.': '先にポッドキャストを作成してください。',
    'Podcast indirilemedi.': 'ポッドキャストをダウンロードできませんでした。',
    'Ses önizlemesi oynatılamadı.': '音声プレビューを再生できませんでした。'
  },
  ko: {
    'Masalı Seslendir': '동화 들려주기',
    'Tam ekran': '전체 화면',
    'Tam ekran aç': '전체 화면 열기',
    'Tam ekran okuma': '전체 화면 읽기',
    'Tam ekranı kapat': '전체 화면 닫기',
    'Başa dön': '맨 위로',
    'Yazıyı küçült': '글자 작게',
    'Yazı boyutunu sıfırla': '글자 크기 초기화',
    'Yazıyı büyüt': '글자 크게',
    'Görünüm değiştir': '보기 변경',
    'Kart': '카드',
    'Kapak': '표지',
    'Oku': '읽기',
    'Aç': '열기',
    'İndiriliyor': '다운로드 중',
    'Tekrar dene': '다시 시도',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': '동화 음성 narration은 동화책에서만 사용할 수 있습니다.',
    'Podcast üretimi için uygun bölüm bulunamadı.': '팟캐스트 생성에 적합한 섹션을 찾을 수 없습니다.',
    'Podcast için seslendirilecek içerik bulunamadı.': '팟캐스트로 들려줄 콘텐츠를 찾을 수 없습니다.',
    'Podcast hazır.': '팟캐스트가 준비되었습니다.',
    'Bu kitap için podcast bulunamadı.': '이 책의 팟캐스트를 찾을 수 없습니다.',
    'Önce podcast oluşturmalısınız.': '먼저 팟캐스트를 만들어야 합니다.',
    'Podcast indirilemedi.': '팟캐스트를 다운로드할 수 없습니다.',
    'Ses önizlemesi oynatılamadı.': '음성 미리보기를 재생할 수 없습니다.'
  },
  nl: {
    'Masalı Seslendir': 'Vertel het sprookje',
    'Tam ekran': 'Volledig scherm',
    'Tam ekran aç': 'Volledig scherm openen',
    'Tam ekran okuma': 'Lezen op volledig scherm',
    'Tam ekranı kapat': 'Volledig scherm sluiten',
    'Başa dön': 'Terug naar boven',
    'Yazıyı küçült': 'Tekst verkleinen',
    'Yazı boyutunu sıfırla': 'Tekstgrootte herstellen',
    'Yazıyı büyüt': 'Tekst vergroten',
    'Görünüm değiştir': 'Weergave wijzigen',
    'Kart': 'Kaart',
    'Kapak': 'Omslag',
    'Oku': 'Lezen',
    'Aç': 'Openen',
    'İndiriliyor': 'Downloaden',
    'Tekrar dene': 'Opnieuw proberen',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Sprookjesvertelling is alleen beschikbaar voor sprookjesboeken.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Er is geen geschikt onderdeel gevonden om een podcast te maken.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Er is geen inhoud gevonden om in de podcast te vertellen.',
    'Podcast hazır.': 'Podcast is klaar.',
    'Bu kitap için podcast bulunamadı.': 'Er is geen podcast gevonden voor dit boek.',
    'Önce podcast oluşturmalısınız.': 'Je moet eerst de podcast maken.',
    'Podcast indirilemedi.': 'De podcast kon niet worden gedownload.',
    'Ses önizlemesi oynatılamadı.': 'De stemvoorvertoning kon niet worden afgespeeld.'
  },
  no: {
    'Masalı Seslendir': 'Fortell eventyret',
    'Tam ekran': 'Fullskjerm',
    'Tam ekran aç': 'Åpne fullskjerm',
    'Tam ekran okuma': 'Lesing i fullskjerm',
    'Tam ekranı kapat': 'Lukk fullskjerm',
    'Başa dön': 'Til toppen',
    'Yazıyı küçült': 'Gjør teksten mindre',
    'Yazı boyutunu sıfırla': 'Tilbakestill tekststørrelse',
    'Yazıyı büyüt': 'Gjør teksten større',
    'Görünüm değiştir': 'Endre visning',
    'Kart': 'Kort',
    'Kapak': 'Omslag',
    'Oku': 'Les',
    'Aç': 'Åpne',
    'İndiriliyor': 'Laster ned',
    'Tekrar dene': 'Prøv igjen',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Eventyropplesing er bare tilgjengelig for eventyrbøker.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Fant ingen egnet del for podcastproduksjon.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Fant ikke innhold å lese inn for podcasten.',
    'Podcast hazır.': 'Podcasten er klar.',
    'Bu kitap için podcast bulunamadı.': 'Fant ingen podcast for denne boken.',
    'Önce podcast oluşturmalısınız.': 'Du må opprette podcasten først.',
    'Podcast indirilemedi.': 'Podcasten kunne ikke lastes ned.',
    'Ses önizlemesi oynatılamadı.': 'Stemmeprøven kunne ikke spilles av.'
  },
  pl: {
    'Masalı Seslendir': 'Opowiedz baśń',
    'Tam ekran': 'Pełny ekran',
    'Tam ekran aç': 'Otwórz pełny ekran',
    'Tam ekran okuma': 'Czytanie pełnoekranowe',
    'Tam ekranı kapat': 'Zamknij pełny ekran',
    'Başa dön': 'Wróć na górę',
    'Yazıyı küçült': 'Zmniejsz tekst',
    'Yazı boyutunu sıfırla': 'Resetuj rozmiar tekstu',
    'Yazıyı büyüt': 'Powiększ tekst',
    'Görünüm değiştir': 'Zmień widok',
    'Kart': 'Karta',
    'Kapak': 'Okładka',
    'Oku': 'Czytaj',
    'Aç': 'Otwórz',
    'İndiriliyor': 'Pobieranie',
    'Tekrar dene': 'Spróbuj ponownie',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Narracja baśni jest dostępna tylko dla książek z baśniami.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Nie znaleziono odpowiedniej sekcji do utworzenia podcastu.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Nie znaleziono treści do odczytania w podcaście.',
    'Podcast hazır.': 'Podcast jest gotowy.',
    'Bu kitap için podcast bulunamadı.': 'Nie znaleziono podcastu dla tej książki.',
    'Önce podcast oluşturmalısınız.': 'Najpierw musisz utworzyć podcast.',
    'Podcast indirilemedi.': 'Nie udało się pobrać podcastu.',
    'Ses önizlemesi oynatılamadı.': 'Nie udało się odtworzyć podglądu głosu.'
  },
  'pt-BR': {
    'Masalı Seslendir': 'Narrar conto',
    'Tam ekran': 'Tela cheia',
    'Tam ekran aç': 'Abrir tela cheia',
    'Tam ekran okuma': 'Leitura em tela cheia',
    'Tam ekranı kapat': 'Fechar tela cheia',
    'Başa dön': 'Voltar ao topo',
    'Yazıyı küçült': 'Diminuir texto',
    'Yazı boyutunu sıfırla': 'Redefinir tamanho do texto',
    'Yazıyı büyüt': 'Aumentar texto',
    'Görünüm değiştir': 'Alterar visualização',
    'Kart': 'Cartão',
    'Kapak': 'Capa',
    'Oku': 'Ler',
    'Aç': 'Abrir',
    'İndiriliyor': 'Baixando',
    'Tekrar dene': 'Tentar novamente',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'A narração de contos está disponível apenas para livros de contos.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Nenhuma seção adequada foi encontrada para criar o podcast.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Nenhum conteúdo foi encontrado para narrar no podcast.',
    'Podcast hazır.': 'O podcast está pronto.',
    'Bu kitap için podcast bulunamadı.': 'Nenhum podcast foi encontrado para este livro.',
    'Önce podcast oluşturmalısınız.': 'Você precisa criar o podcast primeiro.',
    'Podcast indirilemedi.': 'Não foi possível baixar o podcast.',
    'Ses önizlemesi oynatılamadı.': 'Não foi possível reproduzir a prévia da voz.'
  },
  sv: {
    'Masalı Seslendir': 'Berätta sagan',
    'Tam ekran': 'Helskärm',
    'Tam ekran aç': 'Öppna helskärm',
    'Tam ekran okuma': 'Helskärmsläsning',
    'Tam ekranı kapat': 'Stäng helskärm',
    'Başa dön': 'Till toppen',
    'Yazıyı küçült': 'Minska text',
    'Yazı boyutunu sıfırla': 'Återställ textstorlek',
    'Yazıyı büyüt': 'Öka text',
    'Görünüm değiştir': 'Byt vy',
    'Kart': 'Kort',
    'Kapak': 'Omslag',
    'Oku': 'Läs',
    'Aç': 'Öppna',
    'İndiriliyor': 'Laddar ner',
    'Tekrar dene': 'Försök igen',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'Sagoberättelse är endast tillgänglig för sagoböcker.',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'Ingen lämplig del hittades för att skapa podcasten.',
    'Podcast için seslendirilecek içerik bulunamadı.': 'Inget innehåll hittades att läsa upp i podcasten.',
    'Podcast hazır.': 'Podcasten är klar.',
    'Bu kitap için podcast bulunamadı.': 'Ingen podcast hittades för den här boken.',
    'Önce podcast oluşturmalısınız.': 'Du måste skapa podcasten först.',
    'Podcast indirilemedi.': 'Podcasten kunde inte laddas ner.',
    'Ses önizlemesi oynatılamadı.': 'Röstförhandsvisningen kunde inte spelas upp.'
  },
  th: {
    'Masalı Seslendir': 'เล่านิทาน',
    'Tam ekran': 'เต็มหน้าจอ',
    'Tam ekran aç': 'เปิดเต็มหน้าจอ',
    'Tam ekran okuma': 'อ่านแบบเต็มหน้าจอ',
    'Tam ekranı kapat': 'ปิดเต็มหน้าจอ',
    'Başa dön': 'กลับไปด้านบน',
    'Yazıyı küçült': 'ลดขนาดตัวอักษร',
    'Yazı boyutunu sıfırla': 'รีเซ็ตขนาดตัวอักษร',
    'Yazıyı büyüt': 'เพิ่มขนาดตัวอักษร',
    'Görünüm değiştir': 'เปลี่ยนมุมมอง',
    'Kart': 'การ์ด',
    'Kapak': 'หน้าปก',
    'Oku': 'อ่าน',
    'Aç': 'เปิด',
    'İndiriliyor': 'กำลังดาวน์โหลด',
    'Tekrar dene': 'ลองอีกครั้ง',
    'Masal seslendirme yalnızca masal kitaplarında kullanılabilir.': 'การเล่านิทานใช้ได้เฉพาะกับหนังสือนิทานเท่านั้น',
    'Podcast üretimi için uygun bölüm bulunamadı.': 'ไม่พบส่วนที่เหมาะสมสำหรับสร้างพอดแคสต์',
    'Podcast için seslendirilecek içerik bulunamadı.': 'ไม่พบเนื้อหาสำหรับบรรยายในพอดแคสต์',
    'Podcast hazır.': 'พอดแคสต์พร้อมแล้ว',
    'Bu kitap için podcast bulunamadı.': 'ไม่พบพอดแคสต์สำหรับหนังสือเล่มนี้',
    'Önce podcast oluşturmalısınız.': 'คุณต้องสร้างพอดแคสต์ก่อน',
    'Podcast indirilemedi.': 'ไม่สามารถดาวน์โหลดพอดแคสต์ได้',
    'Ses önizlemesi oynatılamadı.': 'ไม่สามารถเล่นตัวอย่างเสียงได้'
  },
  tr: {}
};

const WIZARD_UI_TRANSLATIONS: Partial<Record<AppLanguageCode, Record<string, string>>> = {
  ar: { 'Evren': 'العالم', 'Konu': 'الموضوع', 'Diğer': 'آخر', 'Kendi alt türünü yaz': 'اكتب النوع الفرعي الخاص بك', 'Kendi temanı yaz': 'اكتب موضوعك الخاص', 'Örn: gerçekçi, büyülü, alternatif evren': 'مثال: واقعي، سحري، عالم بديل' },
  da: { 'Evren': 'Univers', 'Konu': 'Emne', 'Diğer': 'Andet', 'Kendi alt türünü yaz': 'Skriv din egen undergenre', 'Kendi temanı yaz': 'Skriv dit eget tema', 'Örn: gerçekçi, büyülü, alternatif evren': 'Fx realistisk, magisk, alternativt univers' },
  de: { 'Evren': 'Universum', 'Konu': 'Thema', 'Diğer': 'Andere', 'Kendi alt türünü yaz': 'Eigene Untergattung eingeben', 'Kendi temanı yaz': 'Eigenes Thema eingeben', 'Örn: gerçekçi, büyülü, alternatif evren': 'Z. B. realistisch, magisch, alternatives Universum' },
  el: { 'Evren': 'Σύμπαν', 'Konu': 'Θέμα', 'Diğer': 'Άλλο', 'Kendi alt türünü yaz': 'Γράψτε το δικό σας υποείδος', 'Kendi temanı yaz': 'Γράψτε το δικό σας θέμα', 'Örn: gerçekçi, büyülü, alternatif evren': 'Π.χ. ρεαλιστικό, μαγικό, εναλλακτικό σύμπαν' },
  en: { 'Evren': 'Universe', 'Konu': 'Topic', 'Diğer': 'Other', 'Kendi alt türünü yaz': 'Write your own subgenre', 'Kendi temanı yaz': 'Write your own theme', 'Örn: gerçekçi, büyülü, alternatif evren': 'E.g. realistic, magical, alternate universe' },
  es: { 'Evren': 'Universo', 'Konu': 'Tema', 'Diğer': 'Otro', 'Kendi alt türünü yaz': 'Escribe tu propio subgénero', 'Kendi temanı yaz': 'Escribe tu propio tema', 'Örn: gerçekçi, büyülü, alternatif evren': 'Ej.: realista, mágico, universo alternativo' },
  fi: { 'Evren': 'Universumi', 'Konu': 'Aihe', 'Diğer': 'Muu', 'Kendi alt türünü yaz': 'Kirjoita oma alalajisi', 'Kendi temanı yaz': 'Kirjoita oma teemasi', 'Örn: gerçekçi, büyülü, alternatif evren': 'Esim. realistinen, maaginen, vaihtoehtoinen universumi' },
  fr: { 'Evren': 'Univers', 'Konu': 'Sujet', 'Diğer': 'Autre', 'Kendi alt türünü yaz': 'Écris ton propre sous-genre', 'Kendi temanı yaz': 'Écris ton propre thème', 'Örn: gerçekçi, büyülü, alternatif evren': 'Ex. réaliste, magique, univers alternatif' },
  hi: { 'Evren': 'ब्रह्मांड', 'Konu': 'विषय', 'Diğer': 'अन्य', 'Kendi alt türünü yaz': 'अपनी उप-शैली लिखें', 'Kendi temanı yaz': 'अपनी थीम लिखें', 'Örn: gerçekçi, büyülü, alternatif evren': 'उदा. यथार्थवादी, जादुई, वैकल्पिक ब्रह्मांड' },
  id: { 'Evren': 'Semesta', 'Konu': 'Topik', 'Diğer': 'Lainnya', 'Kendi alt türünü yaz': 'Tulis subgenre sendiri', 'Kendi temanı yaz': 'Tulis tema sendiri', 'Örn: gerçekçi, büyülü, alternatif evren': 'Mis. realistis, magis, semesta alternatif' },
  it: { 'Evren': 'Universo', 'Konu': 'Argomento', 'Diğer': 'Altro', 'Kendi alt türünü yaz': 'Scrivi il tuo sottogenere', 'Kendi temanı yaz': 'Scrivi il tuo tema', 'Örn: gerçekçi, büyülü, alternatif evren': 'Es. realistico, magico, universo alternativo' },
  ja: { 'Evren': '世界観', 'Konu': 'トピック', 'Diğer': 'その他', 'Kendi alt türünü yaz': '独自のサブジャンルを書く', 'Kendi temanı yaz': '独自のテーマを書く', 'Örn: gerçekçi, büyülü, alternatif evren': '例: 現実的、魔法的、別世界' },
  ko: { 'Evren': '세계관', 'Konu': '주제', 'Diğer': '기타', 'Kendi alt türünü yaz': '직접 하위 장르 쓰기', 'Kendi temanı yaz': '직접 테마 쓰기', 'Örn: gerçekçi, büyülü, alternatif evren': '예: 현실적, 마법적, 대체 우주' },
  nl: { 'Evren': 'Universum', 'Konu': 'Onderwerp', 'Diğer': 'Anders', 'Kendi alt türünü yaz': 'Schrijf je eigen subgenre', 'Kendi temanı yaz': 'Schrijf je eigen thema', 'Örn: gerçekçi, büyülü, alternatif evren': 'Bijv. realistisch, magisch, alternatief universum' },
  no: { 'Evren': 'Univers', 'Konu': 'Tema', 'Diğer': 'Annet', 'Kendi alt türünü yaz': 'Skriv din egen undersjanger', 'Kendi temanı yaz': 'Skriv ditt eget tema', 'Örn: gerçekçi, büyülü, alternatif evren': 'F.eks. realistisk, magisk, alternativt univers' },
  pl: { 'Evren': 'Uniwersum', 'Konu': 'Temat', 'Diğer': 'Inne', 'Kendi alt türünü yaz': 'Wpisz własny podgatunek', 'Kendi temanı yaz': 'Wpisz własny motyw', 'Örn: gerçekçi, büyülü, alternatif evren': 'Np. realistyczny, magiczny, alternatywny wszechświat' },
  'pt-BR': { 'Evren': 'Universo', 'Konu': 'Tema', 'Diğer': 'Outro', 'Kendi alt türünü yaz': 'Escreva seu próprio subgênero', 'Kendi temanı yaz': 'Escreva seu próprio tema', 'Örn: gerçekçi, büyülü, alternatif evren': 'Ex.: realista, mágico, universo alternativo' },
  sv: { 'Evren': 'Universum', 'Konu': 'Ämne', 'Diğer': 'Annat', 'Kendi alt türünü yaz': 'Skriv din egen undergenre', 'Kendi temanı yaz': 'Skriv ditt eget tema', 'Örn: gerçekçi, büyülü, alternatif evren': 'T.ex. realistiskt, magiskt, alternativt universum' },
  th: { 'Evren': 'จักรวาล', 'Konu': 'หัวข้อ', 'Diğer': 'อื่น ๆ', 'Kendi alt türünü yaz': 'เขียนประเภทย่อยของคุณเอง', 'Kendi temanı yaz': 'เขียนธีมของคุณเอง', 'Örn: gerçekçi, büyülü, alternatif evren': 'เช่น สมจริง เวทมนตร์ จักรวาลทางเลือก' }
};

const WORKBOOK_WIZARD_KEYS = [
  'Çalışma Kitabı Türü',
  'Ek İçerikler',
  'Seviye',
  'İlkokul',
  'Somut, sade ve bol açıklamalı anlatım',
  'Ortaokul',
  'Kavram, örnek ve temel akademik yapı dengesi',
  'Üniversite',
  'Daha teknik, kavramsal ve analitik anlatım',
  'Bilimsel',
  'Genel Kültür',
  'Ders Kitabı',
  'Araştırma',
  'Örnekler',
  'Gerçek yaşam bağlantıları anlatıma yedirilir',
  'Quiz',
  '8 çoktan seçmeli + 4 doğru/yanlış soru eklenir',
  'İlgili Kitaplar',
  'En az 4 okuma önerisi eklenir',
  'Örn: Paralel evrenler, fotosentez veya kuantum bilgisayarlar',
  'Seçilmedi',
  'Bilimsel konu anlatımı, poster, quiz ve kaynak önerileri'
] as const;

const WORKBOOK_WIZARD_TRANSLATION_ROWS: Partial<Record<AppLanguageCode, readonly string[]>> = {
  ar: ['نوع كتاب التمارين', 'محتوى إضافي', 'المستوى', 'المرحلة الابتدائية', 'شرح ملموس وبسيط ومفصل', 'المرحلة المتوسطة', 'توازن بين المفاهيم والأمثلة والبنية الأكاديمية الأساسية', 'الجامعة', 'شرح أكثر تقنية ومفاهيمية وتحليلية', 'علمي', 'ثقافة عامة', 'كتاب دراسي', 'بحث', 'أمثلة', 'تُدمج الروابط بالحياة الواقعية في الشرح', 'اختبار', 'يُضاف 8 أسئلة اختيار من متعدد و4 أسئلة صح أو خطأ', 'كتب ذات صلة', 'تُضاف 4 توصيات قراءة على الأقل', 'مثال: الأكوان المتوازية أو البناء الضوئي أو الحواسيب الكمومية', 'غير محدد', 'شرح علمي وملصقات واختبار وتوصيات للقراءة'],
  da: ['Arbejdsbogstype', 'Ekstra indhold', 'Niveau', 'Grundskole', 'Konkret, enkel og grundigt forklaret formidling', 'Mellemskole', 'Balance mellem begreber, eksempler og grundlæggende akademisk struktur', 'Universitet', 'Mere teknisk, begrebslig og analytisk formidling', 'Videnskabelig', 'Almen viden', 'Lærebog', 'Forskning', 'Eksempler', 'Virkelige forbindelser flettes ind i forklaringen', 'Quiz', 'Tilføjer 8 multiple choice- og 4 sandt/falsk-spørgsmål', 'Relaterede bøger', 'Tilføjer mindst 4 læseanbefalinger', 'Fx parallelle universer, fotosyntese eller kvantecomputere', 'Ikke valgt', 'Videnskabelig forklaring, plakater, quiz og læseforslag'],
  de: ['Arbeitsbuchtyp', 'Zusatzinhalte', 'Niveau', 'Grundschule', 'Konkrete, einfache und ausführlich erklärte Darstellung', 'Sekundarstufe I', 'Ausgewogenheit von Begriffen, Beispielen und akademischen Grundlagen', 'Universität', 'Technischere, begriffliche und analytische Darstellung', 'Wissenschaftlich', 'Allgemeinwissen', 'Lehrbuch', 'Forschung', 'Beispiele', 'Bezüge zum wirklichen Leben werden in die Erklärung eingebunden', 'Quiz', 'Fügt 8 Multiple-Choice- und 4 Richtig/Falsch-Fragen hinzu', 'Weiterführende Bücher', 'Fügt mindestens 4 Leseempfehlungen hinzu', 'Z. B. Paralleluniversen, Photosynthese oder Quantencomputer', 'Nicht ausgewählt', 'Wissenschaftliche Erklärung, Poster, Quiz und Leseempfehlungen'],
  el: ['Τύπος βιβλίου εργασίας', 'Πρόσθετο περιεχόμενο', 'Επίπεδο', 'Δημοτικό', 'Συγκεκριμένη, απλή και αναλυτική εξήγηση', 'Γυμνάσιο', 'Ισορροπία εννοιών, παραδειγμάτων και βασικής ακαδημαϊκής δομής', 'Πανεπιστήμιο', 'Πιο τεχνική, εννοιολογική και αναλυτική παρουσίαση', 'Επιστημονικό', 'Γενικές γνώσεις', 'Σχολικό βιβλίο', 'Έρευνα', 'Παραδείγματα', 'Οι συνδέσεις με την πραγματική ζωή ενσωματώνονται στην εξήγηση', 'Κουίζ', 'Προστίθενται 8 ερωτήσεις πολλαπλής επιλογής και 4 σωστό/λάθος', 'Σχετικά βιβλία', 'Προστίθενται τουλάχιστον 4 προτάσεις ανάγνωσης', 'Π.χ. παράλληλα σύμπαντα, φωτοσύνθεση ή κβαντικοί υπολογιστές', 'Δεν επιλέχθηκε', 'Επιστημονική εξήγηση, αφίσες, κουίζ και προτάσεις ανάγνωσης'],
  en: ['Workbook Type', 'Additional Content', 'Level', 'Primary School', 'Concrete, simple, and thoroughly explained', 'Middle School', 'A balance of concepts, examples, and basic academic structure', 'University', 'More technical, conceptual, and analytical', 'Scientific', 'General Knowledge', 'Textbook', 'Research', 'Examples', 'Real-life connections are woven into the explanation', 'Quiz', 'Adds 8 multiple-choice and 4 true/false questions', 'Related Books', 'Adds at least 4 reading recommendations', 'E.g. parallel universes, photosynthesis, or quantum computers', 'Not selected', 'Scientific explanation, posters, quiz, and reading recommendations'],
  es: ['Tipo de cuaderno de estudio', 'Contenido adicional', 'Nivel', 'Primaria', 'Explicación concreta, sencilla y detallada', 'Secundaria', 'Equilibrio entre conceptos, ejemplos y estructura académica básica', 'Universidad', 'Explicación más técnica, conceptual y analítica', 'Científico', 'Cultura general', 'Libro de texto', 'Investigación', 'Ejemplos', 'Las conexiones con la vida real se integran en la explicación', 'Cuestionario', 'Añade 8 preguntas de opción múltiple y 4 de verdadero/falso', 'Libros relacionados', 'Añade al menos 4 recomendaciones de lectura', 'Ej.: universos paralelos, fotosíntesis u ordenadores cuánticos', 'Sin seleccionar', 'Explicación científica, pósteres, cuestionario y recomendaciones de lectura'],
  fi: ['Työkirjan tyyppi', 'Lisäsisällöt', 'Taso', 'Alakoulu', 'Konkreettinen, selkeä ja perusteellisesti selitetty esitys', 'Yläkoulu', 'Tasapaino käsitteiden, esimerkkien ja akateemisten perusteiden välillä', 'Yliopisto', 'Teknisempi, käsitteellisempi ja analyyttisempi esitys', 'Tieteellinen', 'Yleistieto', 'Oppikirja', 'Tutkimus', 'Esimerkit', 'Yhteydet tosielämään punotaan osaksi selitystä', 'Tietovisa', 'Lisää 8 monivalinta- ja 4 oikein/väärin-kysymystä', 'Aiheeseen liittyvät kirjat', 'Lisää vähintään 4 lukusuositusta', 'Esim. rinnakkaisuniversumit, fotosynteesi tai kvanttitietokoneet', 'Ei valittu', 'Tieteellinen selitys, julisteet, tietovisa ja lukusuositukset'],
  fr: ['Type de cahier d’étude', 'Contenu supplémentaire', 'Niveau', 'École primaire', 'Explication concrète, simple et détaillée', 'Collège', 'Équilibre entre concepts, exemples et structure académique de base', 'Université', 'Présentation plus technique, conceptuelle et analytique', 'Scientifique', 'Culture générale', 'Manuel scolaire', 'Recherche', 'Exemples', 'Les liens avec la vie réelle sont intégrés à l’explication', 'Quiz', 'Ajoute 8 QCM et 4 questions vrai/faux', 'Livres associés', 'Ajoute au moins 4 recommandations de lecture', 'Ex. : univers parallèles, photosynthèse ou ordinateurs quantiques', 'Non sélectionné', 'Explication scientifique, posters, quiz et recommandations de lecture'],
  hi: ['कार्यपुस्तिका का प्रकार', 'अतिरिक्त सामग्री', 'स्तर', 'प्राथमिक विद्यालय', 'ठोस, सरल और विस्तार से समझाया गया वर्णन', 'मिडिल स्कूल', 'अवधारणाओं, उदाहरणों और बुनियादी अकादमिक संरचना का संतुलन', 'विश्वविद्यालय', 'अधिक तकनीकी, वैचारिक और विश्लेषणात्मक वर्णन', 'वैज्ञानिक', 'सामान्य ज्ञान', 'पाठ्यपुस्तक', 'शोध', 'उदाहरण', 'वास्तविक जीवन के संबंधों को व्याख्या में पिरोया जाता है', 'क्विज़', '8 बहुविकल्पीय और 4 सही/गलत प्रश्न जोड़ता है', 'संबंधित पुस्तकें', 'कम से कम 4 पठन सुझाव जोड़ता है', 'जैसे: समानांतर ब्रह्मांड, प्रकाश संश्लेषण या क्वांटम कंप्यूटर', 'चयनित नहीं', 'वैज्ञानिक व्याख्या, पोस्टर, क्विज़ और पठन सुझाव'],
  id: ['Jenis Buku Kerja', 'Konten Tambahan', 'Tingkat', 'Sekolah Dasar', 'Penjelasan konkret, sederhana, dan terperinci', 'Sekolah Menengah', 'Keseimbangan konsep, contoh, dan struktur akademik dasar', 'Universitas', 'Penyajian yang lebih teknis, konseptual, dan analitis', 'Ilmiah', 'Pengetahuan Umum', 'Buku Pelajaran', 'Penelitian', 'Contoh', 'Kaitan dengan kehidupan nyata dipadukan ke dalam penjelasan', 'Kuis', 'Menambahkan 8 soal pilihan ganda dan 4 soal benar/salah', 'Buku Terkait', 'Menambahkan setidaknya 4 rekomendasi bacaan', 'Mis. alam semesta paralel, fotosintesis, atau komputer kuantum', 'Tidak dipilih', 'Penjelasan ilmiah, poster, kuis, dan rekomendasi bacaan'],
  it: ['Tipo di quaderno di studio', 'Contenuti aggiuntivi', 'Livello', 'Scuola primaria', 'Spiegazione concreta, semplice e dettagliata', 'Scuola media', 'Equilibrio tra concetti, esempi e struttura accademica di base', 'Università', 'Presentazione più tecnica, concettuale e analitica', 'Scientifico', 'Cultura generale', 'Libro di testo', 'Ricerca', 'Esempi', 'I collegamenti con la vita reale sono integrati nella spiegazione', 'Quiz', 'Aggiunge 8 domande a scelta multipla e 4 vero/falso', 'Libri correlati', 'Aggiunge almeno 4 consigli di lettura', 'Es. universi paralleli, fotosintesi o computer quantistici', 'Non selezionato', 'Spiegazione scientifica, poster, quiz e consigli di lettura'],
  ja: ['学習ワークブックの種類', '追加コンテンツ', 'レベル', '小学校', '具体的でわかりやすく、丁寧な説明', '中学校', '概念・例・基本的な学術構成のバランス', '大学', 'より専門的・概念的・分析的な説明', '科学', '一般教養', '教科書', '研究', '例', '実生活とのつながりを説明に自然に織り込みます', 'クイズ', '選択式8問と正誤式4問を追加します', '関連書籍', '少なくとも4冊の推薦図書を追加します', '例：並行宇宙、光合成、量子コンピューター', '未選択', '科学的な解説、ポスター、クイズ、推薦図書'],
  ko: ['학습 워크북 유형', '추가 콘텐츠', '수준', '초등학교', '구체적이고 쉽고 자세한 설명', '중학교', '개념, 예시, 기본 학술 구조의 균형', '대학교', '더 기술적이고 개념적이며 분석적인 설명', '과학', '일반 상식', '교과서', '연구', '예시', '실생활 연관성을 설명에 자연스럽게 녹입니다', '퀴즈', '객관식 8문항과 참/거짓 4문항을 추가합니다', '관련 도서', '최소 4권의 추천 도서를 추가합니다', '예: 평행 우주, 광합성 또는 양자 컴퓨터', '선택 안 함', '과학적 설명, 포스터, 퀴즈 및 추천 도서'],
  nl: ['Type werkboek', 'Extra inhoud', 'Niveau', 'Basisschool', 'Concrete, eenvoudige en uitvoerig uitgelegde presentatie', 'Middelbare school', 'Balans tussen begrippen, voorbeelden en academische basisstructuur', 'Universiteit', 'Technischere, conceptuele en analytische presentatie', 'Wetenschappelijk', 'Algemene kennis', 'Leerboek', 'Onderzoek', 'Voorbeelden', 'Verbanden met het echte leven worden in de uitleg verweven', 'Quiz', 'Voegt 8 meerkeuze- en 4 waar/onwaar-vragen toe', 'Gerelateerde boeken', 'Voegt minstens 4 leesaanbevelingen toe', 'Bijv. parallelle universums, fotosynthese of kwantumcomputers', 'Niet geselecteerd', 'Wetenschappelijke uitleg, posters, quiz en leesaanbevelingen'],
  no: ['Arbeidsboktype', 'Ekstra innhold', 'Nivå', 'Barneskole', 'Konkret, enkel og grundig forklart fremstilling', 'Ungdomsskole', 'Balanse mellom begreper, eksempler og grunnleggende akademisk struktur', 'Universitet', 'Mer teknisk, konseptuell og analytisk fremstilling', 'Vitenskapelig', 'Allmennkunnskap', 'Lærebok', 'Forskning', 'Eksempler', 'Koblinger til virkeligheten flettes inn i forklaringen', 'Quiz', 'Legger til 8 flervalgs- og 4 sant/usant-spørsmål', 'Relaterte bøker', 'Legger til minst 4 leseanbefalinger', 'F.eks. parallelle universer, fotosyntese eller kvantedatamaskiner', 'Ikke valgt', 'Vitenskapelig forklaring, plakater, quiz og leseanbefalinger'],
  pl: ['Typ zeszytu ćwiczeń', 'Dodatkowa zawartość', 'Poziom', 'Szkoła podstawowa', 'Konkretne, proste i szczegółowe wyjaśnienie', 'Szkoła średnia', 'Równowaga pojęć, przykładów i podstawowej struktury akademickiej', 'Uniwersytet', 'Bardziej techniczne, pojęciowe i analityczne ujęcie', 'Naukowy', 'Wiedza ogólna', 'Podręcznik', 'Badania', 'Przykłady', 'Powiązania z rzeczywistym życiem są wplecione w wyjaśnienie', 'Quiz', 'Dodaje 8 pytań wielokrotnego wyboru i 4 prawda/fałsz', 'Powiązane książki', 'Dodaje co najmniej 4 rekomendacje lektur', 'Np. wszechświaty równoległe, fotosynteza lub komputery kwantowe', 'Nie wybrano', 'Wyjaśnienie naukowe, plakaty, quiz i rekomendacje lektur'],
  'pt-BR': ['Tipo de livro de estudo', 'Conteúdo adicional', 'Nível', 'Ensino fundamental I', 'Explicação concreta, simples e detalhada', 'Ensino fundamental II', 'Equilíbrio entre conceitos, exemplos e estrutura acadêmica básica', 'Universidade', 'Apresentação mais técnica, conceitual e analítica', 'Científico', 'Conhecimentos gerais', 'Livro didático', 'Pesquisa', 'Exemplos', 'Conexões com a vida real são integradas à explicação', 'Quiz', 'Adiciona 8 questões de múltipla escolha e 4 de verdadeiro/falso', 'Livros relacionados', 'Adiciona pelo menos 4 recomendações de leitura', 'Ex.: universos paralelos, fotossíntese ou computadores quânticos', 'Não selecionado', 'Explicação científica, pôsteres, quiz e recomendações de leitura'],
  sv: ['Typ av arbetsbok', 'Extra innehåll', 'Nivå', 'Grundskola', 'Konkret, enkel och utförligt förklarad framställning', 'Högstadium', 'Balans mellan begrepp, exempel och grundläggande akademisk struktur', 'Universitet', 'Mer teknisk, begreppslig och analytisk framställning', 'Vetenskaplig', 'Allmänbildning', 'Lärobok', 'Forskning', 'Exempel', 'Kopplingar till verkliga livet vävs in i förklaringen', 'Quiz', 'Lägger till 8 flervals- och 4 sant/falskt-frågor', 'Relaterade böcker', 'Lägger till minst 4 läsrekommendationer', 'T.ex. parallella universum, fotosyntes eller kvantdatorer', 'Inte valt', 'Vetenskaplig förklaring, affischer, quiz och läsrekommendationer'],
  th: ['ประเภทแบบฝึกหัด', 'เนื้อหาเพิ่มเติม', 'ระดับ', 'ประถมศึกษา', 'คำอธิบายที่เป็นรูปธรรม เรียบง่าย และละเอียด', 'มัธยมศึกษา', 'สมดุลระหว่างแนวคิด ตัวอย่าง และโครงสร้างวิชาการพื้นฐาน', 'มหาวิทยาลัย', 'คำอธิบายที่เป็นเชิงเทคนิค แนวคิด และวิเคราะห์มากขึ้น', 'วิทยาศาสตร์', 'ความรู้ทั่วไป', 'ตำราเรียน', 'การวิจัย', 'ตัวอย่าง', 'เชื่อมโยงชีวิตจริงเข้ากับคำอธิบายอย่างเป็นธรรมชาติ', 'แบบทดสอบ', 'เพิ่มคำถามปรนัย 8 ข้อและถูก/ผิด 4 ข้อ', 'หนังสือที่เกี่ยวข้อง', 'เพิ่มคำแนะนำการอ่านอย่างน้อย 4 รายการ', 'เช่น จักรวาลคู่ขนาน การสังเคราะห์ด้วยแสง หรือคอมพิวเตอร์ควอนตัม', 'ไม่ได้เลือก', 'คำอธิบายเชิงวิทยาศาสตร์ โปสเตอร์ แบบทดสอบ และคำแนะนำการอ่าน']
};

function translateWorkbookWizardText(language: AppLanguageCode, value: string): string | undefined {
  const keyIndex = WORKBOOK_WIZARD_KEYS.indexOf(value as (typeof WORKBOOK_WIZARD_KEYS)[number]);
  if (keyIndex < 0) return undefined;
  return WORKBOOK_WIZARD_TRANSLATION_ROWS[language]?.[keyIndex];
}

function translateText(language: AppLanguageCode, value: string): string {
  if (!value || language === 'tr') return value;

  const supplement = UI_TRANSLATION_SUPPLEMENTS[language]?.[value];
  if (supplement) return supplement;

  const libraryDashboardTranslation = LIBRARY_DASHBOARD_UI_TRANSLATIONS[language]?.[value];
  if (libraryDashboardTranslation) return libraryDashboardTranslation;

  const communityTranslation = COMMUNITY_UI_TRANSLATIONS[language]?.[value];
  if (communityTranslation) return communityTranslation;

  const wizardTranslation = WIZARD_UI_TRANSLATIONS[language]?.[value];
  if (wizardTranslation) return wizardTranslation;

  const workbookWizardTranslation = translateWorkbookWizardText(language, value);
  if (workbookWizardTranslation) return workbookWizardTranslation;

  const commonFallback = COMMON_UI_FALLBACK_TRANSLATIONS[language]?.[value];
  if (commonFallback) return commonFallback;

  // Hand-curated fallback entries are intentionally preferred over generated translations.
  const fallback = UI_FALLBACK_TRANSLATIONS[language]?.[value];
  if (fallback) return fallback;

  const map = getTranslationMap(language);
  const primary = map.get(value);
  if (primary && primary !== value) return primary;

  return value;
}

export async function translateUiTextForCoverageCheck(language: AppLanguageCode, value: string): Promise<string> {
  await ensureTranslationMap(language);
  return translateText(language, value);
}

export function UiI18nProvider({
  language,
  children
}: {
  language: AppLanguageCode;
  children: React.ReactNode;
}) {
  const [translationVersion, setTranslationVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    ensureTranslationMap(language)
      .then(() => {
        if (!cancelled) {
          setTranslationVersion((value) => value + 1);
        }
      })
      .catch((error) => {
        console.error(`Failed to load UI translations for ${language}`, error);
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const value = useMemo<UiI18nContextValue>(() => ({
    language,
    locale: getAppLanguageLocale(language),
    t: (input: string) => translateText(language, input)
  }), [language, translationVersion]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language, translationVersion]);

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
  }, [language, translationVersion]);

  const isTranslationReady = translationMaps.has(language);

  return (
    <UiI18nContext.Provider value={value}>
      {isTranslationReady ? children : (
        <div
          className="fixed inset-0 bg-[#061224]"
          aria-hidden="true"
          data-no-ui-translate="true"
        />
      )}
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
