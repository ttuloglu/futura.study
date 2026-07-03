import type { SmartBookAgeGroup, SmartBookBookType } from '../types';

export const SMARTBOOK_AGE_GROUP_OPTIONS: Array<{ value: SmartBookAgeGroup; label: string; hint: string }> = [
  { value: '1-6', label: '1-6 Yaş', hint: 'Görsel masallar ve çok kısa anlatım' },
  { value: '7+', label: '7+ Yaş', hint: 'Görsel masal, daha uzun metinler ve yaşa uygun anlatım' },
  { value: '1-3', label: '1-3 Yaş', hint: 'Masallar için, çok kısa ve tekrar eden anlatım' },
  { value: '4-6', label: '4-6 Yaş', hint: 'Masallar için, kısa ve bol görselli' },
  { value: '7-9', label: '7-9 Yaş', hint: 'Genişletilmiş masallar ve ilk okumalar' },
  { value: '7-11', label: '7-11', hint: 'Temel, sade ve somut anlatım' },
  { value: '12-18', label: '12-18', hint: 'Orta seviye, örneklerle ilerleyen anlatım' },
  { value: 'general', label: 'Genel', hint: 'Yetişkin ve genel kullanıcı kitlesine dengeli anlatım' }
];

export const SMARTBOOK_AGE_GROUPS_BY_BOOK_TYPE: Record<SmartBookBookType, SmartBookAgeGroup[]> = {
  fairy_tale: ['1-6', '7+'],
  story: ['7-11', '12-18', 'general'],
  novel: ['7-11', '12-18', 'general']
};

export function getSmartBookAgeGroupOptionsForBookType(bookType: SmartBookBookType) {
  const allowedAgeGroups = SMARTBOOK_AGE_GROUPS_BY_BOOK_TYPE[bookType] || SMARTBOOK_AGE_GROUPS_BY_BOOK_TYPE.story;
  return SMARTBOOK_AGE_GROUP_OPTIONS.filter((option) => allowedAgeGroups.includes(option.value));
}

export function getDefaultSmartBookAgeGroupForBookType(bookType: SmartBookBookType): SmartBookAgeGroup {
  if (bookType === 'fairy_tale') return '1-6';
  return 'general';
}

export function isSmartBookAgeGroupAllowedForBookType(bookType: SmartBookBookType, ageGroup: SmartBookAgeGroup | string | undefined): boolean {
  const normalized = normalizeSmartBookAgeGroup(ageGroup);
  return Boolean(normalized && SMARTBOOK_AGE_GROUPS_BY_BOOK_TYPE[bookType]?.includes(normalized));
}

export function normalizeSmartBookAgeGroup(value: unknown): SmartBookAgeGroup | undefined {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (raw === '1-6') return '1-6';
  if (raw === '7+' || raw === '7-plus' || raw === '7plus') return '7+';
  if (raw === '1-3') return '1-3';
  if (raw === '4-6') return '4-6';
  if (raw === '7-9') return '7-9';
  if (raw === '7-11') return '7-11';
  if (raw === '12-18') return '12-18';
  if (raw === 'general' || raw === 'genel') return 'general';
  if (raw === 'academic' || raw === 'akademik') return 'general';
  return undefined;
}

export function getSmartBookAgeGroupLabel(value: SmartBookAgeGroup | string | undefined): string {
  const normalized = normalizeSmartBookAgeGroup(value);
  if (!normalized) return 'Genel';
  if (normalized === 'general') return 'Genel';
  if (normalized === '1-6') return '1-6 Yaş';
  if (normalized === '7+') return '7+ Yaş';
  if (normalized === '1-3') return '1-3 Yaş';
  if (normalized === '4-6') return '4-6 Yaş';
  if (normalized === '7-9') return '7-9 Yaş';
  return normalized;
}

export function getSmartBookAgeGroupAudienceLine(value: SmartBookAgeGroup | string | undefined): string {
  const normalized = normalizeSmartBookAgeGroup(value);
  if (normalized === '1-6') return '1-6 yaş çocuklar';
  if (normalized === '7+') return '7 yaş ve üzeri çocuklar';
  if (normalized === '1-3') return '1-3 yaş çocuklar';
  if (normalized === '4-6') return '4-6 yaş çocuklar';
  if (normalized === '7-9') return '7-9 yaş çocuklar';
  if (normalized === '7-11') return '7-11 yaş';
  if (normalized === '12-18') return '12-18 yaş';
  return 'Genel';
}
