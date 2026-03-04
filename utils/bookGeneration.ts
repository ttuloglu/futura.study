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
    { value: 'story', label: 'Hikaye', hint: 'Kısa-orta anlatı, güçlü olay örgüsü' },
    { value: 'novel', label: 'Roman', hint: 'Uzun anlatı, karakter ve dünya derinliği' }
  ];

export const SMARTBOOK_SUBGENRE_OPTIONS: Record<SmartBookBookType, string[]> = {
  fairy_tale: [
    'Klasik Masal',
    'Modern Masal',
    'Macera Masalı',
    'Mitolojik Esintili',
    'Eğitici Masal'
  ],
  story: [
    'Dram',
    'Komedi',
    'Korku',
    'Bilim Kurgu',
    'Distopik',
    'Ütopik',
    'Gizem',
    'Psikolojik',
    'Macera',
    'Romantik',
    'Aile',
    'Gerilim'
  ],
  novel: [
    'Dram',
    'Komedi',
    'Korku',
    'Bilim Kurgu',
    'Distopik',
    'Ütopik',
    'Tarihsel',
    'Polisiye',
    'Fantastik',
    'Macera',
    'Romantik',
    'Psikolojik',
    'Gerilim',
    'Mizah'
  ]
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

type PageRange = { min: number; max: number; suggested: number };

export function getPageRangeByBookType(bookType: SmartBookBookType, ageGroup: SmartBookAgeGroup = 'general'): PageRange {
  if (bookType === 'fairy_tale') {
    if (ageGroup === '7-9') return { min: 13, max: 15, suggested: 14 };
    return { min: 10, max: 12, suggested: 11 };
  }
  if (bookType === 'story') return { min: 20, max: 25, suggested: 22 };
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
