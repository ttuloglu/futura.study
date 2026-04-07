import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppLanguageCode } from '../data/appLanguages';
import { getAppLanguageLocale } from '../data/appLanguages';
import { UI_TRANSLATION_LOADERS } from '../data/uiTranslationLoaders';
import { UI_TRANSLATION_SAFE_KEYS } from '../data/uiTranslationSafeKeys.generated';

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
    'Fantastik': 'Fantastik',
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
