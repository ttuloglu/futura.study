export const COMPANION_AVATARS = [
  { id: 'dost', name: 'Dost', books: 0 },
  { id: 'koz', name: 'Köz', books: 5 },
  { id: 'misket', name: 'Misket', books: 20 },
  { id: 'pus', name: 'Pus', books: 50 },
  { id: 'lumen', name: 'Lümen', books: 100 },
  { id: 'nova', name: 'Nova', books: 200 },
  { id: 'koala', name: 'Koala', books: 300 },
  { id: 'panda', name: 'Panda', books: 500 }
] as const;
export type CompanionAvatarId = typeof COMPANION_AVATARS[number]['id'];
export const NOVA_STAR_BOOKS = 1000;
export function companionAvatar(id: unknown) {
  return COMPANION_AVATARS.find(avatar => avatar.id === id) || COMPANION_AVATARS[0];
}
export function unlockedCompanionAvatar(id: unknown, completed: number): CompanionAvatarId {
  const avatar = companionAvatar(id);
  return completed >= avatar.books ? avatar.id : 'dost';
}
export function nextCompanionAvatar(completed: number) {
  return COMPANION_AVATARS.find(avatar => avatar.books > completed);
}
