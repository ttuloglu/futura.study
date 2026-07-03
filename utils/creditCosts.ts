import type { SmartBookBookType } from '../types';

export const BOOK_TYPE_CREATE_CREDIT_COST: Record<SmartBookBookType, number> = {
  fairy_tale: 1,
  story: 2,
  novel: 2
};

export const PODCAST_CREATE_CREDIT_COST = 2;

export const COMMUNITY_DOWNLOAD_CREDIT_COST = 0.5;
export const COMMUNITY_CREATOR_REWARD = 0.25;

export function getBookTypeCreateCreditCost(bookType: SmartBookBookType): number {
  return BOOK_TYPE_CREATE_CREDIT_COST[bookType] ?? 1;
}
