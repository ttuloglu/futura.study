import type { CommunityBook } from '../types';

export function getOwnedCommunityCourseId(
  book: CommunityBook | null | undefined,
  viewerUserId?: string | null
): string | null {
  if (!book) return null;

  if (viewerUserId && book.userId === viewerUserId) {
    return String(book.bookId || '').trim() || null;
  }

  if (!book.isOwned) return null;
  const communityBookId = String(book.id || '').trim();
  return communityBookId ? `community_${communityBookId}` : null;
}
