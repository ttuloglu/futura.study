import { CourseData, TimelineNode } from '../types';

export const SMARTBOOK_FIXED_CATEGORIES = [
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Psikoloji',
  'Sosyoloji',
  'Antropoloji',
  'Edebiyat',
  'Hukuk',
  'Ekonomi, Finans & İşletme',
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Sağlık & Tıp',
  'Mühendislik',
  'Bilgisayar Bilimleri',
  'Yapay Zeka',
  'Sanat & Tasarım',
  'Disiplinlerarası'
] as const;

export type SmartBookFixedCategory = (typeof SMARTBOOK_FIXED_CATEGORIES)[number];

const FIXED_CATEGORY_SET = new Set<string>(SMARTBOOK_FIXED_CATEGORIES);

function normalizeKey(value: string): string {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s&]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RAW_CATEGORY_ALIASES: Array<{ match: RegExp; category: SmartBookFixedCategory }> = [
  { match: /\b(yapay zeka|artificial intelligence|ai)\b/i, category: 'Yapay Zeka' },
  { match: /\b(bilgisayar bilimleri|computer science|software|programlama|coding|kodlama)\b/i, category: 'Bilgisayar Bilimleri' },
  { match: /\b(ekonomi|iktisat|economics|finans|finance|işletme|management|business|pazarlama|marketing)\b/i, category: 'Ekonomi, Finans & İşletme' },
  { match: /\b(saglik|sağlık|tip|tıp|medicine|medical)\b/i, category: 'Sağlık & Tıp' },
  { match: /\b(dil|language|grammar|gramer)\b/i, category: 'Edebiyat' },
  { match: /\b(sanat|tasarim|tasarım|design|architecture|mimari)\b/i, category: 'Sanat & Tasarım' }
];

type CategoryProbeInput = {
  rawCategory?: string;
  topic?: string;
  description?: string;
  sourceContent?: string;
  searchTags?: string[];
  nodes?: Array<Pick<TimelineNode, 'title' | 'description'>>;
};

function exactOrAliasCategory(rawCategory?: string): SmartBookFixedCategory | null {
  const raw = String(rawCategory || '').trim();
  if (!raw) return null;
  if (FIXED_CATEGORY_SET.has(raw)) return raw as SmartBookFixedCategory;

  const normalized = normalizeKey(raw);
  if (!normalized) return null;

  // Common legacy / generic values should be ignored and re-derived from content.
  if (/(akademik|dokuman tabanli|doküman tabanlı|genel bilim|general|science|genel)$/.test(normalized)) {
    return null;
  }

  for (const alias of RAW_CATEGORY_ALIASES) {
    if (alias.match.test(normalized)) return alias.category;
  }

  return null;
}

function buildProbeText(input: CategoryProbeInput): string {
  const nodeText = (input.nodes || [])
    .map((node) => `${node.title || ''} ${node.description || ''}`.trim())
    .join(' ');

  return [
    input.topic || '',
    input.description || '',
    input.sourceContent ? String(input.sourceContent).slice(0, 3000) : '',
    Array.isArray(input.searchTags) ? input.searchTags.join(' ') : '',
    nodeText
  ]
    .join(' ')
    .toLocaleLowerCase('tr-TR');
}

function probeHasAny(probe: string, ...parts: string[]): boolean {
  return parts.some((part) => probe.includes(part));
}

function categoryFromProbe(probeRaw: string): SmartBookFixedCategory {
  const probe = String(probeRaw || '').toLocaleLowerCase('tr-TR');
  const hasAny = (...parts: string[]) => probeHasAny(probe, ...parts);

  // Order matters: anthropology before physics because of "fiziksel antropoloji"
  if (hasAny(
    'antropoloji',
    'anthropology',
    'etnografi',
    'ethnography',
    'etnoloji',
    'ethnology',
    'kültürel antropoloji',
    'cultural anthropology',
    'sosyal antropoloji',
    'social anthropology',
    'fiziksel antropoloji',
    'physical anthropology',
    'paleoantropoloji',
    'paleoanthropology'
  )) return 'Antropoloji';

  if (hasAny(
    'tarih',
    'history',
    'osmanlı',
    'ottoman',
    'padişah',
    'padisah',
    'imparatorluk',
    'empire',
    'savaş',
    'savasi',
    'world war',
    'dünya savaşı',
    'kronoloji',
    'inkılap',
    'inkilap'
  )) return 'Tarih';

  if (hasAny('coğrafya', 'cografya', 'geography', 'iklim', 'harita', 'jeoloji', 'jeopolitik')) return 'Coğrafya';
  if (hasAny('yapay zeka', 'artificial intelligence', 'machine learning', 'makine öğren', 'derin öğren', 'llm', 'neural network')) return 'Yapay Zeka';
  if (hasAny('programlama', 'algoritma', 'veri yapıları', 'python', 'javascript', 'java', 'c++', 'c#', 'software', 'kodlama')) return 'Bilgisayar Bilimleri';
  if (hasAny('matematik', 'calculus', 'türev', 'integral', 'lineer cebir', 'olasılık', 'istatistik', 'geometri')) return 'Matematik';
  if (hasAny('fizik', 'physics', 'kuantum', 'mekanik', 'elektromanyet', 'termodinamik')) return 'Fizik';
  if (hasAny('kimya', 'chemistry', 'organik', 'inorganik', 'molekül', 'atom', 'reaksiyon')) return 'Kimya';
  if (hasAny('biyoloji', 'biology', 'genetik', 'hücre', 'evrim', 'ekoloji')) return 'Biyoloji';
  if (hasAny('psikoloji', 'psychology', 'davranış', 'bilişsel', 'terapi')) return 'Psikoloji';
  if (hasAny('sosyoloji', 'sociology', 'toplum', 'kültür', 'social theory')) return 'Sosyoloji';
  if (hasAny('felsefe', 'philosophy', 'etik', 'mantık', 'ontology', 'epistemoloji')) return 'Felsefe';
  if (hasAny('edebiyat', 'literature', 'roman', 'şiir', 'siir', 'poetry', 'novel', 'yazar')) return 'Edebiyat';
  if (hasAny('dil', 'grammar', 'gramer', 'ingilizce', 'english', 'spanish', 'français', 'almanca', 'japanese', 'japonca')) return 'Edebiyat';
  if (hasAny('hukuk', 'law', 'anayasa', 'ceza', 'medeni', 'contract')) return 'Hukuk';
  if (hasAny('ekonomi', 'iktisat', 'economics', 'finans', 'finance', 'borsa', 'yatırım', 'yatirim', 'muhasebe', 'risk', 'kredi', 'işletme', 'isletme', 'management', 'marketing', 'pazarlama', 'strateji', 'organizasyon')) {
    return 'Ekonomi, Finans & İşletme';
  }
  if (hasAny('tıp', 'tip', 'sağlık', 'saglik', 'medicine', 'medical', 'anatomi', 'fizyoloji', 'hastalık', 'hastalik')) return 'Sağlık & Tıp';
  if (hasAny('mühendislik', 'muhendislik', 'engineering', 'devre', 'mekatronik', 'statik', 'dinamik')) return 'Mühendislik';
  if (hasAny('sanat', 'tasarım', 'tasarim', 'design', 'mimari', 'architecture', 'müzik', 'muzik', 'resim', 'grafik')) return 'Sanat & Tasarım';

  return 'Disiplinlerarası';
}

export function canonicalizeSmartBookCategory(input: CategoryProbeInput): SmartBookFixedCategory {
  const fromRaw = exactOrAliasCategory(input.rawCategory);
  if (fromRaw && fromRaw !== 'Disiplinlerarası') {
    // Even if raw says something valid, let clear topic-specific history/anthropology overrides fix known mistakes.
    const probe = buildProbeText(input);
    const derived = categoryFromProbe(probe);
    if ((fromRaw === 'Fizik' && derived === 'Antropoloji') || (fromRaw === 'Disiplinlerarası' && derived !== 'Disiplinlerarası')) {
      return derived;
    }
    if (fromRaw === 'Disiplinlerarası' && derived !== 'Disiplinlerarası') return derived;
    if (fromRaw === 'Yapay Zeka' && derived === 'Bilgisayar Bilimleri' && probe.includes('yapay zeka')) return 'Yapay Zeka';
    return fromRaw;
  }

  return categoryFromProbe(buildProbeText(input));
}

export function deriveCategoryFromCourse(course: CourseData): SmartBookFixedCategory {
  return canonicalizeSmartBookCategory({
    rawCategory: course.category,
    topic: course.topic,
    description: course.description,
    searchTags: Array.isArray(course.searchTags) ? course.searchTags : [],
    nodes: course.nodes.map((node) => ({ title: node.title, description: node.description }))
  });
}
