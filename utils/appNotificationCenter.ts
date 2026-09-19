export type AppNotificationType = 'book_ready';

export interface AppNotificationItem {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  courseId?: string;
}

type NewAppNotification = Omit<AppNotificationItem, 'createdAt' | 'readAt'> & {
  createdAt?: string;
  readAt?: string | null;
};

const APP_NOTIFICATION_STORAGE_KEY = 'fortale-app-notifications-v1';
const APP_NOTIFICATION_EVENT = 'fortale:app-notifications-changed';
const MAX_STORED_NOTIFICATIONS = 100;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeStoredNotification(value: unknown): AppNotificationItem | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AppNotificationItem>;
  const id = String(candidate.id || '').trim();
  const title = String(candidate.title || '').trim();
  const body = String(candidate.body || '').trim();
  const createdAt = String(candidate.createdAt || '').trim();
  if (!id || !title || !body || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  if (candidate.type !== 'book_ready') return null;

  const readAt = candidate.readAt ? String(candidate.readAt) : null;
  return {
    id,
    type: candidate.type,
    title,
    body,
    createdAt,
    readAt: readAt && !Number.isNaN(Date.parse(readAt)) ? readAt : null,
    courseId: candidate.courseId ? String(candidate.courseId) : undefined
  };
}

function sortNewestFirst(items: AppNotificationItem[]): AppNotificationItem[] {
  return [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function emitChange(items: AppNotificationItem[]): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<AppNotificationItem[]>(APP_NOTIFICATION_EVENT, { detail: items }));
}

function persist(items: AppNotificationItem[]): AppNotificationItem[] {
  const next = sortNewestFirst(items).slice(0, MAX_STORED_NOTIFICATIONS);
  if (isBrowser()) {
    window.localStorage.setItem(APP_NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
    emitChange(next);
  }
  return next;
}

export function readAppNotifications(): AppNotificationItem[] {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APP_NOTIFICATION_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return sortNewestFirst(parsed.map(normalizeStoredNotification).filter((item): item is AppNotificationItem => Boolean(item)));
  } catch {
    return [];
  }
}

export function countUnreadAppNotifications(items: AppNotificationItem[]): number {
  return items.reduce((count, item) => count + (item.readAt ? 0 : 1), 0);
}

export function addAppNotification(input: NewAppNotification): AppNotificationItem[] {
  const now = new Date().toISOString();
  const createdAt = input.createdAt && !Number.isNaN(Date.parse(input.createdAt)) ? input.createdAt : now;
  const incoming: AppNotificationItem = {
    ...input,
    id: String(input.id).trim(),
    title: String(input.title).trim(),
    body: String(input.body).trim(),
    createdAt,
    readAt: input.readAt || null,
    courseId: input.courseId ? String(input.courseId) : undefined
  };
  if (!incoming.id || !incoming.title || !incoming.body) return readAppNotifications();

  const current = readAppNotifications();
  const incomingTime = Date.parse(incoming.createdAt);
  const duplicate = current.find((item) => {
    if (item.id === incoming.id) return true;
    if (incoming.courseId && item.courseId === incoming.courseId) return true;
    return item.title === incoming.title
      && item.body === incoming.body
      && Math.abs(Date.parse(item.createdAt) - incomingTime) <= DEDUPE_WINDOW_MS;
  });

  const notification = duplicate
    ? {
        ...incoming,
        id: duplicate.id,
        courseId: incoming.courseId || duplicate.courseId,
        readAt: null
      }
    : incoming;

  return persist([notification, ...current.filter((item) => item.id !== duplicate?.id && item.id !== notification.id)]);
}

export function markAllAppNotificationsRead(): AppNotificationItem[] {
  const current = readAppNotifications();
  if (current.every((item) => item.readAt)) return current;
  const readAt = new Date().toISOString();
  return persist(current.map((item) => item.readAt ? item : { ...item, readAt }));
}

export function clearAppNotifications(): AppNotificationItem[] {
  return persist([]);
}

export function subscribeToAppNotifications(listener: (items: AppNotificationItem[]) => void): () => void {
  if (!isBrowser()) return () => undefined;

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<AppNotificationItem[]>).detail;
    listener(Array.isArray(detail) ? detail : readAppNotifications());
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === APP_NOTIFICATION_STORAGE_KEY) listener(readAppNotifications());
  };

  window.addEventListener(APP_NOTIFICATION_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(APP_NOTIFICATION_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
}
