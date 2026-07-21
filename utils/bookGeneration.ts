import type {
  SmartBookAgeGroup,
  SmartBookBookType,
  SmartBookCreativeBrief,
  SmartBookEndingStyle
} from '../types';

export const SMARTBOOK_BOOK_TYPE_OPTIONS: Array<{
  value: SmartBookBookType;
  label: string;
  hint: string;
}> = [
    { value: 'fairy_tale', label: 'Masal', hint: 'Anlatı + değer aktarımı + hayal gücü' },
    { value: 'story', label: 'Çalışma Kitabı', hint: 'Bilimsel konu anlatımı, poster, quiz ve kaynak önerileri' },
    { value: 'novel', label: 'Hikaye', hint: 'Uzun anlatı, karakter ve dünya derinliği' }
  ];

export const SMARTBOOK_SUBGENRE_OPTIONS: Record<SmartBookBookType, string[]> = {
  fairy_tale: [
    'Klasik',
    'Modern',
    'Macera',
    'Mitolojik',
    'Fantastik',
    'Eğitici',
    'Kültürel',
    'Bilimkurgu'
  ],
  story: [
    'Bilimsel',
    'Genel Kültür',
    'Ders Kitabı',
    'Araştırma'
  ],
  novel: [
    'Fantastik',
    'Bilimkurgu',
    'Macera',
    'Gizem / Polisiye',
    'Dram',
    'Romantik',
    'Korku',
    'Tarihi',
    'Gerilim',
    'Mitolojik',
    'Kültürel',
    'Modern',
    'Gençlik',
    'Süper Kahraman',
    'Alternatif Dünya'
  ]
};

const STORY_NOVEL_THEME_OPTIONS: Record<string, string[]> = {
  Fantastik: [
    'Büyü sistemleri',
    'Krallık çatışmaları',
    'Kayıp artefakt',
    'Kehanet',
    'Ejderhalar',
    'Kadim uygarlıklar',
    'Karanlık güçler',
    'Portal dünyaları',
    'Kahramanın yükselişi',
    'Lanetler'
  ],
  Bilimkurgu: [
    'Yapay zeka',
    'Uzay kolonileri',
    'Siber toplum',
    'Zaman paradoksu',
    'Distopya',
    'Genetik değişim',
    'Robot hakları',
    'Simülasyon evreni',
    'İnsanlık sonrası çağ',
    'Teknolojik kriz'
  ],
  Macera: [
    'Keşif',
    'Hazine avı',
    'Hayatta kalma',
    'Uzun yolculuk',
    'Kayıp şehir',
    'Tehlikeli görev',
    'Kaçış',
    'Gizli örgüt',
    'Bilinmeyen bölge',
    'Rekabet'
  ],
  'Gizem / Polisiye': [
    'Cinayet soruşturması',
    'Kayıp kişi',
    'Komplo',
    'Seri suçlar',
    'Dedektiflik',
    'Psikolojik sırlar',
    'Gizli örgütler',
    'Adalet arayışı',
    'İhanet',
    'Delil avı'
  ],
  Dram: [
    'Aile çatışmaları',
    'Kimlik arayışı',
    'Kayıp ve yas',
    'Toplumsal baskı',
    'İçsel dönüşüm',
    'Kırık ilişkiler',
    'Hayat mücadelesi',
    'Psikolojik gerilim',
    'Yalnızlık',
    'İnsan ilişkileri'
  ],
  Romantik: [
    'Yasak aşk',
    'İlk aşk',
    'İkinci şans',
    'Rakipten aşka',
    'Uzaktan ilişki',
    'Kalp kırıklığı',
    'Tutkulu ilişki',
    'Romantik gerilim',
    'Aşk üçgeni',
    'Zıt karakterler'
  ],
  Korku: [
    'Doğaüstü varlıklar',
    'Lanet',
    'Perili mekanlar',
    'Psikolojik korku',
    'Canavarlar',
    'Bilinmeyen tehdit',
    'Karanlık ritüeller',
    'Paranoya',
    'Hayatta kalma korkusu',
    'Bedensel korku'
  ],
  Tarihi: [
    'İmparatorluklar',
    'Savaşlar',
    'Saray entrikaları',
    'Tarihi figürler',
    'Kadim medeniyetler',
    'Keşif çağları',
    'Direniş hareketleri',
    'Ticaret yolları',
    'Antik yaşam',
    'Alternatif tarih'
  ],
  Gerilim: [
    'Kaçış',
    'Takip',
    'Politik kriz',
    'Casusluk',
    'Teknolojik tehdit',
    'Zamana karşı yarış',
    'Komplo',
    'Rehine durumu',
    'Psikolojik baskı',
    'Büyük felaket'
  ],
  Mitolojik: [
    'Tanrılar',
    'Kehanetler',
    'Kahraman destanları',
    'Mitolojik savaşlar',
    'Efsane yeniden anlatımı',
    'Kutsal görev',
    'Yarı tanrılar',
    'Kadim sırlar',
    'Kader',
    'Efsanevi yaratıklar'
  ],
  Kültürel: [
    'Gelenek çatışması',
    'Göç',
    'Kimlik',
    'Halk anlatıları',
    'Yerel yaşam',
    'İnanç sistemleri',
    'Toplumsal normlar',
    'Kültürel miras',
    'Ritüeller',
    'Kuşak çatışması'
  ],
  Modern: [
    'Şehir yaşamı',
    'Kariyer',
    'Teknoloji etkisi',
    'Sosyal medya',
    'Günlük ilişkiler',
    'Yalnızlık',
    'Modern aile',
    'İş dünyası',
    'Kişisel gelişim',
    'Çağdaş problemler'
  ],
  Gençlik: [
    'Okul hayatı',
    'Kimlik arayışı',
    'Arkadaşlık',
    'İlk aşk',
    'Rekabet',
    'Gelecek kaygısı',
    'Akran baskısı',
    'Büyüme süreci',
    'Gençlik macerası',
    'Kendini keşfetme'
  ],
  'Süper Kahraman': [
    'Güç keşfi',
    'Gizli kimlik',
    'Anti-kahraman',
    'Takım savaşı',
    'Dünya tehdidi',
    'Ahlaki ikilem',
    'Güç kontrolü',
    'Köken hikayesi',
    'Süper kötü',
    'Fedakarlık'
  ],
  'Alternatif Dünya': [
    'Paralel evren',
    'Alternatif tarih',
    'Simülasyon gerçekliği',
    'Distopik düzen',
    'Farklı toplum yapıları',
    'Çoklu evren',
    'Gerçeklik kırılması',
    'Yeni kurallar',
    'Dünya birleşmesi',
    'Boyut yolculuğu'
  ]
};

export const SMARTBOOK_THEME_OPTIONS: Record<SmartBookBookType, Record<string, string[]>> = {
  fairy_tale: {
    Klasik: [
      'İyilik kötülüğe karşı',
      'Dilekler',
      'Kayıp prens/prenses',
      'Büyülü görev',
      'Üç sınav',
      'Bilgelik',
      'Şans ve kader',
      'Gizli kimlik',
      'Krallığı kurtarma',
      'Sadakat'
    ],
    Modern: [
      'Okul hayatı',
      'Aile yaşamı',
      'Teknoloji ile yaşam',
      'Yeni arkadaşlık',
      'Şehir macerası',
      'Çevre bilinci',
      'Sosyal medya',
      'Günlük küçük kahramanlıklar',
      'Farklılıklara uyum',
      'Modern problemler'
    ],
    Macera: [
      'Hazine avı',
      'Kayıp harita',
      'Gizli ada',
      'Kaçış yolculuğu',
      'Keşif görevi',
      'Tehlikeli görev',
      'Hayatta kalma',
      'Sır çözme',
      'Kayıp nesne arayışı',
      'Cesur yolculuk'
    ],
    Mitolojik: [
      'Tanrılar',
      'Yarı tanrılar',
      'Efsanevi yaratıklar',
      'Kehanet',
      'Kadim güçler',
      'Destansı görev',
      'Kutsal eserler',
      'Mitolojik savaş',
      'Kahramanın sınavı',
      'Kader yolculuğu'
    ],
    Fantastik: [
      'Büyü',
      'Ejderhalar',
      'Sihirli orman',
      'Gizli dünya',
      'Büyülü okul',
      'Kadim büyü',
      'Lanetler',
      'Portal geçişi',
      'Sihirli nesne',
      'Efsanevi yaratıklar'
    ],
    Eğitici: [
      'Paylaşmak',
      'Empati',
      'Cesaret',
      'Özgüven',
      'Bilim merakı',
      'Sağlıklı yaşam',
      'Duygu yönetimi',
      'Sorumluluk',
      'Problem çözme',
      'Takım çalışması'
    ],
    Kültürel: [
      'Halk hikayeleri',
      'Yerel gelenekler',
      'Festivaller',
      'Aile kültürü',
      'Bölgesel efsaneler',
      'Folklor',
      'Geleneksel yemekler',
      'Tarihi mekanlar',
      'Kültürel değerler',
      'Dil ve atasözleri'
    ],
    Bilimkurgu: [
      'Robotlar',
      'Uzay yolculuğu',
      'Yapay zeka',
      'Gelecek şehirleri',
      'Zaman yolculuğu',
      'Yeni gezegenler',
      'Bilim keşifleri',
      'Siber dünya',
      'Uzaylı dostlukları',
      'İcat maceraları'
    ]
  },
  story: STORY_NOVEL_THEME_OPTIONS,
  novel: STORY_NOVEL_THEME_OPTIONS
};

export const SMARTBOOK_ENDING_OPTIONS: Array<{
  value: SmartBookEndingStyle;
  label: string;
  hint: string;
}> = [
    { value: 'happy', label: 'Mutlu Son', hint: 'Pozitif kapanış ve çözülme' },
    { value: 'bittersweet', label: 'Hüzünlü-Anlamlı', hint: 'Duygusal ama anlamlı kapanış' },
    { value: 'twist', label: 'Sürpriz Son', hint: 'Beklenmedik ve mantıklı final' }
  ];

export type SmartBookMood = 'adventure' | 'funny' | 'heartfelt' | 'mysterious' | 'educational';

export const SMARTBOOK_MOOD_OPTIONS: Array<{
  value: SmartBookMood;
  label: string;
  description: string;
  emoji: string;
}> = [
  { value: 'adventure', label: 'Macera', description: 'Tempolu, heyecanlı, engelleri aşan', emoji: '⚡' },
  { value: 'funny', label: 'Komik', description: 'Esprili, hafif, güldüren', emoji: '😄' },
  { value: 'heartfelt', label: 'Sıcak', description: 'Duygusal, bağ kuran, içten', emoji: '❤️' },
  { value: 'mysterious', label: 'Gizemli', description: 'Gerilim dolu, soru işaretleri', emoji: '🔮' },
  { value: 'educational', label: 'Eğitici', description: 'Bilgi aktaran, keşfettiren', emoji: '💡' }
];

export type SmartBookLesson = 'sharing' | 'courage' | 'friendship' | 'diversity' | 'perseverance' | 'kindness' | 'curiosity';

export const SMARTBOOK_LESSON_OPTIONS: Array<{
  value: SmartBookLesson;
  label: string;
}> = [
  { value: 'sharing', label: 'Paylaşmak güzeldir' },
  { value: 'courage', label: 'Cesaret ödüllendirilir' },
  { value: 'friendship', label: 'Arkadaşlık her şeyin üstünde' },
  { value: 'diversity', label: 'Farklılıklar zenginliktir' },
  { value: 'perseverance', label: 'Azimle başarıya ulaşılır' },
  { value: 'kindness', label: 'İyilik güç gerektirir' },
  { value: 'curiosity', label: 'Merak keşfin anahtarıdır' }
];

type PageRange = { min: number; max: number; suggested: number };

export function getPageRangeByBookType(bookType: SmartBookBookType, ageGroup: SmartBookAgeGroup = 'general'): PageRange {
  if (bookType === 'fairy_tale') {
    if (ageGroup === '1-6') return { min: 7, max: 7, suggested: 7 };
    if (ageGroup === '7+') return { min: 10, max: 12, suggested: 11 };
    return { min: 10, max: 12, suggested: 11 };
  }
  if (bookType === 'story') return { min: 12, max: 15, suggested: 14 };
  return { min: 30, max: 35, suggested: 32 };
}

export function normalizeSmartBookBookType(value: unknown): SmartBookBookType {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'fairy_tale' || raw === 'fairy-tale' || raw === 'masal') return 'fairy_tale';
  if (raw === 'novel' || raw === 'roman') return 'novel';
  return 'story';
}

export function normalizeSmartBookEndingStyle(value: unknown): SmartBookEndingStyle | undefined {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'happy' || raw === 'mutlu') return 'happy';
  if (raw === 'bittersweet' || raw === 'huzunlu' || raw === 'hüzünlü') return 'bittersweet';
  if (raw === 'twist' || raw === 'surpriz' || raw === 'sürpriz') return 'twist';
  return undefined;
}

export function buildTargetPageFromBrief(brief?: SmartBookCreativeBrief, ageGroup: SmartBookAgeGroup = 'general'): number {
  const bookType = normalizeSmartBookBookType(brief?.bookType);
  const range = getPageRangeByBookType(bookType, ageGroup);
  const min = Number(brief?.targetPageMin);
  const max = Number(brief?.targetPageMax);
  if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
    const clampedMin = Math.max(range.min, Math.floor(min));
    const clampedMax = Math.min(range.max, Math.floor(max));
    if (clampedMax >= clampedMin) return Math.round((clampedMin + clampedMax) / 2);
  }
  return range.suggested;
}

export function getEstimatedGenerationMinutes(bookType?: SmartBookBookType): number {
  if (bookType === 'fairy_tale') return 3;
  if (bookType === 'story') return 3;
  return 8;
}
