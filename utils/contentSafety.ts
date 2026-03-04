export const BOOK_CONTENT_SAFETY_MESSAGE =
  'Bu konu güvenlik politikamız kapsamında desteklenmiyor. Lütfen farklı bir konu seçin.';

export interface RestrictedBookTopicViolation {
  category: string;
  matchedText: string;
}

type RestrictedBookTopicRule = {
  category: string;
  pattern: RegExp;
};

const RESTRICTED_BOOK_TOPIC_RULES: RestrictedBookTopicRule[] = [
  {
    category: 'sexual_content',
    pattern:
      /\b(cinsellik|seks(?:uel)?|sex(?:ual)?|porno(?:grafi(?:k)?)?|porn(?:ography)?|erotik|mustehcen|nsfw|adult\s*content|yetiskin\s*icerik)\b/iu
  },
  {
    category: 'war_crimes',
    pattern:
      /\b(savas\s*suclari?|war\s*crime(?:s)?|insanliga\s*karsi\s*suclar?|crimes?\s*against\s*humanity|soykirim|genocide)\b/iu
  },
  {
    category: 'racism_hate',
    pattern:
      /\b(irkcilik|racis(?:m|t)|hate\s*speech|nefret\s*soylemi)\b/iu
  },
  {
    category: 'bullying',
    pattern:
      /\b(zorbalik|bully(?:ing)?|mobbing)\b/iu
  },
  {
    category: 'terrorism',
    pattern:
      /\b(teror(?:izm)?|terror(?:ism|ist)?)\b/iu
  },
  {
    category: 'explosives',
    pattern:
      /\b(patlayici(?:\s*madde)?\s*yapimi|patlayici|bomba\s*yapimi|explosive(?:s)?(?:\s*(?:making|manufacture|how))?|improvised\s*explosive|ied|tnt|molotov|detonator|nitrogliserin|barut)\b/iu
  },
  {
    category: 'illegal_drugs',
    pattern:
      /\b(uyusturucu\s*yapimi|drug\s*manufactur(?:e|ing)|meth(?:amphetamine)?|heroin|kokain|cocaine)\b/iu
  },
  {
    category: 'weapon_making',
    pattern:
      /\b(silah\s*yapimi|weapon\s*making|ghost\s*gun|3d\s*gun)\b/iu
  },
  {
    category: 'fraud_crime',
    pattern:
      /\b(dolandiricilik|fraud|identity\s*theft|kimlik\s*hirsizligi|sahtecilik|phishing|kart\s*kopyalama)\b/iu
  },
  {
    category: 'cybercrime',
    pattern:
      /\b(hacking|hack|ddos|malware|ransomware|exploit|sql\s*injection)\b/iu
  },
  {
    category: 'generic_illegal',
    pattern:
      /\b(yasa\s*disi|illegal|kanuna\s*aykiri|suclu?\s*eylem|crime\s*tutorial)\b/iu
  }
];

function normalizeSafetyText(value: string): string {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

export function findRestrictedBookTopicViolation(value: string | undefined): RestrictedBookTopicViolation | null {
  const text = normalizeSafetyText(String(value || '').trim());
  if (!text) return null;
  for (const rule of RESTRICTED_BOOK_TOPIC_RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      return {
        category: rule.category,
        matchedText: match[0] || ''
      };
    }
  }
  return null;
}

export function findRestrictedBookTopicInTexts(values: Array<string | undefined>): RestrictedBookTopicViolation | null {
  for (const value of values) {
    const violation = findRestrictedBookTopicViolation(value);
    if (violation) return violation;
  }
  return null;
}

