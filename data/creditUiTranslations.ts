import type { AppLanguageCode } from './appLanguages';

type CreditTranslation = Record<'Satın alınan' | 'Topluluktan elde edilen' | 'Toplam kredi', string>;

export const CREDIT_UI_TRANSLATIONS: Record<AppLanguageCode, CreditTranslation> = {
  ar: {
    'Satın alınan': 'تم شراؤه',
    'Topluluktan elde edilen': 'المكتسب من المجتمع',
    'Toplam kredi': 'إجمالي الرصيد'
  },
  da: {
    'Satın alınan': 'Købt',
    'Topluluktan elde edilen': 'Optjent i fællesskabet',
    'Toplam kredi': 'Samlede kreditter'
  },
  de: {
    'Satın alınan': 'Gekauft',
    'Topluluktan elde edilen': 'In der Community verdient',
    'Toplam kredi': 'Credits gesamt'
  },
  el: {
    'Satın alınan': 'Αγορασμένες',
    'Topluluktan elde edilen': 'Κερδισμένες από την κοινότητα',
    'Toplam kredi': 'Σύνολο πιστώσεων'
  },
  en: {
    'Satın alınan': 'Purchased',
    'Topluluktan elde edilen': 'Earned from community',
    'Toplam kredi': 'Total credits'
  },
  es: {
    'Satın alınan': 'Comprados',
    'Topluluktan elde edilen': 'Obtenidos de la comunidad',
    'Toplam kredi': 'Créditos totales'
  },
  fi: {
    'Satın alınan': 'Ostetut',
    'Topluluktan elde edilen': 'Yhteisöstä ansaitut',
    'Toplam kredi': 'Krediitit yhteensä'
  },
  fr: {
    'Satın alınan': 'Achetés',
    'Topluluktan elde edilen': 'Gagnés via la communauté',
    'Toplam kredi': 'Total des crédits'
  },
  hi: {
    'Satın alınan': 'खरीदे गए',
    'Topluluktan elde edilen': 'समुदाय से अर्जित',
    'Toplam kredi': 'कुल क्रेडिट'
  },
  id: {
    'Satın alınan': 'Dibeli',
    'Topluluktan elde edilen': 'Diperoleh dari komunitas',
    'Toplam kredi': 'Total kredit'
  },
  it: {
    'Satın alınan': 'Acquistati',
    'Topluluktan elde edilen': 'Ottenuti dalla community',
    'Toplam kredi': 'Crediti totali'
  },
  ja: {
    'Satın alınan': '購入分',
    'Topluluktan elde edilen': 'コミュニティ獲得分',
    'Toplam kredi': '合計クレジット'
  },
  ko: {
    'Satın alınan': '구매한 크레딧',
    'Topluluktan elde edilen': '커뮤니티 획득 크레딧',
    'Toplam kredi': '총 크레딧'
  },
  nl: {
    'Satın alınan': 'Gekocht',
    'Topluluktan elde edilen': 'Verdiend via de community',
    'Toplam kredi': 'Totaal credits'
  },
  no: {
    'Satın alınan': 'Kjøpt',
    'Topluluktan elde edilen': 'Opptjent i fellesskapet',
    'Toplam kredi': 'Totale kreditter'
  },
  pl: {
    'Satın alınan': 'Kupione',
    'Topluluktan elde edilen': 'Zdobyte w społeczności',
    'Toplam kredi': 'Łączna liczba kredytów'
  },
  'pt-BR': {
    'Satın alınan': 'Comprados',
    'Topluluktan elde edilen': 'Obtidos na comunidade',
    'Toplam kredi': 'Créditos totais'
  },
  sv: {
    'Satın alınan': 'Köpta',
    'Topluluktan elde edilen': 'Intjänade från communityn',
    'Toplam kredi': 'Totala krediter'
  },
  th: {
    'Satın alınan': 'ซื้อแล้ว',
    'Topluluktan elde edilen': 'ได้รับจากชุมชน',
    'Toplam kredi': 'เครดิตรวม'
  },
  tr: {
    'Satın alınan': 'Satın alınan',
    'Topluluktan elde edilen': 'Topluluktan elde edilen',
    'Toplam kredi': 'Toplam kredi'
  }
};
