import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, BookOpen, ChevronLeft, Download, Flag, Heart, Library, MessageCircle,
  Search, ShieldBan, ShieldCheck, Sparkles, UserPlus, Users, X
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { functions } from '../firebaseConfig';
import { CommunityBook, CreditActionType, CreditWallet, SmartBookBookType, ViewState } from '../types';
import { CREDIT_WALLET_UPDATED_EVENT } from '../ai';
import { COMMUNITY_DOWNLOAD_CREDIT_COST } from '../utils/creditCosts';
import FaviconSpinner from '../components/FaviconSpinner';
import FortaleDropdown, { FortaleDropdownOption } from '../components/FortaleDropdown';
import { useUiI18n } from '../i18n/uiI18n';
import { normalizeAppLanguageCode } from '../data/appLanguages';

interface CommunityViewProps {
  authUser: User | null;
  wallet: CreditWallet;
  onRequireCredit: (action: CreditActionType, costOverride?: number) => boolean;
  onNavigate: (view: ViewState) => void;
  onOpenPaywall?: () => void;
}

type CommunityTab = 'discover' | 'popular' | 'new' | 'following';
type BookTypeFilter = SmartBookBookType | 'all';

type CommunityPreviewImage = {
  id: string;
  title: string;
  url: string;
};

interface CommunityComment {
  id: string;
  userId: string;
  alias: string;
  text: string;
  createdAt: number;
  isMine?: boolean;
}

interface CommunityDetailResult {
  book: CommunityBookDto;
  isFollowing: boolean;
  comments: CommunityComment[];
}

interface CommunityBookDto extends Omit<CommunityBook, 'publishedAt'> {
  publishedAt: number;
  updatedAt?: number;
}

interface CommunityListResult {
  books: CommunityBookDto[];
  filters: { languages: string[]; categories: string[]; ageGroups: string[] };
}

interface DownloadResult {
  wallet: CreditWallet;
  communityBook: CommunityBookDto;
  bookId: string;
  alreadyOwned: boolean;
}

interface CommunityNotification {
  id: string;
  type: 'follow' | 'comment' | 'download_reward';
  actorAlias: string;
  communityBookId?: string;
  isRead: boolean;
  createdAt: number;
}

interface ModerationQueueItem {
  id: string;
  entityType: 'book' | 'comment' | 'profile';
  targetId: string;
  communityBookId?: string;
  reason: string;
  createdAt: number;
  preview: { title?: string; description?: string; coverImageUrl?: string; text?: string; alias?: string; bio?: string; ownerId?: string; status?: string };
}

const listBooksFn = httpsCallable<Record<string, unknown>, CommunityListResult>(functions, 'listCommunityBooks');
const getBookFn = httpsCallable<{ communityBookId: string }, CommunityDetailResult>(functions, 'getCommunityBook');
const likeFn = httpsCallable<{ communityBookId: string }, { liked: boolean; likeCount: number }>(functions, 'toggleCommunityLike');
const followFn = httpsCallable<{ userId: string }, { following: boolean; followerCount: number }>(functions, 'toggleCommunityFollow');
const addCommentFn = httpsCallable<{ communityBookId: string; text: string }, { comment: CommunityComment }>(functions, 'addCommunityComment');
const deleteCommentFn = httpsCallable<{ communityBookId: string; commentId: string }, { ok: boolean }>(functions, 'deleteCommunityComment');
const reportFn = httpsCallable<Record<string, unknown>, { ok: boolean }>(functions, 'reportCommunityContent');
const blockFn = httpsCallable<{ userId: string }, { ok: boolean }>(functions, 'blockCommunityUser');
const downloadFn = httpsCallable<{ communityBookId: string }, DownloadResult>(functions, 'downloadCommunityBook');
const upsertProfileFn = httpsCallable<Record<string, unknown>, { alias: string; bio: string }>(functions, 'upsertCommunityProfile');
const listNotificationsFn = httpsCallable<Record<string, never>, { notifications: CommunityNotification[] }>(functions, 'listCommunityNotifications');
const markNotificationsReadFn = httpsCallable<Record<string, never>, { updated: number }>(functions, 'markCommunityNotificationsRead');
const listModerationQueueFn = httpsCallable<Record<string, never>, { items: ModerationQueueItem[] }>(functions, 'listCommunityModerationQueue');
const moderateItemFn = httpsCallable<Record<string, unknown>, { ok: boolean }>(functions, 'moderateCommunityItem');

function parseBook(dto: CommunityBookDto): CommunityBook {
  return { ...dto, publishedAt: new Date(dto.publishedAt || Date.now()) };
}

function typeLabel(type: SmartBookBookType): string {
  if (type === 'fairy_tale') return 'Masal';
  if (type === 'novel') return 'Hikaye';
  return 'Çalışma Kitabı';
}

function typeStyle(type: SmartBookBookType): React.CSSProperties {
  if (type === 'novel') return { color: '#fecaca', background: 'rgba(220,38,38,.22)', borderColor: 'rgba(248,113,113,.58)' };
  if (type === 'story') return { color: '#172033', background: '#f7d84b', borderColor: '#ffe77d' };
  return { color: '#172033', background: 'rgba(255,255,255,.92)', borderColor: '#fff' };
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) return String((error as { code?: unknown }).code || '');
  return '';
}

function formatCommunityLanguage(value: string | undefined, locale: string): string {
  const normalized = normalizeAppLanguageCode(value);
  if (!normalized) return String(value || '').trim();
  const displayCode = normalized.split('-').map((part, index) => index === 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : part.toUpperCase()).join('-');
  let label = normalized;
  try {
    label = new Intl.DisplayNames([locale], { type: 'language' }).of(normalized) || normalized;
  } catch {
    label = normalized;
  }
  return `${displayCode} - ${label.charAt(0).toLocaleUpperCase(locale)}${label.slice(1)}`;
}

function BookCover({ book }: { book: CommunityBook }) {
  const hue = useMemo(() => Math.abs(book.title.split('').reduce((sum, char) => sum * 31 + char.charCodeAt(0), 0)) % 360, [book.title]);
  if (book.coverImageUrl) return <img src={book.coverImageUrl} alt={book.title} className="h-full w-full object-cover" loading="lazy" />;
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(150deg,hsl(${hue},42%,22%),hsl(${(hue + 45) % 360},34%,10%))` }}>
      <BookOpen size={30} className="text-white/55" />
    </div>
  );
}

function BookCard({ book, onOpen, onLike }: { book: CommunityBook; onOpen: () => void; onLike: () => void }) {
  const { locale, t } = useUiI18n();
  return (
    <article className="fortale-library-card overflow-hidden rounded-[22px] border bg-[#101c2b]/75 p-2.5">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#09101a]">
          <BookCover book={book} />
          {book.isFeatured && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-1 text-[9px] font-black text-[#1b2230]">
              <Sparkles size={9} /> {t('Seçki')}
            </span>
          )}
        </div>
        <h3 className="mt-2.5 line-clamp-2 min-h-[34px] text-[13px] font-bold leading-[1.3] text-white">{book.title}</h3>
        <p className="mt-1 truncate text-[10px] font-semibold text-[#9fbbd7]">@{book.publisherAlias || t('Fortale üreticisi')}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded-full border px-2 py-1 text-[9px] font-black" style={typeStyle(book.bookType)}>{t(typeLabel(book.bookType))}</span>
          {book.language && <span className="truncate text-[9px] text-white/50">{formatCommunityLanguage(book.language, locale)}</span>}
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
        <button type="button" onClick={onLike} className={`inline-flex items-center gap-1 text-[10px] font-bold ${book.isLiked ? 'text-rose-400' : 'text-white/50'}`}>
          <Heart size={12} fill={book.isLiked ? 'currentColor' : 'none'} /> {book.likeCount}
        </button>
        <span className="inline-flex items-center gap-1 text-[10px] text-white/45"><Download size={11} /> {book.downloadCount}</span>
      </div>
    </article>
  );
}

export default function CommunityView({ authUser, wallet, onRequireCredit, onNavigate, onOpenPaywall }: CommunityViewProps) {
  const { locale, t } = useUiI18n();
  const [tab, setTab] = useState<CommunityTab>('discover');
  const [books, setBooks] = useState<CommunityBook[]>([]);
  const [filters, setFilters] = useState({ languages: [] as string[], categories: [] as string[], ageGroups: [] as string[] });
  const [bookType, setBookType] = useState<BookTypeFilter>('all');
  const [language, setLanguage] = useState('all');
  const [category, setCategory] = useState('all');
  const [ageGroup, setAgeGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CommunityBook | null>(null);
  const [imageViewer, setImageViewer] = useState<CommunityPreviewImage | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationItems, setModerationItems] = useState<ModerationQueueItem[]>([]);
  const [alias, setAlias] = useState('');
  const [bio, setBio] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadBooks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await listBooksFn({ tab, bookType, language, category, ageGroup, search: debouncedSearch, limit: 36 });
      setBooks(result.data.books.map(parseBook));
      setFilters(result.data.filters);
    } catch {
      setError(t('Kitaplar yüklenemedi.'));
    } finally {
      setIsLoading(false);
    }
  }, [ageGroup, bookType, category, debouncedSearch, language, tab, t]);

  useEffect(() => { void loadBooks(); }, [loadBooks]);

  const requireAccount = useCallback(() => {
    if (authUser) return true;
    showToast(t('Bu işlem için giriş yapmanız gerekiyor.'));
    return false;
  }, [authUser, showToast, t]);

  const maybeOpenProfile = useCallback((error: unknown) => {
    const code = errorCode(error);
    if (code.includes('failed-precondition')) {
      setProfileOpen(true);
      showToast(t('Önce topluluk profilinizi tamamlayın.'));
      return true;
    }
    return false;
  }, [showToast, t]);

  const openDetail = useCallback(async (book: CommunityBook) => {
    setSelected(book);
    setIsDetailLoading(true);
    try {
      const result = await getBookFn({ communityBookId: book.id });
      setSelected(parseBook(result.data.book));
      setComments(result.data.comments || []);
      setIsFollowing(result.data.isFollowing);
    } catch {
      showToast(t('Kitap ayrıntıları yüklenemedi.'));
      setSelected(null);
    } finally {
      setIsDetailLoading(false);
    }
  }, [showToast, t]);

  const updateBookEverywhere = useCallback((id: string, patch: Partial<CommunityBook>) => {
    setBooks((current) => current.map((book) => book.id === id ? { ...book, ...patch } : book));
    setSelected((current) => current?.id === id ? { ...current, ...patch } : current);
  }, []);

  const handleLike = useCallback(async (book: CommunityBook) => {
    if (!requireAccount() || busyAction) return;
    setBusyAction(`like:${book.id}`);
    try {
      const result = await likeFn({ communityBookId: book.id });
      updateBookEverywhere(book.id, { isLiked: result.data.liked, likeCount: result.data.likeCount });
    } catch (error) {
      if (!maybeOpenProfile(error)) showToast(t('İşlem tamamlanamadı.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, maybeOpenProfile, requireAccount, showToast, t, updateBookEverywhere]);

  const handleFollow = useCallback(async () => {
    if (!selected || !requireAccount() || busyAction) return;
    setBusyAction('follow');
    try {
      const result = await followFn({ userId: selected.userId });
      setIsFollowing(result.data.following);
    } catch (error) {
      if (!maybeOpenProfile(error)) showToast(t('İşlem tamamlanamadı.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, maybeOpenProfile, requireAccount, selected, showToast, t]);

  const handleComment = useCallback(async () => {
    if (!selected || !commentText.trim() || !requireAccount() || busyAction) return;
    setBusyAction('comment');
    try {
      const result = await addCommentFn({ communityBookId: selected.id, text: commentText.trim() });
      setComments((current) => [result.data.comment, ...current]);
      updateBookEverywhere(selected.id, { commentCount: (selected.commentCount || 0) + 1 });
      setCommentText('');
    } catch (error) {
      if (!maybeOpenProfile(error)) showToast(t('Yorum gönderilemedi.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, commentText, maybeOpenProfile, requireAccount, selected, showToast, t, updateBookEverywhere]);

  const handleDeleteComment = useCallback(async (comment: CommunityComment) => {
    if (!selected || busyAction) return;
    setBusyAction(`delete:${comment.id}`);
    try {
      await deleteCommentFn({ communityBookId: selected.id, commentId: comment.id });
      setComments((current) => current.filter((item) => item.id !== comment.id));
      updateBookEverywhere(selected.id, { commentCount: Math.max(0, (selected.commentCount || 0) - 1) });
    } catch {
      showToast(t('Yorum silinemedi.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, selected, showToast, t, updateBookEverywhere]);

  const handleDownload = useCallback(async () => {
    if (!selected || !requireAccount() || busyAction) return;
    if (selected.userId === authUser?.uid) return showToast(t('Kendi kitabınız zaten kitaplığınızda.'));
    if (!selected.isOwned && (!onRequireCredit('community_download', COMMUNITY_DOWNLOAD_CREDIT_COST) || wallet.createCredits < COMMUNITY_DOWNLOAD_CREDIT_COST)) {
      onOpenPaywall?.();
      return;
    }
    setBusyAction('download');
    try {
      const result = await downloadFn({ communityBookId: selected.id });
      window.dispatchEvent(new CustomEvent(CREDIT_WALLET_UPDATED_EVENT, { detail: result.data.wallet }));
      updateBookEverywhere(selected.id, {
        isOwned: true,
        downloadCount: selected.downloadCount + (result.data.alreadyOwned ? 0 : 1)
      });
      showToast(result.data.alreadyOwned ? t('Kitap zaten kitaplığınızda.') : t('Kitap kitaplığınıza eklendi!'));
    } catch (error) {
      if (errorCode(error).includes('resource-exhausted')) onOpenPaywall?.();
      else if (!maybeOpenProfile(error)) showToast(t('İndirme başarısız oldu.'));
    } finally {
      setBusyAction('');
    }
  }, [authUser?.uid, busyAction, maybeOpenProfile, onOpenPaywall, onRequireCredit, requireAccount, selected, showToast, t, updateBookEverywhere, wallet.createCredits]);

  const handleReport = useCallback(async (entityType: 'book' | 'comment' | 'profile', targetId: string, communityBookId?: string) => {
    if (!requireAccount() || busyAction) return;
    const reason = window.prompt(t('Rapor nedenini kısaca yazın.'))?.trim();
    if (!reason) return;
    setBusyAction('report');
    try {
      await reportFn({ entityType, targetId, communityBookId, reason });
      showToast(t('Raporunuz moderasyon ekibine iletildi.'));
    } catch (error) {
      if (!maybeOpenProfile(error)) showToast(t('Rapor gönderilemedi.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, maybeOpenProfile, requireAccount, showToast, t]);

  const handleBlock = useCallback(async () => {
    if (!selected || !requireAccount() || busyAction || !window.confirm(t('Bu üreticiyi engellemek istiyor musunuz?'))) return;
    setBusyAction('block');
    try {
      await blockFn({ userId: selected.userId });
      setBooks((current) => current.filter((book) => book.userId !== selected.userId));
      setSelected(null);
      showToast(t('Üretici engellendi.'));
    } catch {
      showToast(t('İşlem tamamlanamadı.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, requireAccount, selected, showToast, t]);

  const saveProfile = useCallback(async () => {
    if (!requireAccount() || busyAction) return;
    setBusyAction('profile');
    try {
      await upsertProfileFn({ alias, bio, ageConfirmed, termsAccepted });
      setProfileOpen(false);
      showToast(t('Topluluk profiliniz kaydedildi.'));
    } catch (error) {
      const code = errorCode(error);
      showToast(code.includes('already-exists') ? t('Bu rumuz kullanılıyor.') : t('Profil kaydedilemedi.'));
    } finally {
      setBusyAction('');
    }
  }, [ageConfirmed, alias, bio, busyAction, requireAccount, showToast, t, termsAccepted]);

  const openNotifications = useCallback(async () => {
    if (!requireAccount() || busyAction) return;
    setNotificationsOpen(true);
    setBusyAction('notifications');
    try {
      const result = await listNotificationsFn({});
      setNotifications(result.data.notifications || []);
      if (result.data.notifications.some((item) => !item.isRead)) void markNotificationsReadFn({});
    } catch {
      showToast(t('İşlem tamamlanamadı.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, requireAccount, showToast, t]);

  const openModeration = useCallback(async () => {
    if (busyAction) return;
    setModerationOpen(true);
    setBusyAction('moderation');
    try {
      const result = await listModerationQueueFn({});
      setModerationItems(result.data.items || []);
    } catch {
      setModerationOpen(false);
      showToast(t('İşlem tamamlanamadı.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, showToast, t]);

  const moderateItem = useCallback(async (item: ModerationQueueItem, action: 'restore' | 'remove' | 'suspend_creator') => {
    if (busyAction) return;
    setBusyAction(`moderate:${item.id}`);
    try {
      await moderateItemFn({ entityType: item.entityType, targetId: item.targetId, communityBookId: item.communityBookId, action });
      setModerationItems((current) => current.filter((entry) => !(entry.entityType === item.entityType && entry.targetId === item.targetId)));
    } catch {
      showToast(t('İşlem tamamlanamadı.'));
    } finally {
      setBusyAction('');
    }
  }, [busyAction, showToast, t]);

  const tabs: Array<{ id: CommunityTab; label: string }> = [
    { id: 'discover', label: t('Keşfet') },
    { id: 'popular', label: t('Popüler') },
    { id: 'new', label: t('Yeni') },
    { id: 'following', label: t('Takip') }
  ];
  const bookTypeOptions: Array<FortaleDropdownOption<BookTypeFilter>> = [
    { value: 'all', label: t('Tüm Türler') },
    { value: 'fairy_tale', label: t('Masal') },
    { value: 'novel', label: t('Hikaye') },
    { value: 'story', label: t('Çalışma Kitabı') }
  ];
  const languageOptions: Array<FortaleDropdownOption<string>> = [
    { value: 'all', label: t('Tüm Diller') },
    ...filters.languages.map((item) => ({ value: item, label: formatCommunityLanguage(item, locale) }))
  ];
  const ageGroupOptions: Array<FortaleDropdownOption<string>> = [
    { value: 'all', label: t('Tüm Yaş ve Seviyeler') },
    ...filters.ageGroups.map((item) => ({ value: item, label: t(item) }))
  ];
  const categoryOptions: Array<FortaleDropdownOption<string>> = [
    { value: 'all', label: t('Tüm Kategoriler') },
    ...filters.categories.map((item) => ({ value: item, label: t(item) }))
  ];
  const canAccessSelectedComments = Boolean(authUser && selected && (selected.isOwned || selected.userId === authUser.uid));

  return (
    <div className="view-container fortale-library-view">
      <div className="app-content-width fortale-library-content space-y-4 pb-24">
        <section className="fortale-library-hero">
          <p>{t('Fortale')}</p>
          <div className="flex items-center justify-between gap-3">
            <h1>{t('Topluluk')}</h1>
            <div className="flex items-center gap-2">
              {authUser?.email?.toLowerCase() === 'ttuloglu@gmail.com' && <button type="button" onClick={() => void openModeration()} className="fortale-chrome-icon-button flex h-9 w-9 items-center justify-center rounded-full text-white" title={t('Raporla')}><ShieldCheck size={17} /></button>}
              <button type="button" onClick={() => authUser ? setProfileOpen(true) : requireAccount()} className="fortale-chrome-icon-button flex h-9 w-9 items-center justify-center rounded-full text-white" title={t('Topluluk Profili')}><Users size={17} /></button>
              <button type="button" onClick={() => void openNotifications()} className="fortale-chrome-icon-button relative flex h-9 w-9 items-center justify-center rounded-full text-white" title={t('Bildirimler')}><Bell size={17} />{notifications.some((item) => !item.isRead) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-400" />}</button>
            </div>
          </div>
          <span>{t('Keşfet, önizle ve kitaplığına ekle')}</span>
        </section>

        <section className="fortale-library-panel relative z-[60] space-y-3 overflow-visible rounded-2xl border p-3">
          <div className="fortale-library-mode-switch grid grid-cols-4 gap-1 rounded-xl border p-1">
            {tabs.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`fortale-library-mode-button h-9 rounded-lg text-[10px] font-black ${tab === item.id ? 'is-active text-[#0b1d32]' : 'text-[#9db5cd]'}`}>{item.label}</button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Kitap, üretici, kategori veya etiket ara')} className="h-10 w-full rounded-xl border border-white/10 bg-[#0d1a29]/70 pl-9 pr-3 text-[12px] text-white outline-none placeholder:text-white/35" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FortaleDropdown label={t('Kitap Türü')} value={bookType} options={bookTypeOptions} onChange={setBookType} />
            <FortaleDropdown label={t('Dil')} value={language} options={languageOptions} onChange={setLanguage} />
            <FortaleDropdown label={t('Yaş Grubu')} value={ageGroup} options={ageGroupOptions} onChange={setAgeGroup} />
            <FortaleDropdown label={t('Kategori')} value={category} options={categoryOptions} onChange={setCategory} />
          </div>
        </section>

        {isLoading ? (
          <div className="fortale-library-panel flex items-center justify-center rounded-2xl border p-10"><FaviconSpinner size={26} /></div>
        ) : error ? (
          <div className="fortale-library-panel rounded-2xl border p-8 text-center"><p className="text-[12px] text-red-300">{error}</p><button type="button" onClick={() => void loadBooks()} className="mt-3 text-[11px] font-bold text-white underline">{t('Tekrar dene')}</button></div>
        ) : books.length === 0 ? (
          <div className="fortale-library-panel rounded-2xl border p-8 text-center"><Library size={28} className="mx-auto text-white/30" /><p className="mt-3 text-[13px] font-bold text-white/70">{t('Bu filtrede kitap bulunamadı.')}</p><button type="button" onClick={() => onNavigate('AI_CHAT')} className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 text-[11px] font-black text-[#102018]">{t('Kitaplarıma Git')}</button></div>
        ) : (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {books.map((book) => <BookCard key={book.id} book={book} onOpen={() => void openDetail(book)} onLike={() => void handleLike(book)} />)}
          </section>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[80] bg-[#07101a]/95 backdrop-blur-xl">
          <div className="relative mx-auto h-full w-full max-w-xl overflow-y-auto pb-28">
            <button type="button" onClick={() => setSelected(null)} className="fortale-chrome-icon-button absolute left-4 top-[calc(env(safe-area-inset-top,0px)+12px)] z-20 flex h-10 w-10 items-center justify-center rounded-full text-white"><ChevronLeft size={21} /></button>
            {isDetailLoading ? <div className="flex justify-center p-16"><FaviconSpinner size={28} /></div> : (
              <div className="space-y-5 p-4 pt-[calc(env(safe-area-inset-top,0px)+64px)]">
                <section className="flex gap-4">
                  <div className="h-[168px] w-[126px] shrink-0 overflow-hidden bg-black"><BookCover book={selected} /></div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex rounded-full border px-2 py-1 text-[9px] font-black" style={typeStyle(selected.bookType)}>{t(typeLabel(selected.bookType))}</span>
                    <h2 className="mt-2 text-[20px] font-black leading-tight text-white">{selected.title}</h2>
                    {selected.userId === authUser?.uid ? (
                      <p className="mt-2 text-[11px] font-bold text-[#9fc7e9]">@{selected.publisherAlias}</p>
                    ) : (
                      <button type="button" onClick={() => void handleFollow()} disabled={busyAction === 'follow'} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-[#9fc7e9] disabled:opacity-60"><UserPlus size={13} /> @{selected.publisherAlias} · {isFollowing ? t('Takip Ediliyor') : t('Takip Et')}</button>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/55">
                      {selected.language && <span>{formatCommunityLanguage(selected.language, locale)}</span>}{selected.bookType === 'story' ? (selected.category && <span>• {t(selected.category)}</span>) : (selected.ageGroup && <span>• {selected.ageGroup}</span>)}{selected.pageCount ? <span>• {selected.pageCount} {t('sayfa')}</span> : null}<button type="button" onClick={() => void handleReport('book', selected.id)} className="inline-flex items-center gap-1 text-white/45 hover:text-white/75" title={t('Raporla')}><span>•</span><Flag size={12} /></button>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-[11px] text-white/60"><span className="inline-flex items-center gap-1"><Heart size={13} /> {selected.likeCount}</span><span className="inline-flex items-center gap-1"><Download size={13} /> {selected.downloadCount}</span><span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {selected.commentCount || 0}</span></div>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  {selected.coverImageUrl && (
                    <button type="button" onClick={() => setImageViewer({ id: 'cover', title: t('Kapak'), url: selected.coverImageUrl || '' })} className="group overflow-hidden bg-black/20 text-left">
                      <div className="aspect-[4/3] overflow-hidden bg-[#09101a]"><img src={selected.coverImageUrl} alt={selected.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" /></div>
                      <div className="px-3 py-2 text-[10px] font-black text-white/70">{t('Kapak')}</div>
                    </button>
                  )}
                  {selected.previewImages?.[0]?.url && (
                    <button type="button" onClick={() => setImageViewer(selected.previewImages?.[0] || null)} className="group overflow-hidden bg-black/20 text-left">
                      <div className="aspect-[4/3] overflow-hidden bg-[#09101a]"><img src={selected.previewImages[0].url} alt={selected.previewImages[0].title || selected.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" /></div>
                      <div className="truncate px-3 py-2 text-[10px] font-black text-white/70">{selected.previewImages[0].title || t('İçerik')}</div>
                    </button>
                  )}
                </section>

                {selected.description && <p className="line-clamp-3 px-1 text-[12px] leading-5 text-[#bdd0e2]">{selected.description}</p>}
                {selected.outline && selected.outline.length > 0 && <section className="px-1"><h3 className="text-[11px] font-black text-white/70">{t('İçindekiler')}</h3><div className="mt-2 flex flex-wrap gap-1.5">{selected.outline.slice(0, 6).map((title, index) => <span key={`${title}-${index}`} className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-[#bdd0e2]">{title}</span>)}</div></section>}
                {selected.preview && selected.preview.length > 0 && <section className="space-y-5 px-1"><h3 className="text-[12px] font-black uppercase tracking-wider text-white/70">{t('İlk iki bölüm önizlemesi')}</h3>{selected.preview.slice(0, 2).map((page) => <article key={page.id} className="community-preview-markdown prose prose-invert max-w-none overflow-hidden text-[15px] leading-7 text-[#d2deea]"><h4 className="mb-3 text-[17px] font-black text-white">{page.title}</h4><div className="line-clamp-[18]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{page.content}</ReactMarkdown></div></article>)}</section>}

                {canAccessSelectedComments && <section className="px-1">
                  <h3 className="text-[12px] font-black text-white">{t('Yorumlar')}</h3>
                  <div className="mt-3 flex gap-2"><textarea value={commentText} maxLength={500} onChange={(event) => setCommentText(event.target.value)} placeholder={t('Yorum yaz (en fazla 500 karakter)')} className="min-h-20 flex-1 resize-none rounded-xl border border-white/10 bg-[#0b1725] p-3 text-[12px] text-white outline-none placeholder:text-white/30" /><button type="button" onClick={() => void handleComment()} disabled={!commentText.trim() || busyAction === 'comment'} className="self-end rounded-xl bg-[#7eb79b] px-3 py-2 text-[11px] font-black text-[#102018] disabled:opacity-40">{t('Gönder')}</button></div>
                  <div className="mt-4 space-y-4">{comments.length === 0 ? <p className="text-[11px] text-white/35">{t('Henüz yorum yok.')}</p> : comments.map((comment) => <div key={comment.id}><div className="flex items-center justify-between"><span className="text-[10px] font-black text-[#9fc7e9]">@{comment.alias}</span><span className="text-[9px] text-white/30">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(comment.createdAt))}</span></div><p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#c8d7e5]">{comment.text}</p><div className="mt-2 flex gap-3">{comment.isMine && <button type="button" onClick={() => void handleDeleteComment(comment)} className="text-[9px] font-bold text-rose-300">{t('Sil')}</button>}<button type="button" onClick={() => void handleReport('comment', comment.id, selected.id)} className="text-[9px] font-bold text-white/35">{t('Raporla')}</button></div></div>)}</div>
                </section>}

                {selected.userId !== authUser?.uid && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void handleBlock()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 py-3 text-[11px] font-bold text-rose-200"><ShieldBan size={14} /> {t('Üreticiyi Engelle')}</button><button type="button" onClick={() => void handleReport('profile', selected.userId)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-[11px] font-bold text-white/60"><Flag size={14} /> {t('Profili Raporla')}</button></div>}
              </div>
            )}
            {!isDetailLoading && <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl border-t border-white/10 bg-[#091522]/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] backdrop-blur-xl"><button type="button" onClick={() => void handleDownload()} disabled={busyAction === 'download' || selected.userId === authUser?.uid} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#7eb79b] py-4 text-[13px] font-black text-[#102018] disabled:opacity-55">{busyAction === 'download' ? <FaviconSpinner size={16} /> : selected.isOwned ? <><Library size={16} /> {t('Kitaplığımda')}</> : <><Download size={16} /> {t('0.5 krediyle kitaplığıma ekle')}</>}</button></div>}
          </div>
        </div>
      )}

      {imageViewer && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setImageViewer(null)}>
          <button type="button" onClick={() => setImageViewer(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"><X size={18} /></button>
          <div className="max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
            <img src={imageViewer.url} alt={imageViewer.title} className="max-h-[86vh] max-w-[94vw] object-contain shadow-2xl" />
            <p className="mt-3 text-center text-[12px] font-bold text-white/70">{imageViewer.title}</p>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#101b29] p-5 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="text-[17px] font-black text-white">{t('Topluluk Profili')}</h2><p className="mt-1 text-[11px] text-white/45">{t('Gerçek adınız ve e-postanız gösterilmez.')}</p></div><button type="button" onClick={() => setProfileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white"><X size={17} /></button></div>
            <label className="mt-5 block text-[11px] font-bold text-white/70">{t('Topluluk rumuzu')}<input value={alias} maxLength={32} onChange={(event) => setAlias(event.target.value)} placeholder={t('2–32 karakter')} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a1522] px-3 text-[13px] text-white outline-none" /></label>
            <label className="mt-3 block text-[11px] font-bold text-white/70">{t('Biyografi')}<textarea value={bio} maxLength={160} onChange={(event) => setBio(event.target.value)} className="mt-2 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-[#0a1522] p-3 text-[12px] text-white outline-none" /></label>
            <label className="mt-4 flex items-start gap-3 text-[11px] leading-5 text-[#c5d5e4]"><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('13 yaşında veya daha büyük olduğumu onaylıyorum.')}</label>
            <label className="mt-3 flex items-start gap-3 text-[11px] leading-5 text-[#c5d5e4]"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('Topluluk kurallarını, moderasyonu ve kişisel kullanım lisansını kabul ediyorum.')}</label>
            <button type="button" onClick={() => void saveProfile()} disabled={!alias.trim() || !ageConfirmed || !termsAccepted || busyAction === 'profile'} className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[#7eb79b] text-[13px] font-black text-[#102018] disabled:opacity-40">{busyAction === 'profile' ? <FaviconSpinner size={16} /> : t('Profili Kaydet')}</button>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-[26px] border border-white/10 bg-[#101b29] p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-[17px] font-black text-white">{t('Bildirimler')}</h2><button type="button" onClick={() => setNotificationsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white"><X size={17} /></button></div>
            {busyAction === 'notifications' ? <div className="flex justify-center p-10"><FaviconSpinner size={22} /></div> : <div className="mt-4 space-y-2">{notifications.length === 0 ? <p className="py-8 text-center text-[11px] text-white/35">—</p> : notifications.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#17314a] text-[#a9d0ee]">{item.type === 'follow' ? <UserPlus size={15} /> : item.type === 'comment' ? <MessageCircle size={15} /> : <Download size={15} />}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-white">@{item.actorAlias}</p><p className="mt-1 text-[10px] text-white/45">{item.type === 'follow' ? t('Takip') : item.type === 'comment' ? t('Yorumlar') : '+0.25'}</p></div><span className="text-[9px] text-white/30">{new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(item.createdAt))}</span></div>)}</div>}
          </div>
        </div>
      )}

      {moderationOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[26px] border border-white/10 bg-[#101b29] p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-[17px] font-black text-white">{t('Raporla')}</h2><button type="button" onClick={() => setModerationOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white"><X size={17} /></button></div>
            {busyAction === 'moderation' ? <div className="flex justify-center p-10"><FaviconSpinner size={22} /></div> : <div className="mt-4 space-y-3">{moderationItems.length === 0 ? <p className="py-10 text-center text-[12px] text-white/35">—</p> : moderationItems.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-start gap-3">{item.preview.coverImageUrl && <img src={item.preview.coverImageUrl} alt="" className="h-20 w-[60px] rounded-lg object-cover" />}<div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{item.entityType} · {item.preview.status}</p><h3 className="mt-1 text-[13px] font-black text-white">{item.preview.title || item.preview.alias || item.preview.text || item.targetId}</h3><p className="mt-2 text-[11px] leading-5 text-[#bdcddd]">{item.preview.description || item.preview.bio || item.preview.text}</p><p className="mt-2 rounded-lg bg-rose-400/10 p-2 text-[10px] text-rose-100">{item.reason}</p></div></div><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => void moderateItem(item, 'restore')} className="rounded-xl bg-emerald-400/15 py-2 text-[10px] font-black text-emerald-100">{t('Geri')}</button><button type="button" onClick={() => void moderateItem(item, 'remove')} className="rounded-xl bg-rose-400/15 py-2 text-[10px] font-black text-rose-100">{t('Sil')}</button><button type="button" onClick={() => void moderateItem(item, 'suspend_creator')} className="rounded-xl bg-amber-400/15 py-2 text-[10px] font-black text-amber-100">{t('Üreticiyi Engelle')}</button></div></article>)}</div>}
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-24 left-1/2 z-[110] w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-2xl border border-white/12 bg-[#0b1724]/95 px-4 py-3 text-center text-[12px] font-bold text-white shadow-2xl backdrop-blur-xl">{toast}</div>}
    </div>
  );
}
