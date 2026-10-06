import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { decodeReadingRecord, encodeReadingRecord, mergeReadingRecords, type ReadingRecord } from './readingProgressModel';

const listeners = new Set<() => void>();
let uid = auth.currentUser?.uid || 'guest';
let records: Record<string,ReadingRecord> = {};
let pending: Record<string,ReadingRecord> = {};
let unsubscribe: (() => void) | undefined;
let flushing = false;
let pausedOwner: string | undefined;
let activeWrite: Promise<ReadingRecord> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
const cacheKey = (owner: string) => `fortale-reading-v1:${owner}`;
function publish() { listeners.forEach(listener => listener()); }
function persist() { try { localStorage.setItem(cacheKey(uid), JSON.stringify({ records, pending })); } catch { /* Device storage can be full; Firebase remains available. */ } }
function restore() {
  try { const cache = JSON.parse(localStorage.getItem(cacheKey(uid)) || '{}'); records = cache.records || {}; pending = cache.pending || {}; }
  catch { records = {}; pending = {}; }
}
restore();
onAuthStateChanged(auth, user => {
  unsubscribe?.(); clearTimeout(retry);
  uid = user?.uid || 'guest'; restore(); publish();
  if (!user) return;
  const owner = uid;
  unsubscribe = onSnapshot(collection(db,'users',owner,'readingProgress'), snapshot => {
    if (uid !== owner) return;
    const next: Record<string,ReadingRecord> = { ...(snapshot.metadata.fromCache ? records : {}), ...pending };
    for (const item of snapshot.docs) {
      const remote = decodeReadingRecord(item.data());
      if (!remote.bookId || !Array.isArray(remote.coverage)) continue;
      next[item.id] = mergeReadingRecords(records[item.id],remote);
    }
    records=next; persist(); publish(); void flush();
  }, () => { /* Cached bookmarks remain usable offline. */ });
  void flush();
});
export function subscribeReading(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getReadingRecords() { return records; }
export function getReadingOwner() { return uid; }
export async function loadReadingRecord(bookId: string, owner = uid): Promise<ReadingRecord | undefined> {
  if (owner !== uid) return;
  if (owner === 'guest') return records[bookId];
  const remote = getDoc(doc(db,'users',owner,'readingProgress',bookId)).then(snapshot => {
    if (uid !== owner) return undefined;
    if (snapshot.exists()) records = { ...records, [bookId]: mergeReadingRecords(records[bookId],decodeReadingRecord(snapshot.data())) };
    persist(); publish(); return records[bookId];
  }).catch(() => records[bookId]);
  let timer: ReturnType<typeof setTimeout>;
  const result = await Promise.race([remote, new Promise<ReadingRecord | undefined>(resolve => { timer = setTimeout(() => resolve(records[bookId]),2000); })]);
  clearTimeout(timer!); return result;
}
export function saveReadingRecord(record: ReadingRecord, owner = uid) {
  if (uid !== owner || !record.bookId) return;
  records = { ...records, [record.bookId]: mergeReadingRecords(records[record.bookId],record) };
  pending[record.bookId] = records[record.bookId]; persist(); publish();
  void flush();
}
async function flush() {
  if (flushing || pausedOwner === uid || uid === 'guest' || !navigator.onLine) return;
  clearTimeout(retry);
  flushing = true;
  let failed=false;
  const owner = uid;
  try {
    for (const [bookId, outgoing] of Object.entries(pending)) {
      if (uid !== owner || pausedOwner === owner) break;
      const reference = doc(db,'users',owner,'readingProgress',bookId);
      activeWrite = runTransaction(db, async transaction => {
        const previous = await transaction.get(reference);
        const result = mergeReadingRecords(previous.exists() ? decodeReadingRecord(previous.data()) : undefined,outgoing);
        transaction.set(reference,encodeReadingRecord(result)); return result;
      });
      const merged = await activeWrite; activeWrite=undefined;
      if (uid !== owner) break;
      records = { ...records, [bookId]: mergeReadingRecords(records[bookId],merged) };
      if (pending[bookId] === outgoing) delete pending[bookId];
      persist(); publish();
    }
  } catch { failed=true; /* Keep the outbox until reconnect; never block page turns. */ }
  finally {
    activeWrite=undefined; flushing = false;
    if (Object.keys(pending).length && uid !== 'guest' && pausedOwner !== uid) retry = setTimeout(() => void flush(),failed ? 15000 : 0);
  }
}
window.addEventListener('online', () => void flush());
export function clearReadingCache(owner: string) {
  localStorage.removeItem(cacheKey(owner));
  if (uid === owner) { records = {}; pending = {}; publish(); }
}

export async function pauseReadingWritesForDeletion(owner: string): Promise<() => void> {
  pausedOwner=owner; clearTimeout(retry);
  await activeWrite?.catch(() => undefined);
  return () => { if(pausedOwner===owner) pausedOwner=undefined; void flush(); };
}
