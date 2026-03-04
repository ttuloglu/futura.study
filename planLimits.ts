export const FREE_PLAN_LIMITS = {
  podcastCreditsPerDay: 3,
  transcriptMaxMinutes: 5,
  visualSharedCreditsPerDay: 3,
  quizCreditsPerDay: 3,
  prototypeCreditsPerDay: 3,
  translationPagesPerDay: 10,
  chatMessagesPerDay: 5,
  disabledFeatures: [
    'Akıllı Ajan',
    'Web Search',
    'Deep Search',
    'Veri Analizi'
  ]
} as const;
