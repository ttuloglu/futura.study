import type { SmartBookAgeGroup } from '../types';

export const SMARTBOOK_AGE_GROUP_OPTIONS: Array<{ value: SmartBookAgeGroup; label: string; hint: string }> = [
  { value: '1-3', label: '1-3 Yaş', hint: 'Masallar için, çok kısa ve tekrar eden anlatım' },
  { value: '4-6', label: '4-6 Yaş', hint: 'Masallar için, kısa ve bol görselli' },
  { value: '7-9', label: '7-9 Yaş', hint: 'Genişletilmiş masallar ve ilk okumalar' },
  { value: '7-11', label: '7-11', hint: 'Temel, sade ve somut anlatım' },
  { value: '12-18', label: '12-18', hint: 'Orta seviye, örneklerle ilerleyen anlatım' },
  { value: 'general', label: 'Genel', hint: 'Yetişkin ve genel kullanıcı kitlesine dengeli anlatım' }
];

export function normalizeSmartBookAgeGroup(value: unknown): SmartBookAgeGroup | undefined {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
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
  if (normalized === '1-3') return '1-3 Yaş';
  if (normalized === '4-6') return '4-6 Yaş';
  if (normalized === '7-9') return '7-9 Yaş';
  return normalized;
}

export function getSmartBookAgeGroupAudienceLine(value: SmartBookAgeGroup | string | undefined): string {
  const normalized = normalizeSmartBookAgeGroup(value);
  if (normalized === '1-3') return '1-3 yaş çocuklar';
  if (normalized === '4-6') return '4-6 yaş çocuklar';
  if (normalized === '7-9') return '7-9 yaş çocuklar';
  if (normalized === '7-11') return '7-11 yaş';
  if (normalized === '12-18') return '12-18 yaş';
  return 'Genel';
}
