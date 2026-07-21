import type { SmartBookBookType } from '../types';

export const BOOK_TYPE_CREATE_CREDIT_COST: Record<SmartBookBookType, number> = {
  fairy_tale: 2,
  story: 2,
  novel: 2
};

export const PODCAST_CREATE_CREDIT_COST = 2;
export const WORKBOOK_NARRATION_CREDITS_PER_STARTED_MINUTE = 0.1;
export const WORKBOOK_NARRATION_ESTIMATED_WORDS_PER_MINUTE = 110;
export const WORKBOOK_NARRATION_RESERVATION_SAFETY_RATIO = 1.12;

export const COMMUNITY_DOWNLOAD_CREDIT_COST = 0.5;
export const COMMUNITY_CREATOR_REWARD = 0.25;

export function getBookTypeCreateCreditCost(bookType: SmartBookBookType): number {
  return BOOK_TYPE_CREATE_CREDIT_COST[bookType] ?? 1;
}

export interface WorkbookNarrationCreditQuote {
  wordCount: number;
  estimatedDurationSeconds: number;
  estimatedCredits: number;
  reservedCredits: number;
}

function roundCreditAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getWorkbookNarrationCreditQuote(script: string): WorkbookNarrationCreditQuote {
  const normalized = String(script || '').replace(/\s+/g, ' ').trim();
  const wordCount = normalized ? normalized.split(/\s+/u).filter(Boolean).length : 0;
  const estimatedDurationSeconds = Math.max(
    60,
    Math.ceil((wordCount / WORKBOOK_NARRATION_ESTIMATED_WORDS_PER_MINUTE) * 60)
  );
  const estimatedStartedMinutes = Math.max(1, Math.ceil(estimatedDurationSeconds / 60));
  const reservedStartedMinutes = Math.max(
    estimatedStartedMinutes,
    Math.ceil((estimatedDurationSeconds * WORKBOOK_NARRATION_RESERVATION_SAFETY_RATIO) / 60)
  );
  return {
    wordCount,
    estimatedDurationSeconds,
    estimatedCredits: roundCreditAmount(
      estimatedStartedMinutes * WORKBOOK_NARRATION_CREDITS_PER_STARTED_MINUTE
    ),
    reservedCredits: roundCreditAmount(
      reservedStartedMinutes * WORKBOOK_NARRATION_CREDITS_PER_STARTED_MINUTE
    )
  };
}
