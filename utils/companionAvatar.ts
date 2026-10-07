import { getReadingOwner, getReadingRecords, subscribeReading } from './readingProgress';
import { readingStats } from './readingProgressModel';
import { companionAvatar, unlockedCompanionAvatar, type CompanionAvatarId } from '../data/companionAvatars';

const listeners = new Set<() => void>();
const preferenceKey = (owner: string) => `fortale-companion-avatar-v1:${owner}`;
function readPreference(owner: string): CompanionAvatarId {
  try { return companionAvatar(localStorage.getItem(preferenceKey(owner))).id; }
  catch { return 'dost'; }
}
let owner = getReadingOwner();
let preferred = readPreference(owner);
let snapshot = { selected: 'dost' as CompanionAvatarId, completed: 0, owner };
function refresh() {
  const nextOwner = getReadingOwner();
  if (owner !== nextOwner) { owner = nextOwner; preferred = readPreference(owner); }
  const completed = readingStats(Object.values(getReadingRecords())).total;
  const selected = unlockedCompanionAvatar(preferred, completed);
  if (snapshot.selected === selected && snapshot.completed === completed && snapshot.owner === owner) return;
  snapshot = { selected, completed, owner };
  listeners.forEach(listener => listener());
}
refresh();
subscribeReading(refresh);
export const getCompanionAvatar = () => snapshot;
export function subscribeCompanionAvatar(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function selectCompanionAvatar(id: CompanionAvatarId) {
  refresh();
  if (unlockedCompanionAvatar(id, snapshot.completed) !== id) return false;
  preferred = id;
  try { localStorage.setItem(preferenceKey(owner), id); } catch { /* Keep the current session usable. */ }
  refresh();
  return true;
}
window.addEventListener('storage', event => {
  if (event.key !== preferenceKey(owner)) return;
  preferred = readPreference(owner); refresh();
});
