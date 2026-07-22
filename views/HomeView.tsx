import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { httpsCallable } from 'firebase/functions';
import {
  ViewState,
  CourseData,
  CommunityBook,
  TimelineNode,
  StickyNoteData,
  SmartBookAgeGroup,
  CreditActionType,
  SmartBookBookType,
  SmartBookCreativeBrief,
  CourseOpenUiState,
  CreditWallet
} from '../types';
import { Plus, BookOpen, ChevronDown, StickyNote, X, Trash2, Check, Download, Copy, Share2, Bell, BookPlus, ArrowRight, ArrowLeft, Telescope, ScrollText, ImagePlus, UserRound, Feather, Heart, MessageCircle, Library } from 'lucide-react';
import { cancelBookGenerationJob, CREDIT_WALLET_UPDATED_EVENT, extractDocumentContext, formatAiUsageEntryForConsole, formatBookGenerationCostSummaryForConsole, getBookGenerationJob, startBookGenerationJob, type BookGenerationJobResult } from '../ai';
import { FREE_PLAN_LIMITS } from '../planLimits';
import FaviconSpinner from '../components/FaviconSpinner';
import FLogo from '../components/FLogo';
import FortaleDropdown from '../components/FortaleDropdown';
import FloatIslandSheet from '../components/FloatIslandSheet';
import { BOOK_CONTENT_SAFETY_MESSAGE, findRestrictedBookTopicInTexts } from '../utils/contentSafety';
import {
  SMARTBOOK_SUBGENRE_OPTIONS,
  SMARTBOOK_THEME_OPTIONS,
  buildTargetPageFromBrief,
  getEstimatedGenerationMinutes,
  getPageRangeByBookType
} from '../utils/bookGeneration';
import {
  getDefaultSmartBookAgeGroupForBookType,
  getSmartBookAgeGroupLabel,
  getSmartBookAgeGroupOptionsForBookType,
  isSmartBookAgeGroupAllowedForBookType
} from '../utils/smartbookAgeGroup';
import { COMMUNITY_DOWNLOAD_CREDIT_COST, getBookTypeCreateCreditCost } from '../utils/creditCosts';
import { useUiI18n } from '../i18n/uiI18n';
import { normalizeAppLanguageCode, type AppLanguageCode } from '../data/appLanguages';
import { LITERARY_FACTS } from '../data/literaryFacts';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { functions } from '../firebaseConfig';
import { getCommunityBookSectionLabels } from '../utils/communityBookLanguage';
import { getOwnedCommunityCourseId } from '../utils/communityOwnedCourse';

interface HomeViewProps {
  onNavigate: (view: ViewState) => void;
  onCourseCreate: (data: CourseData) => Promise<void>;
  onDeleteCourse: (courseId: string) => Promise<void>;
  savedCourses: CourseData[];
  onCourseSelect: (id: string) => boolean | Promise<boolean>;
  canDeleteCourse?: (course: CourseData) => boolean;
  stickyNotes: StickyNoteData[];
  onCreateStickyNote: (payload: { title?: string; text: string; reminderAt?: string | null }) => Promise<StickyNoteData | undefined>;
  onUpdateStickyNote: (noteId: string, payload: { title?: string; text: string; reminderAt?: string | null }) => Promise<StickyNoteData | undefined>;
  onDeleteStickyNote: (noteId: string) => Promise<void>;
  onRequireCredit: (action: CreditActionType, costOverride?: number) => boolean;
  onConsumeCredit: (action: CreditActionType, costOverride?: number) => Promise<boolean> | boolean;
  isBootstrapping?: boolean;
  bootstrapMessage?: string;
  defaultBookLanguage?: string;
  courseOpenStates?: Record<string, CourseOpenUiState>;
  isLoggedIn?: boolean;
  onRequestLogin?: () => void;
  authUserId?: string;
}

type StickyModalState = {
  isOpen: boolean;
  noteId: string | null;
  title: string;
  text: string;
  reminderAt: string | null;
  createdAt: string;
};

interface HomeCommunityBookDto extends Omit<CommunityBook, 'publishedAt'> {
  publishedAt: number;
  updatedAt?: number;
}

interface HomeCommunityListResult {
  books: HomeCommunityBookDto[];
  filters: { languages: string[]; categories: string[]; ageGroups: string[] };
}

interface HomeCommunityDetailResult {
  book: HomeCommunityBookDto;
  isFollowing: boolean;
  comments: unknown[];
}

interface HomeCommunityDownloadResult {
  wallet: CreditWallet;
  communityBook: HomeCommunityBookDto;
  bookId: string;
  alreadyOwned: boolean;
}

function isGenericHomeCommunityVisualTitle(value: string | undefined): boolean {
  return /^(?:g[öo]rsel|image|visual|illustration|page|sayfa)\s*(?:#|no\.?)?\s*\d+(?:\s*\/\s*\d+)?$/iu.test(String(value || '').trim());
}

const listHomeCommunityBooks = httpsCallable<Record<string, unknown>, HomeCommunityListResult>(functions, 'listCommunityBooks');
const getHomeCommunityBook = httpsCallable<{ communityBookId: string }, HomeCommunityDetailResult>(functions, 'getCommunityBook');
const downloadHomeCommunityBook = httpsCallable<{ communityBookId: string }, HomeCommunityDownloadResult>(functions, 'downloadCommunityBook');
const homeCommunitySessionCache = new Map<string, CommunityBook[]>();

function homeCommunitySessionCacheKey(userId?: string): string {
  return userId || '__guest__';
}

function parseHomeCommunityBook(dto: HomeCommunityBookDto): CommunityBook {
  return {
    ...dto,
    outline: dto.outline?.filter((title) => !isGenericHomeCommunityVisualTitle(title)),
    preview: dto.preview?.map((item) => ({ ...item, title: isGenericHomeCommunityVisualTitle(item.title) ? '' : item.title })),
    previewImages: dto.previewImages?.map((item) => ({ ...item, title: isGenericHomeCommunityVisualTitle(item.title) ? '' : item.title })),
    publishedAt: new Date(dto.publishedAt || Date.now())
  };
}

function shuffledUniqueCommunityBooks(popular: CommunityBook[], discovery: CommunityBook[]): CommunityBook[] {
  const popularSelection = popular.slice(0, 8);
  const popularIds = new Set(popularSelection.map((book) => book.id));
  const randomSelection = discovery
    .filter((book) => !popularIds.has(book.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(0, 15 - popularSelection.length));
  const selectedIds = new Set([...popularSelection, ...randomSelection].map((book) => book.id));
  const popularFill = popular.filter((book) => !selectedIds.has(book.id));

  return [...popularSelection, ...randomSelection, ...popularFill]
    .sort(() => Math.random() - 0.5)
    .slice(0, 15);
}

function homeCommunityTypeLabel(type: SmartBookBookType): string {
  if (type === 'fairy_tale') return 'Masal';
  if (type === 'novel') return 'Hikaye';
  return 'Çalışma Kitabı';
}

function extractHomeCommunityPreview(markdown: string): string {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n').filter((line) => {
    const heading = line.trim().match(/^#{1,6}\s+(.+)$/);
    return !heading || !isGenericHomeCommunityVisualTitle(heading[1]);
  });
  const headingIndex = lines.findIndex((line) => /^#{1,6}\s+\S/.test(line.trim()));
  if (headingIndex >= 0) {
    const nextHeadingIndex = lines.findIndex((line, index) => index > headingIndex && /^#{1,6}\s+\S/.test(line.trim()));
    return lines.slice(headingIndex, nextHeadingIndex >= 0 ? nextHeadingIndex : lines.length).join('\n').trim();
  }
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex < 0) return '';
  const nextBlankIndex = lines.findIndex((line, index) => index > firstContentIndex && line.trim().length === 0);
  return lines.slice(firstContentIndex, nextBlankIndex >= 0 ? nextBlankIndex : lines.length).join('\n').trim();
}

function courseHasReadableContent(course: CourseData): boolean {
  const lectureNodes = course.nodes.filter((node) => node.type === 'lecture');
  if (lectureNodes.length === 0) {
    return course.nodes.some((node) => (
      Boolean(node.content?.trim()) ||
      Boolean(node.pageText?.trim()) ||
      Boolean(node.pageImageUrl?.trim()) ||
      Boolean(node.podcastScript?.trim())
    ));
  }
  if (course.visualStoryMode === true) {
    return lectureNodes.every((node) => Boolean(node.pageText?.trim()) && Boolean(node.pageImageUrl?.trim()));
  }
  return lectureNodes.every((node) => Boolean(node.content?.trim()));
}

type CourseDeleteModalState = {
  isOpen: boolean;
  courseId: string | null;
  courseTitle: string;
};

type HeroPortraitCropState = {
  sourceUrl: string;
  fileName: string;
  crop: Point;
  zoom: number;
  croppedAreaPixels: Area | null;
  isProcessing: boolean;
};

type StickyTint = {
  bg: string;
  border: string;
};

const stickyTintPalette: StickyTint[] = [
  { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.45)' },
  { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.45)' },
  { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.45)' },
  { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.45)' },
  { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.45)' }
];

const STICKY_MODAL_TOP_INSET = 'calc(env(safe-area-inset-top, 0px) + 78px)';
const STICKY_MODAL_BOTTOM_INSET = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
const MAX_SOURCE_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_HERO_PORTRAIT_SOURCE_FILE_SIZE_BYTES = 16 * 1024 * 1024;
const HERO_PORTRAIT_OUTPUT_SIZE = 768;
const HERO_PORTRAIT_OUTPUT_MIME = 'image/jpeg';
const HERO_PORTRAIT_OUTPUT_QUALITY = 0.86;
const DOCUMENT_ACCEPT =
  '.pdf,.txt,.md,.markdown,.csv,.json,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,application/pdf,text/plain,text/markdown,text/csv,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const HERO_PORTRAIT_ACCEPT = 'image/*';
const BOOK_CREATING_LOOP_VIDEO_SRC = '/animations/book-creating-loop.mp4';
const PENDING_BOOK_GENERATION_JOB_STORAGE_KEY = 'f-study-pending-book-generation-job';
const LITERARY_FACT_ROTATION_MS = 14_000;
const GENERIC_TRANSIENT_ERROR_MESSAGE = 'Bir sorun oluştu. Lütfen kısa bir süre sonra tekrar deneyin.';
const GENERIC_AUTH_REQUIRED_MESSAGE = 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.';

type GenerationStatusCopy = {
  bookQueued: string;
  planning: string;
  writingSections: string;
  chapterWriting: (current: string, total: string) => string;
  chapterCompleted: (current: string, total: string) => string;
  coverPreparing: string;
  ready: string;
  opening: string;
  serverPreparing: string;
  checking: string;
  rechecking: string;
  documentAnalyzing: string;
  starting: string;
  visualGenerating: string;
  visualsGenerating: string;
};

type SimpleGenerationStatusCopy = {
  contentPreparing: string;
  contentPreparingProgress: (current: string, total: string) => string;
  visualsPreparing: string;
  visualPreparingProgress: (current: string, total: string) => string;
  assemblingBook: string;
};

const GENERATION_STATUS_COPY: Record<AppLanguageCode, GenerationStatusCopy> = {
  ar: {
    bookQueued: 'تمت إضافة الكتاب إلى قائمة الإنشاء',
    planning: 'يتم تخطيط مسار الكتاب',
    writingSections: 'تتم كتابة الفصول',
    chapterWriting: (current, total) => `جارٍ كتابة الفصل ${current}/${total}`,
    chapterCompleted: (current, total) => `اكتمل الفصل ${current}/${total}`,
    coverPreparing: 'يتم تجهيز الغلاف',
    ready: 'الكتاب جاهز',
    opening: 'يتم فتح الكتاب...',
    serverPreparing: 'يتم تجهيز الكتاب على الخادم...',
    checking: 'يتم التحقق من حالة الإنشاء...',
    rechecking: 'تتم إعادة التحقق من حالة الإنشاء...',
    documentAnalyzing: 'يتم تحليل المستند...',
    starting: 'يتم بدء الإنشاء على الخادم...',
    visualGenerating: 'يتم إنشاء الصورة...',
    visualsGenerating: 'يتم إنشاء الصور...'
  },
  da: {
    bookQueued: 'Bogen er sat i kø til oprettelse',
    planning: 'Bogens forløb planlægges',
    writingSections: 'Afsnittene skrives',
    chapterWriting: (current, total) => `Afsnit ${current}/${total} skrives`,
    chapterCompleted: (current, total) => `Afsnit ${current}/${total} er færdigt`,
    coverPreparing: 'Omslaget forberedes',
    ready: 'Bogen er klar',
    opening: 'Bogen åbnes...',
    serverPreparing: 'Bogen forberedes på serveren...',
    checking: 'Oprettelsesstatus kontrolleres...',
    rechecking: 'Oprettelsesstatus kontrolleres igen...',
    documentAnalyzing: 'Dokumentet analyseres...',
    starting: 'Oprettelsen startes på serveren...',
    visualGenerating: 'Billedet genereres...',
    visualsGenerating: 'Billederne genereres...'
  },
  de: {
    bookQueued: 'Das Buch wurde zur Erstellung eingereiht',
    planning: 'Der Buchablauf wird geplant',
    writingSections: 'Kapitel werden geschrieben',
    chapterWriting: (current, total) => `Kapitel ${current}/${total} wird geschrieben`,
    chapterCompleted: (current, total) => `Kapitel ${current}/${total} abgeschlossen`,
    coverPreparing: 'Cover wird vorbereitet',
    ready: 'Buch ist bereit',
    opening: 'Buch wird geöffnet...',
    serverPreparing: 'Buch wird auf dem Server vorbereitet...',
    checking: 'Erstellungsstatus wird geprüft...',
    rechecking: 'Erstellungsstatus wird erneut geprüft...',
    documentAnalyzing: 'Dokument wird analysiert...',
    starting: 'Erstellung wird auf dem Server gestartet...',
    visualGenerating: 'Bild wird generiert...',
    visualsGenerating: 'Bilder werden generiert...'
  },
  el: {
    bookQueued: 'Το βιβλίο μπήκε στην ουρά δημιουργίας',
    planning: 'Σχεδιάζεται η ροή του βιβλίου',
    writingSections: 'Γράφονται οι ενότητες',
    chapterWriting: (current, total) => `Γράφεται η ενότητα ${current}/${total}`,
    chapterCompleted: (current, total) => `Η ενότητα ${current}/${total} ολοκληρώθηκε`,
    coverPreparing: 'Προετοιμάζεται το εξώφυλλο',
    ready: 'Το βιβλίο είναι έτοιμο',
    opening: 'Άνοιγμα βιβλίου...',
    serverPreparing: 'Το βιβλίο προετοιμάζεται στον διακομιστή...',
    checking: 'Ελέγχεται η κατάσταση δημιουργίας...',
    rechecking: 'Επανελέγχεται η κατάσταση δημιουργίας...',
    documentAnalyzing: 'Αναλύεται το έγγραφο...',
    starting: 'Η δημιουργία ξεκινά στον διακομιστή...',
    visualGenerating: 'Δημιουργείται εικόνα...',
    visualsGenerating: 'Δημιουργούνται εικόνες...'
  },
  en: {
    bookQueued: 'Book generation queued',
    planning: 'Planning the book flow',
    writingSections: 'Writing sections',
    chapterWriting: (current, total) => `Writing section ${current}/${total}`,
    chapterCompleted: (current, total) => `Section ${current}/${total} completed`,
    coverPreparing: 'Preparing the cover',
    ready: 'Book ready',
    opening: 'Opening book...',
    serverPreparing: 'Preparing the book on the server...',
    checking: 'Checking generation status...',
    rechecking: 'Checking generation status again...',
    documentAnalyzing: 'Analyzing document...',
    starting: 'Starting generation on the server...',
    visualGenerating: 'Generating image...',
    visualsGenerating: 'Generating images...'
  },
  es: {
    bookQueued: 'El libro se puso en cola para generarse',
    planning: 'Planificando el flujo del libro',
    writingSections: 'Escribiendo secciones',
    chapterWriting: (current, total) => `Escribiendo sección ${current}/${total}`,
    chapterCompleted: (current, total) => `Sección ${current}/${total} completada`,
    coverPreparing: 'Preparando la portada',
    ready: 'Libro listo',
    opening: 'Abriendo libro...',
    serverPreparing: 'Preparando el libro en el servidor...',
    checking: 'Comprobando el estado de generación...',
    rechecking: 'Volviendo a comprobar el estado de generación...',
    documentAnalyzing: 'Analizando documento...',
    starting: 'Iniciando generación en el servidor...',
    visualGenerating: 'Generando imagen...',
    visualsGenerating: 'Generando imágenes...'
  },
  fi: {
    bookQueued: 'Kirja on lisätty luontijonoon',
    planning: 'Kirjan rakennetta suunnitellaan',
    writingSections: 'Osioita kirjoitetaan',
    chapterWriting: (current, total) => `Kirjoitetaan osiota ${current}/${total}`,
    chapterCompleted: (current, total) => `Osio ${current}/${total} valmis`,
    coverPreparing: 'Kantta valmistellaan',
    ready: 'Kirja on valmis',
    opening: 'Kirjaa avataan...',
    serverPreparing: 'Kirjaa valmistellaan palvelimella...',
    checking: 'Luonnin tilaa tarkistetaan...',
    rechecking: 'Luonnin tilaa tarkistetaan uudelleen...',
    documentAnalyzing: 'Dokumenttia analysoidaan...',
    starting: 'Luonti käynnistetään palvelimella...',
    visualGenerating: 'Kuvaa luodaan...',
    visualsGenerating: 'Kuvia luodaan...'
  },
  fr: {
    bookQueued: 'Le livre est en file de génération',
    planning: 'Planification du parcours du livre',
    writingSections: 'Rédaction des sections',
    chapterWriting: (current, total) => `Rédaction de la section ${current}/${total}`,
    chapterCompleted: (current, total) => `Section ${current}/${total} terminée`,
    coverPreparing: 'Préparation de la couverture',
    ready: 'Livre prêt',
    opening: 'Ouverture du livre...',
    serverPreparing: 'Préparation du livre sur le serveur...',
    checking: 'Vérification de l’état de génération...',
    rechecking: 'Nouvelle vérification de l’état de génération...',
    documentAnalyzing: 'Analyse du document...',
    starting: 'Démarrage de la génération sur le serveur...',
    visualGenerating: 'Génération de l’image...',
    visualsGenerating: 'Génération des images...'
  },
  hi: {
    bookQueued: 'पुस्तक निर्माण कतार में जोड़ दी गई है',
    planning: 'पुस्तक प्रवाह की योजना बन रही है',
    writingSections: 'खंड लिखे जा रहे हैं',
    chapterWriting: (current, total) => `खंड ${current}/${total} लिखा जा रहा है`,
    chapterCompleted: (current, total) => `खंड ${current}/${total} पूरा हुआ`,
    coverPreparing: 'कवर तैयार हो रहा है',
    ready: 'पुस्तक तैयार है',
    opening: 'पुस्तक खोली जा रही है...',
    serverPreparing: 'सर्वर पर पुस्तक तैयार हो रही है...',
    checking: 'निर्माण स्थिति जांची जा रही है...',
    rechecking: 'निर्माण स्थिति फिर से जांची जा रही है...',
    documentAnalyzing: 'दस्तावेज़ का विश्लेषण हो रहा है...',
    starting: 'सर्वर पर निर्माण शुरू हो रहा है...',
    visualGenerating: 'चित्र बनाया जा रहा है...',
    visualsGenerating: 'चित्र बनाए जा रहे हैं...'
  },
  id: {
    bookQueued: 'Buku masuk antrean pembuatan',
    planning: 'Merencanakan alur buku',
    writingSections: 'Menulis bagian',
    chapterWriting: (current, total) => `Menulis bagian ${current}/${total}`,
    chapterCompleted: (current, total) => `Bagian ${current}/${total} selesai`,
    coverPreparing: 'Menyiapkan sampul',
    ready: 'Buku siap',
    opening: 'Membuka buku...',
    serverPreparing: 'Menyiapkan buku di server...',
    checking: 'Memeriksa status pembuatan...',
    rechecking: 'Memeriksa ulang status pembuatan...',
    documentAnalyzing: 'Menganalisis dokumen...',
    starting: 'Memulai pembuatan di server...',
    visualGenerating: 'Membuat gambar...',
    visualsGenerating: 'Membuat gambar...'
  },
  it: {
    bookQueued: 'Libro in coda per la creazione',
    planning: 'Pianificazione del flusso del libro',
    writingSections: 'Scrittura delle sezioni',
    chapterWriting: (current, total) => `Scrittura sezione ${current}/${total}`,
    chapterCompleted: (current, total) => `Sezione ${current}/${total} completata`,
    coverPreparing: 'Preparazione della copertina',
    ready: 'Libro pronto',
    opening: 'Apertura del libro...',
    serverPreparing: 'Preparazione del libro sul server...',
    checking: 'Controllo dello stato di generazione...',
    rechecking: 'Nuovo controllo dello stato di generazione...',
    documentAnalyzing: 'Analisi del documento...',
    starting: 'Avvio della generazione sul server...',
    visualGenerating: 'Generazione immagine...',
    visualsGenerating: 'Generazione immagini...'
  },
  ja: {
    bookQueued: '本の生成キューに追加しました',
    planning: '本の構成を計画しています',
    writingSections: 'セクションを執筆しています',
    chapterWriting: (current, total) => `セクション ${current}/${total} を執筆中`,
    chapterCompleted: (current, total) => `セクション ${current}/${total} が完了しました`,
    coverPreparing: '表紙を準備しています',
    ready: '本の準備ができました',
    opening: '本を開いています...',
    serverPreparing: 'サーバーで本を準備しています...',
    checking: '生成状況を確認しています...',
    rechecking: '生成状況を再確認しています...',
    documentAnalyzing: 'ドキュメントを分析しています...',
    starting: 'サーバーで生成を開始しています...',
    visualGenerating: '画像を生成しています...',
    visualsGenerating: '画像を生成しています...'
  },
  ko: {
    bookQueued: '책 생성 대기열에 추가되었습니다',
    planning: '책 흐름을 계획하는 중',
    writingSections: '섹션을 작성하는 중',
    chapterWriting: (current, total) => `섹션 ${current}/${total} 작성 중`,
    chapterCompleted: (current, total) => `섹션 ${current}/${total} 완료`,
    coverPreparing: '표지를 준비하는 중',
    ready: '책이 준비되었습니다',
    opening: '책을 여는 중...',
    serverPreparing: '서버에서 책을 준비하는 중...',
    checking: '생성 상태 확인 중...',
    rechecking: '생성 상태를 다시 확인하는 중...',
    documentAnalyzing: '문서를 분석하는 중...',
    starting: '서버에서 생성을 시작하는 중...',
    visualGenerating: '이미지를 생성하는 중...',
    visualsGenerating: '이미지를 생성하는 중...'
  },
  nl: {
    bookQueued: 'Boekgeneratie staat in de wachtrij',
    planning: 'Boekstructuur wordt gepland',
    writingSections: 'Secties worden geschreven',
    chapterWriting: (current, total) => `Sectie ${current}/${total} wordt geschreven`,
    chapterCompleted: (current, total) => `Sectie ${current}/${total} voltooid`,
    coverPreparing: 'Omslag wordt voorbereid',
    ready: 'Boek is klaar',
    opening: 'Boek wordt geopend...',
    serverPreparing: 'Boek wordt op de server voorbereid...',
    checking: 'Generatiestatus wordt gecontroleerd...',
    rechecking: 'Generatiestatus wordt opnieuw gecontroleerd...',
    documentAnalyzing: 'Document wordt geanalyseerd...',
    starting: 'Generatie wordt op de server gestart...',
    visualGenerating: 'Afbeelding wordt gegenereerd...',
    visualsGenerating: 'Afbeeldingen worden gegenereerd...'
  },
  no: {
    bookQueued: 'Boken er lagt i genereringskø',
    planning: 'Bokflyten planlegges',
    writingSections: 'Deler skrives',
    chapterWriting: (current, total) => `Del ${current}/${total} skrives`,
    chapterCompleted: (current, total) => `Del ${current}/${total} fullført`,
    coverPreparing: 'Omslaget klargjøres',
    ready: 'Boken er klar',
    opening: 'Åpner boken...',
    serverPreparing: 'Boken klargjøres på serveren...',
    checking: 'Sjekker genereringsstatus...',
    rechecking: 'Sjekker genereringsstatus på nytt...',
    documentAnalyzing: 'Dokumentet analyseres...',
    starting: 'Starter generering på serveren...',
    visualGenerating: 'Genererer bilde...',
    visualsGenerating: 'Genererer bilder...'
  },
  pl: {
    bookQueued: 'Książka trafiła do kolejki tworzenia',
    planning: 'Planowanie struktury książki',
    writingSections: 'Pisanie sekcji',
    chapterWriting: (current, total) => `Pisanie sekcji ${current}/${total}`,
    chapterCompleted: (current, total) => `Sekcja ${current}/${total} ukończona`,
    coverPreparing: 'Przygotowywanie okładki',
    ready: 'Książka gotowa',
    opening: 'Otwieranie książki...',
    serverPreparing: 'Książka jest przygotowywana na serwerze...',
    checking: 'Sprawdzanie statusu tworzenia...',
    rechecking: 'Ponowne sprawdzanie statusu tworzenia...',
    documentAnalyzing: 'Analizowanie dokumentu...',
    starting: 'Uruchamianie tworzenia na serwerze...',
    visualGenerating: 'Generowanie obrazu...',
    visualsGenerating: 'Generowanie obrazów...'
  },
  'pt-BR': {
    bookQueued: 'Livro na fila de criação',
    planning: 'Planejando o fluxo do livro',
    writingSections: 'Escrevendo seções',
    chapterWriting: (current, total) => `Escrevendo seção ${current}/${total}`,
    chapterCompleted: (current, total) => `Seção ${current}/${total} concluída`,
    coverPreparing: 'Preparando a capa',
    ready: 'Livro pronto',
    opening: 'Abrindo livro...',
    serverPreparing: 'Preparando o livro no servidor...',
    checking: 'Verificando o status da criação...',
    rechecking: 'Verificando novamente o status da criação...',
    documentAnalyzing: 'Analisando documento...',
    starting: 'Iniciando criação no servidor...',
    visualGenerating: 'Gerando imagem...',
    visualsGenerating: 'Gerando imagens...'
  },
  sv: {
    bookQueued: 'Boken har lagts i skapandekön',
    planning: 'Bokflödet planeras',
    writingSections: 'Avsnitt skrivs',
    chapterWriting: (current, total) => `Avsnitt ${current}/${total} skrivs`,
    chapterCompleted: (current, total) => `Avsnitt ${current}/${total} klart`,
    coverPreparing: 'Omslaget förbereds',
    ready: 'Boken är klar',
    opening: 'Öppnar boken...',
    serverPreparing: 'Boken förbereds på servern...',
    checking: 'Kontrollerar skapandestatus...',
    rechecking: 'Kontrollerar skapandestatus igen...',
    documentAnalyzing: 'Dokumentet analyseras...',
    starting: 'Startar skapande på servern...',
    visualGenerating: 'Genererar bild...',
    visualsGenerating: 'Genererar bilder...'
  },
  th: {
    bookQueued: 'เพิ่มหนังสือเข้าคิวสร้างแล้ว',
    planning: 'กำลังวางแผนลำดับหนังสือ',
    writingSections: 'กำลังเขียนส่วนต่างๆ',
    chapterWriting: (current, total) => `กำลังเขียนส่วน ${current}/${total}`,
    chapterCompleted: (current, total) => `ส่วน ${current}/${total} เสร็จแล้ว`,
    coverPreparing: 'กำลังเตรียมปก',
    ready: 'หนังสือพร้อมแล้ว',
    opening: 'กำลังเปิดหนังสือ...',
    serverPreparing: 'กำลังเตรียมหนังสือบนเซิร์ฟเวอร์...',
    checking: 'กำลังตรวจสอบสถานะการสร้าง...',
    rechecking: 'กำลังตรวจสอบสถานะการสร้างอีกครั้ง...',
    documentAnalyzing: 'กำลังวิเคราะห์เอกสาร...',
    starting: 'กำลังเริ่มสร้างบนเซิร์ฟเวอร์...',
    visualGenerating: 'กำลังสร้างรูปภาพ...',
    visualsGenerating: 'กำลังสร้างรูปภาพ...'
  },
  tr: {
    bookQueued: 'Kitap üretim sırasına alındı',
    planning: 'Kitap akışı planlanıyor',
    writingSections: 'Bölümler yazılıyor',
    chapterWriting: (current, total) => `Bölüm ${current}/${total} yazılıyor`,
    chapterCompleted: (current, total) => `Bölüm ${current}/${total} tamamlandı`,
    coverPreparing: 'Kapak hazırlanıyor',
    ready: 'Kitap hazır',
    opening: 'Kitap açılıyor...',
    serverPreparing: 'Kitap sunucuda hazırlanıyor...',
    checking: 'Üretim durumu kontrol ediliyor...',
    rechecking: 'Üretim durumu yeniden kontrol ediliyor...',
    documentAnalyzing: 'Doküman analiz ediliyor...',
    starting: 'Sunucuda üretim başlatılıyor...',
    visualGenerating: 'Görsel üretiliyor...',
    visualsGenerating: 'Görseller üretiliyor...'
  }
};

const SIMPLE_GENERATION_STATUS_COPY: Record<AppLanguageCode, SimpleGenerationStatusCopy> = {
  ar: {
    contentPreparing: 'يتم تجهيز المحتوى',
    contentPreparingProgress: (current, total) => `يتم تجهيز المحتوى ${current}/${total}`,
    visualsPreparing: 'يتم تجهيز الصور',
    visualPreparingProgress: (current, total) => `يتم تجهيز الصورة ${current}/${total}`,
    assemblingBook: 'يتم تجميع كتابك'
  },
  da: {
    contentPreparing: 'Indholdet forberedes',
    contentPreparingProgress: (current, total) => `Indhold ${current}/${total} forberedes`,
    visualsPreparing: 'Billederne forberedes',
    visualPreparingProgress: (current, total) => `Billede ${current}/${total} forberedes`,
    assemblingBook: 'Din bog samles'
  },
  de: {
    contentPreparing: 'Inhalt wird vorbereitet',
    contentPreparingProgress: (current, total) => `Inhalt ${current}/${total} wird vorbereitet`,
    visualsPreparing: 'Bilder werden vorbereitet',
    visualPreparingProgress: (current, total) => `Bild ${current}/${total} wird vorbereitet`,
    assemblingBook: 'Dein Buch wird zusammengesetzt'
  },
  el: {
    contentPreparing: 'Προετοιμάζεται το περιεχόμενο',
    contentPreparingProgress: (current, total) => `Προετοιμάζεται το περιεχόμενο ${current}/${total}`,
    visualsPreparing: 'Προετοιμάζονται οι εικόνες',
    visualPreparingProgress: (current, total) => `Προετοιμάζεται η εικόνα ${current}/${total}`,
    assemblingBook: 'Το βιβλίο σου συντίθεται'
  },
  en: {
    contentPreparing: 'Preparing content',
    contentPreparingProgress: (current, total) => `Preparing content ${current}/${total}`,
    visualsPreparing: 'Preparing visuals',
    visualPreparingProgress: (current, total) => `Preparing visual ${current}/${total}`,
    assemblingBook: 'Assembling your book'
  },
  es: {
    contentPreparing: 'Preparando el contenido',
    contentPreparingProgress: (current, total) => `Preparando contenido ${current}/${total}`,
    visualsPreparing: 'Preparando las imágenes',
    visualPreparingProgress: (current, total) => `Preparando imagen ${current}/${total}`,
    assemblingBook: 'Se está ensamblando tu libro'
  },
  fi: {
    contentPreparing: 'Sisältöä valmistellaan',
    contentPreparingProgress: (current, total) => `Sisältöä valmistellaan ${current}/${total}`,
    visualsPreparing: 'Kuvia valmistellaan',
    visualPreparingProgress: (current, total) => `Kuvaa ${current}/${total} valmistellaan`,
    assemblingBook: 'Kirjaasi kootaan'
  },
  fr: {
    contentPreparing: 'Préparation du contenu',
    contentPreparingProgress: (current, total) => `Préparation du contenu ${current}/${total}`,
    visualsPreparing: 'Préparation des visuels',
    visualPreparingProgress: (current, total) => `Préparation du visuel ${current}/${total}`,
    assemblingBook: 'Votre livre est en cours d’assemblage'
  },
  hi: {
    contentPreparing: 'सामग्री तैयार की जा रही है',
    contentPreparingProgress: (current, total) => `सामग्री ${current}/${total} तैयार की जा रही है`,
    visualsPreparing: 'चित्र तैयार किए जा रहे हैं',
    visualPreparingProgress: (current, total) => `चित्र ${current}/${total} तैयार किया जा रहा है`,
    assemblingBook: 'आपकी पुस्तक जोड़ी जा रही है'
  },
  id: {
    contentPreparing: 'Menyiapkan konten',
    contentPreparingProgress: (current, total) => `Menyiapkan konten ${current}/${total}`,
    visualsPreparing: 'Menyiapkan gambar',
    visualPreparingProgress: (current, total) => `Menyiapkan gambar ${current}/${total}`,
    assemblingBook: 'Bukumu sedang dirangkai'
  },
  it: {
    contentPreparing: 'Preparazione dei contenuti',
    contentPreparingProgress: (current, total) => `Preparazione contenuto ${current}/${total}`,
    visualsPreparing: 'Preparazione delle immagini',
    visualPreparingProgress: (current, total) => `Preparazione immagine ${current}/${total}`,
    assemblingBook: 'Il tuo libro viene assemblato'
  },
  ja: {
    contentPreparing: 'コンテンツを準備しています',
    contentPreparingProgress: (current, total) => `コンテンツ ${current}/${total} を準備しています`,
    visualsPreparing: '画像を準備しています',
    visualPreparingProgress: (current, total) => `画像 ${current}/${total} を準備しています`,
    assemblingBook: '本をまとめています'
  },
  ko: {
    contentPreparing: '콘텐츠를 준비하는 중',
    contentPreparingProgress: (current, total) => `콘텐츠 ${current}/${total} 준비 중`,
    visualsPreparing: '이미지를 준비하는 중',
    visualPreparingProgress: (current, total) => `이미지 ${current}/${total} 준비 중`,
    assemblingBook: '책을 조합하는 중'
  },
  nl: {
    contentPreparing: 'Inhoud wordt voorbereid',
    contentPreparingProgress: (current, total) => `Inhoud ${current}/${total} wordt voorbereid`,
    visualsPreparing: 'Beelden worden voorbereid',
    visualPreparingProgress: (current, total) => `Beeld ${current}/${total} wordt voorbereid`,
    assemblingBook: 'Je boek wordt samengesteld'
  },
  no: {
    contentPreparing: 'Innhold forberedes',
    contentPreparingProgress: (current, total) => `Innhold ${current}/${total} forberedes`,
    visualsPreparing: 'Bildene forberedes',
    visualPreparingProgress: (current, total) => `Bilde ${current}/${total} forberedes`,
    assemblingBook: 'Boken din settes sammen'
  },
  pl: {
    contentPreparing: 'Przygotowywanie treści',
    contentPreparingProgress: (current, total) => `Przygotowywanie treści ${current}/${total}`,
    visualsPreparing: 'Przygotowywanie ilustracji',
    visualPreparingProgress: (current, total) => `Przygotowywanie ilustracji ${current}/${total}`,
    assemblingBook: 'Twoja książka jest składana'
  },
  'pt-BR': {
    contentPreparing: 'Preparando o conteúdo',
    contentPreparingProgress: (current, total) => `Preparando conteúdo ${current}/${total}`,
    visualsPreparing: 'Preparando as imagens',
    visualPreparingProgress: (current, total) => `Preparando imagem ${current}/${total}`,
    assemblingBook: 'Seu livro está sendo montado'
  },
  sv: {
    contentPreparing: 'Innehåll förbereds',
    contentPreparingProgress: (current, total) => `Innehåll ${current}/${total} förbereds`,
    visualsPreparing: 'Bilder förbereds',
    visualPreparingProgress: (current, total) => `Bild ${current}/${total} förbereds`,
    assemblingBook: 'Din bok sätts samman'
  },
  th: {
    contentPreparing: 'กำลังเตรียมเนื้อหา',
    contentPreparingProgress: (current, total) => `กำลังเตรียมเนื้อหา ${current}/${total}`,
    visualsPreparing: 'กำลังเตรียมภาพ',
    visualPreparingProgress: (current, total) => `กำลังเตรียมภาพ ${current}/${total}`,
    assemblingBook: 'กำลังรวมหนังสือของคุณ'
  },
  tr: {
    contentPreparing: 'İçerik hazırlanıyor',
    contentPreparingProgress: (current, total) => `İçerik ${current}/${total} hazırlanıyor`,
    visualsPreparing: 'Görseller hazırlanıyor',
    visualPreparingProgress: (current, total) => `Görsel ${current}/${total} hazırlanıyor`,
    assemblingBook: 'Kitabınız birleştiriliyor'
  }
};

function translateGenerationStatusLabel(rawStatus: string, language: AppLanguageCode): string {
  const raw = String(rawStatus || '').replace(/\s+/g, ' ').trim();
  if (!raw) return raw;
  const copy = GENERATION_STATUS_COPY[language] || GENERATION_STATUS_COPY.en;
  const simpleCopy = SIMPLE_GENERATION_STATUS_COPY[language] || SIMPLE_GENERATION_STATUS_COPY.en;
  const withoutEllipsis = raw.replace(/\s*(?:\.\.\.|…)$/u, '').trim();
  const contentPreparingMatch = withoutEllipsis.match(/^İçerik\s+(\d+)\s*\/\s*(\d+)\s+hazırlanıyor$/iu);
  if (contentPreparingMatch) return simpleCopy.contentPreparingProgress(contentPreparingMatch[1], contentPreparingMatch[2]);
  const visualPreparingMatch = withoutEllipsis.match(/^Görsel\s+(\d+)\s*\/\s*(\d+)\s+(?:hazırlanıyor|tamamlandı)$/iu);
  if (visualPreparingMatch) return simpleCopy.visualPreparingProgress(visualPreparingMatch[1], visualPreparingMatch[2]);
  const writingMatch = withoutEllipsis.match(/^Bölüm\s+(\d+)\s*\/\s*(\d+)\s+yazılıyor$/iu);
  if (writingMatch) return copy.chapterWriting(writingMatch[1], writingMatch[2]);
  const completedMatch = withoutEllipsis.match(/^Bölüm\s+(\d+)\s*\/\s*(\d+)\s+tamamlandı$/iu);
  if (completedMatch) return copy.chapterCompleted(completedMatch[1], completedMatch[2]);

  type SimpleStaticStatusKey = 'contentPreparing' | 'visualsPreparing' | 'assemblingBook';
  const simpleStatusMap: Record<string, SimpleStaticStatusKey> = {
    'İçerik hazırlanıyor': 'contentPreparing',
    'Görseller hazırlanıyor': 'visualsPreparing',
    'Kitabınız birleştiriliyor': 'assemblingBook',
    'Kitap sunucuda hazırlanıyor': 'assemblingBook',
    'Sunucuda üretim başlatılıyor': 'contentPreparing',
    'Görsel masal planlanıyor': 'contentPreparing',
    'Görsel masal sayfaları çiziliyor': 'visualsPreparing',
    'Görseller paralel hazırlanıyor': 'visualsPreparing'
  };
  const simpleKey = simpleStatusMap[withoutEllipsis.replace(/\s*\(\d+\s+sayfa\)$/iu, '')];
  if (simpleKey) return simpleCopy[simpleKey];

  const statusMap: Record<string, keyof Omit<GenerationStatusCopy, 'chapterWriting' | 'chapterCompleted'>> = {
    'Kitap üretim sırasına alındı': 'bookQueued',
    'Kitap akışı planlanıyor': 'planning',
    'Bölümler yazılıyor': 'writingSections',
    'Kapak hazırlanıyor': 'coverPreparing',
    'Kitap kapağı hazırlanıyor': 'coverPreparing',
    'Kitap hazır': 'ready',
    'Görsel masal hazır': 'ready',
    'Kitap açılıyor': 'opening',
    'Kitap sunucuda hazırlanıyor': 'serverPreparing',
    'Üretim durumu kontrol ediliyor': 'checking',
    'Üretim durumu yeniden kontrol ediliyor': 'rechecking',
    'Doküman analiz ediliyor': 'documentAnalyzing',
    'Sunucuda üretim başlatılıyor': 'starting',
    'Görsel üretiliyor': 'visualGenerating',
    'Görseller üretiliyor': 'visualsGenerating',
    'Görsel oluşturuluyor': 'visualGenerating',
    'Görseller oluşturuluyor': 'visualsGenerating'
  };
  const key = statusMap[withoutEllipsis];
  return key ? copy[key] : rawStatus;
}

const GENERATION_REMAINING_TIME_COPY: Record<AppLanguageCode, (minutes: number) => string> = {
  ar: (minutes) => `الوقت المتبقي المقدر: ${minutes} دقيقة`,
  da: (minutes) => `Anslået resterende tid: ${minutes} min`,
  de: (minutes) => `Geschätzte Restzeit: ${minutes} Min.`,
  el: (minutes) => `Εκτιμώμενος χρόνος που απομένει: ${minutes} λεπτά`,
  en: (minutes) => `Estimated time remaining: ${minutes} min`,
  es: (minutes) => `Tiempo restante estimado: ${minutes} min`,
  fi: (minutes) => `Arvioitu jäljellä oleva aika: ${minutes} min`,
  fr: (minutes) => `Temps restant estimé : ${minutes} min`,
  hi: (minutes) => `अनुमानित शेष समय: ${minutes} मिनट`,
  id: (minutes) => `Perkiraan waktu tersisa: ${minutes} menit`,
  it: (minutes) => `Tempo rimanente stimato: ${minutes} min`,
  ja: (minutes) => `推定残り時間: ${minutes}分`,
  ko: (minutes) => `예상 남은 시간: ${minutes}분`,
  nl: (minutes) => `Geschatte resterende tijd: ${minutes} min`,
  no: (minutes) => `Anslått gjenstående tid: ${minutes} min`,
  pl: (minutes) => `Szacowany pozostały czas: ${minutes} min`,
  'pt-BR': (minutes) => `Tempo restante estimado: ${minutes} min`,
  sv: (minutes) => `Beräknad återstående tid: ${minutes} min`,
  th: (minutes) => `เวลาที่เหลือโดยประมาณ: ${minutes} นาที`,
  tr: (minutes) => `Tahmini kalan süre: ${minutes} dk`
};

function formatGenerationRemainingTime(minutes: number, language: AppLanguageCode): string {
  const safeMinutes = Math.max(1, Math.round(Number(minutes) || 1));
  return (GENERATION_REMAINING_TIME_COPY[language] || GENERATION_REMAINING_TIME_COPY.en)(safeMinutes);
}

const BOOK_READY_NOTIFICATION_COPY: Record<AppLanguageCode, (title: string) => { title: string; body: string }> = {
  ar: (bookTitle) => ({ title: '📚 كتابك جاهز!', body: `تم إنشاء "${bookTitle}". يمكنك البدء بالقراءة الآن.` }),
  da: (bookTitle) => ({ title: '📚 Din bog er klar!', body: `"${bookTitle}" er oprettet. Du kan begynde at læse nu.` }),
  de: (bookTitle) => ({ title: '📚 Dein Buch ist fertig!', body: `"${bookTitle}" wurde erstellt. Du kannst jetzt mit dem Lesen beginnen.` }),
  el: (bookTitle) => ({ title: '📚 Το βιβλίο σου είναι έτοιμο!', body: `Το "${bookTitle}" δημιουργήθηκε. Μπορείς να ξεκινήσεις την ανάγνωση.` }),
  en: (bookTitle) => ({ title: '📚 Your book is ready!', body: `"${bookTitle}" has been created. You can start reading now.` }),
  es: (bookTitle) => ({ title: '📚 Tu libro está listo!', body: `"${bookTitle}" se ha creado. Ya puedes empezar a leer.` }),
  fi: (bookTitle) => ({ title: '📚 Kirjasi on valmis!', body: `"${bookTitle}" on luotu. Voit aloittaa lukemisen nyt.` }),
  fr: (bookTitle) => ({ title: '📚 Ton livre est prêt !', body: `"${bookTitle}" a été créé. Tu peux commencer la lecture.` }),
  hi: (bookTitle) => ({ title: '📚 आपकी किताब तैयार है!', body: `"${bookTitle}" बन गई है। अब आप पढ़ना शुरू कर सकते हैं।` }),
  id: (bookTitle) => ({ title: '📚 Bukumu siap!', body: `"${bookTitle}" telah dibuat. Kamu bisa mulai membaca sekarang.` }),
  it: (bookTitle) => ({ title: '📚 Il tuo libro è pronto!', body: `"${bookTitle}" è stato creato. Puoi iniziare a leggere ora.` }),
  ja: (bookTitle) => ({ title: '📚 本が完成しました！', body: `「${bookTitle}」が作成されました。今すぐ読み始められます。` }),
  ko: (bookTitle) => ({ title: '📚 책이 준비되었습니다!', body: `"${bookTitle}"이(가) 만들어졌습니다. 지금 읽기 시작할 수 있어요.` }),
  nl: (bookTitle) => ({ title: '📚 Je boek is klaar!', body: `"${bookTitle}" is gemaakt. Je kunt nu beginnen met lezen.` }),
  no: (bookTitle) => ({ title: '📚 Boken din er klar!', body: `"${bookTitle}" er laget. Du kan begynne å lese nå.` }),
  pl: (bookTitle) => ({ title: '📚 Twoja książka jest gotowa!', body: `Utworzono "${bookTitle}". Możesz zacząć czytać.` }),
  'pt-BR': (bookTitle) => ({ title: '📚 Seu livro está pronto!', body: `"${bookTitle}" foi criado. Você já pode começar a ler.` }),
  sv: (bookTitle) => ({ title: '📚 Din bok är klar!', body: `"${bookTitle}" har skapats. Du kan börja läsa nu.` }),
  th: (bookTitle) => ({ title: '📚 หนังสือของคุณพร้อมแล้ว!', body: `สร้าง "${bookTitle}" แล้ว คุณเริ่มอ่านได้เลย` }),
  tr: (bookTitle) => ({ title: '📚 Kitabın hazır!', body: `"${bookTitle}" oluşturuldu. Okumaya başlayabilirsin.` })
};

function buildBookReadyNotificationCopy(course: CourseData, fallbackLanguage: AppLanguageCode): { title: string; body: string } {
  const bookTitle = course.topic || course.title || 'Fortale';
  const notificationLanguage = normalizeAppLanguageCode(course.language) || fallbackLanguage;
  return (BOOK_READY_NOTIFICATION_COPY[notificationLanguage] || BOOK_READY_NOTIFICATION_COPY.en)(bookTitle);
}

function getLiteraryFactsForBookType(bookType: SmartBookBookType | null | undefined, language: AppLanguageCode): string[] {
  if (bookType !== 'fairy_tale' && bookType !== 'story' && bookType !== 'novel') return [];
  const factsForType = LITERARY_FACTS[bookType];
  return factsForType[language] ?? factsForType.en ?? factsForType.tr ?? [];
}

function shuffledLiteraryFactIndices(count: number): number[] {
  const indices = Array.from({ length: Math.max(0, count) }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }
  return indices;
}

function uniqueValidLiteraryFactIndices(indices: number[], count: number): number[] {
  const seen = new Set<number>();
  return indices.filter((index) => {
    if (!Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) return false;
    seen.add(index);
    return true;
  });
}

function pickNextLiteraryFactIndex(
  factCount: number,
  previousIndex: number | null,
  availableRef: React.MutableRefObject<number[]>,
  shownRef: React.MutableRefObject<number[]>
): number | null {
  if (factCount <= 0) return null;
  const previousIsValid = previousIndex !== null && previousIndex >= 0 && previousIndex < factCount;
  let available = uniqueValidLiteraryFactIndices(availableRef.current, factCount);
  let shown = uniqueValidLiteraryFactIndices(shownRef.current, factCount);

  if (previousIsValid && !shown.includes(previousIndex)) {
    shown.push(previousIndex);
  }

  if (available.length === 0) {
    available = shown.length > 0 ? shuffledLiteraryFactIndices(shown.length).map((index) => shown[index]) : shuffledLiteraryFactIndices(factCount);
    shown = [];
    if (previousIsValid && available.length > 1) {
      available = available.filter((index) => index !== previousIndex);
      available.push(previousIndex);
    }
  }

  const selectableCount = previousIsValid && available.length > 1 && available[available.length - 1] === previousIndex
    ? available.length - 1
    : available.length;
  const selectedPosition = Math.floor(Math.random() * selectableCount);
  const [nextIndex] = available.splice(selectedPosition, 1);

  availableRef.current = available;
  shownRef.current = shown;
  return typeof nextIndex === 'number' ? nextIndex : null;
}

type WizardHeroGender = '' | 'female' | 'male' | 'other';
type WizardCompanionHero = {
  name: string;
  gender: WizardHeroGender;
};
type WizardSettingTime = '' | 'past' | 'present' | 'future' | 'uncertain' | 'custom';
type WizardSettingPlace = '' | 'city' | 'forest' | 'space' | 'school' | 'custom';
type WizardWorldType = '' | 'real' | 'magical' | 'dystopia' | 'alternate' | 'utopia' | 'custom';
type WizardPremiseMode = 'examples' | 'custom';
type WorkbookLevel = '' | 'İlkokul' | 'Ortaokul' | 'Üniversite';
type WizardTone = {
  border: string;
  fill: string;
  glow: string;
};

type BookTypeTheme = {
  tone: WizardTone;
  progress: string;
  actionBackground: string;
  actionBorder: string;
  actionGlow: string;
};

const WIZARD_TONES: WizardTone[] = [
  { border: 'rgba(139, 187, 244, 0.62)', fill: 'rgba(96, 151, 214, 0.16)', glow: 'rgba(96, 151, 214, 0.22)' },
  { border: 'rgba(104, 179, 230, 0.62)', fill: 'rgba(104, 179, 230, 0.16)', glow: 'rgba(104, 179, 230, 0.22)' },
  { border: 'rgba(56, 189, 248, 0.62)', fill: 'rgba(56, 189, 248, 0.16)', glow: 'rgba(56, 189, 248, 0.22)' },
  { border: 'rgba(244, 63, 94, 0.62)', fill: 'rgba(244, 63, 94, 0.16)', glow: 'rgba(244, 63, 94, 0.22)' },
  { border: 'rgba(168, 85, 247, 0.62)', fill: 'rgba(168, 85, 247, 0.16)', glow: 'rgba(168, 85, 247, 0.22)' },
  { border: 'rgba(59, 130, 246, 0.62)', fill: 'rgba(59, 130, 246, 0.16)', glow: 'rgba(59, 130, 246, 0.22)' }
];

const CREATE_FORM_GREEN_TONE: WizardTone = {
  border: 'rgba(139, 187, 244, 0.42)',
  fill: 'rgba(31, 76, 125, 0.24)',
  glow: 'rgba(96, 151, 214, 0.16)'
};

const BOOK_TYPE_THEMES: Record<SmartBookBookType, BookTypeTheme> = {
  fairy_tale: {
    tone: { border: 'rgba(139, 187, 244, 0.5)', fill: 'rgba(45, 93, 151, 0.16)', glow: 'rgba(120, 166, 232, 0.18)' },
    progress: '#2d5d97',
    actionBackground: '#123767',
    actionBorder: 'rgba(139, 187, 244, 0.62)',
    actionGlow: 'rgba(120, 166, 232, 0.18)'
  },
  story: {
    tone: { border: 'rgba(104, 179, 230, 0.68)', fill: 'rgba(42, 116, 171, 0.2)', glow: 'rgba(104, 179, 230, 0.28)' },
    progress: '#2a74ab',
    actionBackground: '#11497f',
    actionBorder: 'rgba(104, 179, 230, 0.7)',
    actionGlow: 'rgba(104, 179, 230, 0.28)'
  },
  novel: {
    tone: { border: 'rgba(87, 140, 210, 0.72)', fill: 'rgba(34, 76, 134, 0.18)', glow: 'rgba(87, 140, 210, 0.24)' },
    progress: '#224c86',
    actionBackground: '#2b5f9a',
    actionBorder: 'rgba(139, 187, 244, 0.72)',
    actionGlow: 'rgba(87, 140, 210, 0.28)'
  }
};

const NEUTRAL_BOOK_TYPE_THEME: BookTypeTheme = {
  tone: { border: 'rgba(190, 220, 255, 0.2)', fill: 'rgba(190, 220, 255, 0.1)', glow: 'rgba(96, 151, 214, 0.16)' },
  progress: '#1f4c7d',
  actionBackground: '#0a2446',
  actionBorder: 'rgba(190, 220, 255, 0.42)',
  actionGlow: 'rgba(96, 151, 214, 0.18)'
};

const HOME_SPLIT_BOOK_TYPES: Array<{
  value: SmartBookBookType;
  label: string;
  hint: string;
  placement: 'top' | 'bottom-left' | 'bottom-right';
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}> = [
  {
    value: 'fairy_tale',
    label: 'Masal',
    hint: 'Anlatı + değer aktarımı + hayal gücü',
    placement: 'top',
    icon: Feather
  },
  {
    value: 'novel',
    label: 'Hikaye',
    hint: 'Uzun anlatı, karakter ve dünya derinliği',
    placement: 'bottom-left',
    icon: ScrollText
  },
  {
    value: 'story',
    label: 'Çalışma Kitabı',
    hint: 'Akademik',
    placement: 'bottom-right',
    icon: Telescope
  }
];

const WIZARD_BLACK_HOLE_TILES = Array.from({ length: 20 }, (_, index) => ({
  angle: index * 18 + (index % 2 === 0 ? 4 : -3),
  radius: 124 + (index % 4) * 13,
  delay: -((index * 0.37) % 5.8),
  duration: 4.8 + (index % 5) * 0.42,
  size: 3 + (index % 4) * 1.25,
  color: index % 3 === 0
    ? 'rgba(103,232,249,0.9)'
    : index % 3 === 1
      ? 'rgba(196,181,253,0.82)'
      : 'rgba(253,224,71,0.78)'
}));

const HERO_COUNT_OPTIONS = [1, 2, 3, 4] as const;
const CUSTOM_WIZARD_OPTION = '__custom__';
const HERO_GENDER_OPTIONS: Array<{ value: Exclude<WizardHeroGender, ''>; label: string }> = [
  { value: 'female', label: 'Kız / Kadın' },
  { value: 'male', label: 'Erkek' },
  { value: 'other', label: 'Diğer / Belirtmek istemiyorum' }
];
const SETTING_TIME_OPTIONS: Array<{ value: Exclude<WizardSettingTime, ''>; label: string }> = [
  { value: 'past', label: 'Geçmiş' },
  { value: 'present', label: 'Günümüz' },
  { value: 'future', label: 'Gelecek' },
  { value: 'uncertain', label: 'Belirsiz' },
  { value: 'custom', label: 'Diğer' }
];
const SETTING_PLACE_OPTIONS: Array<{ value: Exclude<WizardSettingPlace, ''>; label: string }> = [
  { value: 'city', label: 'Şehir' },
  { value: 'forest', label: 'Orman' },
  { value: 'space', label: 'Uzay' },
  { value: 'school', label: 'Okul' },
  { value: 'custom', label: 'Diğer' }
];
const WORLD_TYPE_OPTIONS: Array<{ value: Exclude<WizardWorldType, ''>; label: string }> = [
  { value: 'real', label: 'Gerçek' },
  { value: 'magical', label: 'Büyülü' },
  { value: 'dystopia', label: 'Distopya' },
  { value: 'alternate', label: 'Alternatif evren' },
  { value: 'utopia', label: 'Ütopya' },
  { value: 'custom', label: 'Diğer' }
];
const STORY_PREMISE_OPTIONS = [
  'Kayıp nesne',
  'Kaçış',
  'Büyük görev',
  'Gizli sır',
  'Rekabet',
  'Kendini keşif',
  'Yasak kapı',
  'Beklenmedik dostluk',
  'Yanlış anlaşılma',
  'Zamana karşı yarış',
  'Eski kehanet',
  'Yeni başlangıç'
];

const WORKBOOK_LEVEL_OPTIONS: Array<{ value: Exclude<WorkbookLevel, ''>; hint: string }> = [
  { value: 'İlkokul', hint: 'Somut, sade ve bol açıklamalı anlatım' },
  { value: 'Ortaokul', hint: 'Kavram, örnek ve temel akademik yapı dengesi' },
  { value: 'Üniversite', hint: 'Daha teknik, kavramsal ve analitik anlatım' }
];

const WORKBOOK_CATEGORY_OPTIONS = ['Bilimsel', 'Genel Kültür', 'Ders Kitabı', 'Araştırma'] as const;

const WORKBOOK_EXTRA_OPTIONS: Array<{
  key: 'examples' | 'quiz' | 'relatedBooks';
  label: string;
  hint: string;
}> = [
  { key: 'examples', label: 'Örnekler', hint: 'Gerçek yaşam bağlantıları anlatıma yedirilir' },
  { key: 'quiz', label: 'Quiz', hint: '8 çoktan seçmeli + 4 doğru/yanlış soru eklenir' },
  { key: 'relatedBooks', label: 'İlgili Kitaplar', hint: 'En az 4 okuma önerisi eklenir' }
];

function resolveWizardTone(index: number): WizardTone {
  return WIZARD_TONES[((index % WIZARD_TONES.length) + WIZARD_TONES.length) % WIZARD_TONES.length];
}

function resolveBookTypeTheme(bookType?: SmartBookBookType): BookTypeTheme {
  if (bookType === 'fairy_tale') return BOOK_TYPE_THEMES.fairy_tale;
  if (bookType === 'story') return BOOK_TYPE_THEMES.story;
  if (bookType === 'novel') return BOOK_TYPE_THEMES.novel;
  return NEUTRAL_BOOK_TYPE_THEME;
}

type PendingBookGenerationJob = {
  jobId: string;
  bookType: SmartBookBookType;
  language?: AppLanguageCode;
  topic?: string;
  startedAt: string;
};

function readPendingBookGenerationJob(): PendingBookGenerationJob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_BOOK_GENERATION_JOB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBookGenerationJob>;
    if (typeof parsed.jobId !== 'string' || !parsed.jobId.trim()) return null;
    if (
      parsed.bookType !== 'fairy_tale' &&
      parsed.bookType !== 'story' &&
      parsed.bookType !== 'novel'
    ) {
      return null;
    }
    return {
      jobId: parsed.jobId.trim(),
      bookType: parsed.bookType,
      language: normalizeAppLanguageCode(parsed.language) || undefined,
      topic: typeof parsed.topic === 'string' ? parsed.topic : undefined,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function writePendingBookGenerationJob(payload: PendingBookGenerationJob | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!payload) {
      window.localStorage.removeItem(PENDING_BOOK_GENERATION_JOB_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PENDING_BOOK_GENERATION_JOB_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures in constrained runtimes.
  }
}

function formatStickyDate(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function formatStickyReminder(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function toLocalDateTimeValue(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function toIsoDateTimeValue(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function buildStickyContent(title: string, text: string): string {
  const blocks = [title.trim(), text.trim()].filter(Boolean);
  return blocks.join('\n\n').trim();
}

function buildStickyDownloadName(title: string): string {
  const normalized = (title || 'yapiskan-not')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
  const safeName = normalized || 'yapiskan-not';
  return `${safeName}.txt`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function getUserFacingError(error: unknown, fallback: string): string {
  const rawMessage = (error as { message?: string } | null)?.message;
  if (!rawMessage || typeof rawMessage !== 'string') return fallback || GENERIC_TRANSIENT_ERROR_MESSAGE;
  if (rawMessage.trim() === BOOK_CONTENT_SAFETY_MESSAGE) return BOOK_CONTENT_SAFETY_MESSAGE;
  const normalized = rawMessage.toLocaleLowerCase('tr-TR');
  if (
    normalized.includes('permission-denied') ||
    normalized.includes('unauthenticated') ||
    normalized.includes('auth/') ||
    normalized.includes('oturum') ||
    normalized.includes('giriş')
  ) {
    return GENERIC_AUTH_REQUIRED_MESSAGE;
  }
  if (
    normalized.includes('resource_exhausted') ||
    normalized.includes('resource exhausted') ||
    normalized.includes('quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('"code":429') ||
    normalized.includes('http 4') ||
    normalized.includes('http 5') ||
    normalized.includes('functions/') ||
    normalized.includes('internal') ||
    normalized.includes('unavailable') ||
    normalized.includes('failed-precondition') ||
    normalized.includes('deadline-exceeded')
  ) {
    return fallback || GENERIC_TRANSIENT_ERROR_MESSAGE;
  }
  return fallback || GENERIC_TRANSIENT_ERROR_MESSAGE;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Dosya verisi işlenemedi.'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImageForCanvas(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Portre görseli hazırlanamadı.'));
    image.src = sourceUrl;
  });
}

function drawHeroPortraitCropToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  croppedAreaPixels: Area,
  outputSize: number
) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Portre düzenleme alanı açılamadı.');

  const size = Math.max(64, Math.floor(outputSize));
  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  context.fillStyle = '#101820';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    Math.max(0, Math.floor(croppedAreaPixels.x)),
    Math.max(0, Math.floor(croppedAreaPixels.y)),
    Math.max(1, Math.floor(croppedAreaPixels.width)),
    Math.max(1, Math.floor(croppedAreaPixels.height)),
    0,
    0,
    size,
    size
  );
}

async function createCroppedHeroPortraitFile(crop: HeroPortraitCropState): Promise<File> {
  if (!crop.croppedAreaPixels) {
    throw new Error('Portre kırpma alanı hazır değil.');
  }
  const image = await loadImageForCanvas(crop.sourceUrl);
  const canvas = document.createElement('canvas');
  drawHeroPortraitCropToCanvas(canvas, image, crop.croppedAreaPixels, HERO_PORTRAIT_OUTPUT_SIZE);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Portre görseli sıkıştırılamadı.'));
    }, HERO_PORTRAIT_OUTPUT_MIME, HERO_PORTRAIT_OUTPUT_QUALITY);
  });
  const safeName = (crop.fileName || 'hero-portrait')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'hero-portrait';
  return new File([blob], `${safeName}-portre.jpg`, { type: HERO_PORTRAIT_OUTPUT_MIME });
}

function toTitleCaseTr(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((chunk) => {
      const lower = chunk.toLocaleLowerCase('tr-TR');
      if (!lower) return '';
      const first = lower.charAt(0).toLocaleUpperCase('tr-TR');
      return `${first}${lower.slice(1)}`;
    })
    .join(' ')
    .trim();
}

type SmartBookLanguageCode =
  | 'tr'
  | 'en'
  | 'es'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'ru'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'unknown';

function normalizeStoredLanguageCode(value: unknown): SmartBookLanguageCode {
  const raw = String(value || '').trim().toLowerCase();
  const allowed = new Set<SmartBookLanguageCode>([
    'tr', 'en', 'es', 'zh', 'ja', 'ko', 'ar', 'ru', 'fr', 'de', 'pt', 'it', 'unknown'
  ]);
  return allowed.has(raw as SmartBookLanguageCode) ? (raw as SmartBookLanguageCode) : 'unknown';
}

function detectLikelyLanguage(value: string): SmartBookLanguageCode {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';

  if (/[\u4E00-\u9FFF]/.test(raw)) return 'zh';
  if (/[\u3040-\u30FF]/.test(raw)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(raw)) return 'ko';
  if (/[\u0600-\u06FF]/.test(raw)) return 'ar';
  if (/[\u0400-\u04FF]/.test(raw)) return 'ru';

  const text = raw.toLocaleLowerCase('tr-TR').trim();
  if (!text) return 'unknown';

  const trChars = (text.match(/[çğıöşüı]/g) || []).length;
  const trHits = (text.match(/\b(ve|ile|için|konu|ders|öğrenme|temelleri|nedir|nasıl|özeti)\b/g) || []).length;
  const esChars = (text.match(/[ñáéíóúü]/g) || []).length;
  const esHits = (text.match(/\b(de|la|el|los|las|para|con|como|qué|introduccion|fundamentos|servicios|datos)\b/g) || []).length;
  const frChars = (text.match(/[àâçéèêëîïôûùüÿœ]/g) || []).length;
  const frHits = (text.match(/\b(le|la|les|des|pour|avec|bonjour|introduction|bases)\b/g) || []).length;
  const deChars = (text.match(/[äöüß]/g) || []).length;
  const deHits = (text.match(/\b(und|mit|für|einführung|grundlagen|daten)\b/g) || []).length;
  const ptChars = (text.match(/[ãõáàâêéíóôúç]/g) || []).length;
  const ptHits = (text.match(/\b(de|para|com|introducao|fundamentos|dados)\b/g) || []).length;
  const itHits = (text.match(/\b(di|con|per|introduzione|fondamenti|dati)\b/g) || []).length;
  const enHits = (text.match(/\b(and|with|for|topic|lesson|learning|basics|what|how|introduction|data)\b/g) || []).length;

  if (trChars > 0 || trHits > Math.max(enHits, esHits, frHits, deHits, ptHits, itHits)) return 'tr';
  if (esChars > 0 || esHits > Math.max(enHits, trHits, frHits, deHits, ptHits, itHits)) return 'es';
  if (frChars > 0 || frHits > Math.max(enHits, trHits, esHits, deHits, ptHits, itHits)) return 'fr';
  if (deChars > 0 || deHits > Math.max(enHits, trHits, esHits, frHits, ptHits, itHits)) return 'de';
  if (ptChars > 0 || ptHits > Math.max(enHits, trHits, esHits, frHits, deHits, itHits)) return 'pt';
  if (itHits > Math.max(enHits, trHits, esHits, frHits, deHits, ptHits) && itHits > 0) return 'it';
  if (/[a-z]/.test(text)) return 'en';
  return 'unknown';
}

function compactInlineText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function ensureSentenceEnding(value: string): string {
  const trimmed = compactInlineText(value);
  if (!trimmed) return '';
  return /[.!?…:;。！？]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sanitizeSmartBookDescriptionText(value: string): string {
  const compact = compactInlineText(value);
  if (!compact) return '';

  const cleaned = compact
    .replace(/\b(?:SmartBook|Fortale)\s+çalışma\s+akışı\b/gi, 'Fortale içeriği')
    .replace(/\b(?:SmartBook|Fortale)\s+study\s+flow\b/gi, 'Fortale content')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return ensureSentenceEnding(cleaned);
}

function normalizeTopicTokens(value: string): string[] {
  return compactInlineText(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 3);
}

function descriptionContainsTopicSignal(description: string, topic: string): boolean {
  const text = compactInlineText(description)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!text) return false;
  const topicTokens = normalizeTopicTokens(topic);
  if (topicTokens.length === 0) return false;
  return topicTokens.some((token) => text.includes(token));
}

function isGenericSmartBookDescription(description: string, topic: string): boolean {
  const compact = compactInlineText(description);
  if (!compact) return true;
  const patterns: RegExp[] = [
    /konunun temel çerçevesi,?\s*ana kavramları ve öğrenme hedefleri/i,
    /core framework,\s*key concepts,\s*and learning goals/i,
    /topic overview and study content/i,
    /temel kavramları ve önemli noktaları içeren smartbook içeriği/i,
    /^smartbook (?:içeriği|content)\.?$/i
  ];
  if (patterns.some((pattern) => pattern.test(compact))) return true;
  if (!descriptionContainsTopicSignal(compact, topic)) return true;
  return compact.length < 28;
}

function buildTopicSpecificDescription(topic: string, bookType: SmartBookBookType = 'novel', subGenre?: string): string {
  const cleanedTopic = compactInlineText(topic);
  const detected = detectLikelyLanguage(cleanedTopic);
  const genrePart = subGenre ? ` (${subGenre})` : '';

  if (detected === 'en') {
    return sanitizeSmartBookDescriptionText(
      `${cleanedTopic}${genrePart} is shaped through coherent story flow, clear character motivation, and thematic depth. Its central ideas develop through meaningful choices and a focused progression arc.`
    );
  }
  return sanitizeSmartBookDescriptionText(
    `${cleanedTopic}${genrePart}, tutarlı olay örgüsü, belirgin karakter motivasyonu ve tematik derinlikle şekillenir. Ana fikirleri anlamlı seçimler ve odaklı bir ilerleyiş üzerinden geliştirir.`
  );
}

function deriveSmartBookDescription(
  topic: string,
  nodes: TimelineNode[],
  bookType: SmartBookBookType = 'novel',
  subGenre?: string
): string {
  const candidates = [
    nodes.find((node) => node.type === 'lecture' && node.description?.trim())?.description,
    nodes.find((node) => node.type === 'reinforce' && node.description?.trim())?.description,
    nodes.find((node) => node.description?.trim())?.description
  ]
    .map((value) => compactInlineText(String(value || '')))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!isGenericSmartBookDescription(candidate, topic)) {
      return sanitizeSmartBookDescriptionText(candidate);
    }
  }

  return buildTopicSpecificDescription(topic, bookType, subGenre);
}

function buildSmartBookSearchTags(params: {
  topic: string;
  description?: string;
  category?: string;
  aiTags?: unknown;
  nodes?: TimelineNode[];
}): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const pushTag = (value: unknown) => {
    if (typeof value !== 'string') return;
    const cleaned = compactInlineText(value).replace(/[.,;:!?]+$/g, '').trim();
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) return;
    seen.add(key);
    result.push(cleaned);
  };

  if (Array.isArray(params.aiTags)) {
    params.aiTags.forEach(pushTag);
  }

  pushTag(params.topic);
  pushTag(params.category);
  pushTag(params.description);

  (params.nodes || []).slice(0, 6).forEach((node) => {
    pushTag(node.title);
  });

  return result.slice(0, 16);
}

function normalizeTopicForMatch(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_NARRATIVE_TITLE_TOKENS = new Set([
  'masal', 'hikaye', 'oyku', 'roman', 'kitap', 'book', 'story', 'novel', 'fairy', 'tale',
  'anlati', 'narrative', 'kategori', 'category', 'genre', 'tur', 'turu', 'subgenre', 'alt',
  'taslak', 'taslagi', 'draft', 'edebiyat', 'literature',
  'klasik', 'modern', 'macera', 'masali', 'mitolojik', 'esintili', 'egitici',
  'dram', 'komedi', 'korku', 'bilim', 'kurgu', 'distopik', 'utopik', 'gizem', 'psikolojik',
  'romantik', 'aile', 'gerilim', 'tarihsel', 'polisiye', 'fantastik', 'mizah'
]);

const NARRATIVE_SUBGENRE_TITLE_KEYS = new Set(
  Object.values(SMARTBOOK_SUBGENRE_OPTIONS)
    .flat()
    .map((item) => normalizeTopicForMatch(item))
    .filter(Boolean)
);

function getNarrativeBookTypeTitleKeys(bookType: SmartBookBookType): Set<string> {
  if (bookType === 'fairy_tale') {
    return new Set([
      normalizeTopicForMatch('masal'),
      normalizeTopicForMatch('fairy tale'),
      normalizeTopicForMatch('fairytale')
    ]);
  }
  if (bookType === 'story') {
    return new Set([
      normalizeTopicForMatch('hikaye'),
      normalizeTopicForMatch('öykü'),
      normalizeTopicForMatch('story')
    ]);
  }
  return new Set([
    normalizeTopicForMatch('roman'),
    normalizeTopicForMatch('novel')
  ]);
}

function isNarrativeBookTitleTooGeneric(
  title: string,
  options: { bookType: SmartBookBookType; subGenre?: string; topic?: string }
): boolean {
  const normalizedTitle = normalizeTopicForMatch(title);
  if (!normalizedTitle || normalizedTitle.length < 3) return true;
  if (/\b(?:taslak|taslagi|draft)\b/u.test(normalizedTitle)) return true;
  if (/^(?:[a-z0-9ğüşıöç]+)\s+(?:ve|ile)\s+(?:[a-z0-9ğüşıöç]+)(?:\s|$)/u.test(normalizedTitle)) return true;
  if (/^(?:[a-z0-9ğüşıöç]+)(?:nin|nın|nun|nün|in|ın|un|ün)\s+/u.test(normalizedTitle)) return true;

  const tokens = normalizedTitle.split(' ').filter(Boolean);
  if (tokens.length > 0 && tokens.length <= 4 && tokens.every((token) => GENERIC_NARRATIVE_TITLE_TOKENS.has(token))) {
    return true;
  }
  if (NARRATIVE_SUBGENRE_TITLE_KEYS.has(normalizedTitle)) return true;

  const normalizedTopic = normalizeTopicForMatch(options.topic || '');
  if (normalizedTopic && normalizedTopic === normalizedTitle) return true;
  const normalizedSubGenre = normalizeTopicForMatch(options.subGenre || '');
  if (normalizedSubGenre && normalizedSubGenre === normalizedTitle) return true;
  if (getNarrativeBookTypeTitleKeys(options.bookType).has(normalizedTitle)) return true;

  return false;
}

function bookTypeToLabel(bookType?: SmartBookBookType): string {
  if (bookType === 'fairy_tale') return 'Masal';
  if (bookType === 'story') return 'Çalışma Kitabı';
  if (bookType === 'novel') return 'Hikaye';
  return 'Kitap';
}

function resolveAutoNarrativeBookTitle(params: {
  bookType: SmartBookBookType;
  subGenre?: string;
  topicTitle: string;
  aiTitle?: string;
  outlineTitle?: string;
  generatedSectionTitles?: string[];
}): string {
  const sectionTitleHints = Array.isArray(params.generatedSectionTitles)
    ? params.generatedSectionTitles.slice(0, 6)
    : [];
  const candidates = [params.aiTitle, params.outlineTitle, ...sectionTitleHints, params.topicTitle]
    .map((value) => toTitleCaseTr(compactInlineText(String(value || ''))))
    .filter(Boolean);
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const dedupeKey = normalizeTopicForMatch(candidate);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (!isNarrativeBookTitleTooGeneric(candidate, {
      bookType: params.bookType,
      subGenre: params.subGenre,
      topic: params.topicTitle
    })) {
      return candidate;
    }
  }

  return '';
}

const MATCH_STOP_WORDS = new Set([
  've', 'ile', 'bir', 'bu', 'su', 'şu', 'da', 'de', 'mi', 'mu', 'mü', 'midir', 'nedir', 'icin', 'için',
  'the', 'and', 'for', 'with', 'from', 'into', 'about', 'that', 'this', 'is', 'are', 'of', 'to'
]);

function buildMatchTokenSet(value: string): Set<string> {
  const keepShortTokens = new Set(['ai', 'yz']);
  const tokens = normalizeTopicForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !MATCH_STOP_WORDS.has(token))
    .filter((token) => token.length >= 3 || keepShortTokens.has(token));
  return new Set(tokens);
}

function topicTokenOverlap(query: string, candidate: string): { ratio: number; overlapCount: number; queryTokenCount: number } {
  const queryTokens = buildMatchTokenSet(query);
  const candidateTokens = buildMatchTokenSet(candidate);
  if (queryTokens.size === 0 || candidateTokens.size === 0) {
    return { ratio: 0, overlapCount: 0, queryTokenCount: queryTokens.size };
  }

  let overlapCount = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlapCount += 1;
  });

  return {
    ratio: overlapCount / Math.max(queryTokens.size, candidateTokens.size),
    overlapCount,
    queryTokenCount: queryTokens.size
  };
}

function findLibraryMatchesByTopic(queryTopic: string, courses: CourseData[]): CourseData[] {
  const normalizedQuery = normalizeTopicForMatch(queryTopic);
  if (!normalizedQuery) return [];

  const queryLanguage = detectLikelyLanguage(queryTopic);
  const scored = courses
    .map((course) => {
      const normalizedCourseTopic = normalizeTopicForMatch(course.topic || '');
      if (!normalizedCourseTopic) return null;
      const normalizedHaystack = normalizeTopicForMatch([
        course.topic || '',
        course.description || '',
        course.category || '',
        Array.isArray(course.searchTags) ? course.searchTags.join(' ') : ''
      ].join(' '));

      const storedCourseLanguage = normalizeStoredLanguageCode(course.language);
      const courseLanguage = storedCourseLanguage !== 'unknown'
        ? storedCourseLanguage
        : detectLikelyLanguage(`${course.topic || ''} ${course.description || ''}`);
      if (
        queryLanguage !== 'unknown' &&
        courseLanguage !== 'unknown' &&
        queryLanguage !== courseLanguage
      ) {
        return null;
      }

      let score = 0;
      if (normalizedCourseTopic === normalizedQuery) score = 1;
      else if (
        normalizedCourseTopic.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedCourseTopic)
      ) {
        score = 0.78;
      } else if (
        normalizedHaystack.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedHaystack)
      ) {
        score = 0.62;
      } else {
        const overlapOnTopic = topicTokenOverlap(normalizedQuery, normalizedCourseTopic);
        const overlapOnHaystack = topicTokenOverlap(normalizedQuery, normalizedHaystack);
        const overlap = overlapOnTopic.ratio >= overlapOnHaystack.ratio ? overlapOnTopic : overlapOnHaystack;
        const shouldMatch =
          overlap.overlapCount >= 2
          || overlap.ratio >= 0.42
          || (overlap.queryTokenCount === 1 && overlap.overlapCount === 1);
        if (shouldMatch) score = 0.34 + overlap.ratio * 0.46;
      }

      if (score <= 0) return null;
      return { course, score };
    })
    .filter((item): item is { course: CourseData; score: number } => Boolean(item))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.course.lastActivity).getTime() - new Date(a.course.lastActivity).getTime();
    });

  return scored.slice(0, 6).map((item) => item.course);
}

export default function HomeView({
  onNavigate: _onNavigate,
  onCourseCreate,
  onDeleteCourse,
  savedCourses,
  onCourseSelect,
  canDeleteCourse,
  stickyNotes,
  onCreateStickyNote,
  onUpdateStickyNote,
  onDeleteStickyNote,
  onRequireCredit,
  onConsumeCredit,
  isBootstrapping = false,
  bootstrapMessage = 'Kitaplar senkronize ediliyor...',
  defaultBookLanguage = 'Turkish',
  courseOpenStates = {},
  isLoggedIn = true,
  onRequestLogin,
  authUserId
}: HomeViewProps) {
  const { language, locale, t } = useUiI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<SmartBookAgeGroup>('1-6');
  const [bookLanguageInput, setBookLanguageInput] = useState<string>(defaultBookLanguage);
  const [selectedBookType, setSelectedBookType] = useState<SmartBookBookType>('fairy_tale');
  const [isCreationWizardOpen, setCreationWizardOpen] = useState(false);
  const [accentedBookType, setAccentedBookType] = useState<SmartBookBookType | null>(null);
  const [selectedSubGenre, setSelectedSubGenre] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [customSubGenreInput, setCustomSubGenreInput] = useState('');
  const [customThemeInput, setCustomThemeInput] = useState('');
  const [selectedWorkbookLevel, setSelectedWorkbookLevel] = useState<WorkbookLevel>('Ortaokul');
  const [includeWorkbookExamples, setIncludeWorkbookExamples] = useState(true);
  const [includeWorkbookQuiz, setIncludeWorkbookQuiz] = useState(false);
  const [includeWorkbookRelatedBooks, setIncludeWorkbookRelatedBooks] = useState(false);
  const [settingTimeInput, setSettingTimeInput] = useState('');
  const [settingPlaceInput, setSettingPlaceInput] = useState('');
  const [settingTimeChoice, setSettingTimeChoice] = useState<WizardSettingTime>('');
  const [settingPlaceChoice, setSettingPlaceChoice] = useState<WizardSettingPlace>('');
  const [worldTypeChoice, setWorldTypeChoice] = useState<WizardWorldType>('');
  const [worldTypeInput, setWorldTypeInput] = useState('');
  const [heroAgeInput, setHeroAgeInput] = useState('');
  const [heroGender, setHeroGender] = useState<WizardHeroGender>('');
  const [heroCount, setHeroCount] = useState<number>(1);
  const [companionHeroes, setCompanionHeroes] = useState<WizardCompanionHero[]>([]);
  const [premiseMode, setPremiseMode] = useState<WizardPremiseMode>('examples');
  const [selectedPremise, setSelectedPremise] = useState('');
  const [customPremiseInput, setCustomPremiseInput] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [heroPortraitFile, setHeroPortraitFile] = useState<File | null>(null);
  const [heroPortraitPreviewUrl, setHeroPortraitPreviewUrl] = useState<string | null>(null);
  const [heroPortraitName, setHeroPortraitName] = useState('');
  const [selectedPortraitHeroName, setSelectedPortraitHeroName] = useState('');
  const [heroPortraitCrop, setHeroPortraitCrop] = useState<HeroPortraitCropState | null>(null);
  const [creationStep, setCreationStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [activeGeneratingBookType, setActiveGeneratingBookType] = useState<SmartBookBookType | null>(null);
  const [activeGeneratingLanguage, setActiveGeneratingLanguage] = useState<AppLanguageCode | null>(null);
  const [currentLiteraryFactIndex, setCurrentLiteraryFactIndex] = useState<number | null>(null);
  const literaryFactAvailableRef = useRef<number[]>([]);
  const literaryFactShownRef = useRef<number[]>([]);
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const [isStickyRowExpanded, setIsStickyRowExpanded] = useState(false);
  const [isStickySaving, setIsStickySaving] = useState(false);
  const [stickyNotice, setStickyNotice] = useState<string | null>(null);
  const [isStickyCopyConfirmed, setIsStickyCopyConfirmed] = useState(false);
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState('');
  const sourceFileInputRef = useRef<HTMLInputElement | null>(null);
  const heroPortraitInputRef = useRef<HTMLInputElement | null>(null);
  const stickyRowContainerRef = useRef<HTMLElement | null>(null);
  const homeShelfScrollRef = useRef<HTMLDivElement | null>(null);
  const homeRailStackRef = useRef<HTMLDivElement | null>(null);
  const stickyCopyTimerRef = useRef<number | null>(null);
  const stickyNoticeTimerRef = useRef<number | null>(null);
  const wizardInlineRef = useRef<HTMLDivElement | null>(null);
  const sourceNoticeTimerRef = useRef<number | null>(null);
  const lastDefaultBookLanguageRef = useRef(defaultBookLanguage);
  const generationJobPollTimerRef = useRef<number | null>(null);
  const activeGenerationJobIdRef = useRef<string | null>(null);
  const activeGenerationBookTypeRef = useRef<SmartBookBookType | null>(null);
  const generationProgressRef = useRef<number>(0);
  const generationStartedAtMsRef = useRef<number | null>(null);
  const [generationStartedAtMs, setGenerationStartedAtMs] = useState<number | null>(null);
  const [generationCountdownNowMs, setGenerationCountdownNowMs] = useState(() => Date.now());
  const loggedGenerationUsageEntryKeysRef = useRef<Set<string>>(new Set());
  const loggedGenerationUsageFinalKeysRef = useRef<Set<string>>(new Set());
  const [stickyModal, setStickyModal] = useState<StickyModalState>({
    isOpen: false,
    noteId: null,
    title: '',
    text: '',
    reminderAt: null,
    createdAt: new Date().toISOString()
  });
  const [courseDeleteModal, setCourseDeleteModal] = useState<CourseDeleteModalState>({
    isOpen: false,
    courseId: null,
    courseTitle: ''
  });
  const [isCourseDeleting, setIsCourseDeleting] = useState(false);
  const [isLoginRequiredModalOpen, setLoginRequiredModalOpen] = useState(false);
  const [homeCommunityBooks, setHomeCommunityBooks] = useState<CommunityBook[]>(
    () => homeCommunitySessionCache.get(homeCommunitySessionCacheKey(authUserId)) || []
  );
  const [isHomeCommunityLoading, setIsHomeCommunityLoading] = useState(
    () => !homeCommunitySessionCache.has(homeCommunitySessionCacheKey(authUserId))
  );
  const [selectedHomeCommunityBook, setSelectedHomeCommunityBook] = useState<CommunityBook | null>(null);
  const [isHomeCommunityDetailLoading, setIsHomeCommunityDetailLoading] = useState(false);
  const [isHomeCommunityDownloading, setIsHomeCommunityDownloading] = useState(false);
  const [isHomeCommunityReading, setIsHomeCommunityReading] = useState(false);
  const [selectedHomeCourse, setSelectedHomeCourse] = useState<CourseData | null>(null);
  const [homeCreateDockBounds, setHomeCreateDockBounds] = useState<{ top: number; height: number } | null>(null);
  const generationDisplayLanguage = isGenerating
    ? (activeGeneratingLanguage || normalizeAppLanguageCode(bookLanguageInput) || language)
    : language;

  const requireLoginForGeneration = (): boolean => {
    if (isLoggedIn) return false;
    setLoginRequiredModalOpen(true);
    return true;
  };

  useEffect(() => {
    const cacheKey = homeCommunitySessionCacheKey(authUserId);
    const cachedBooks = homeCommunitySessionCache.get(cacheKey);
    if (cachedBooks) {
      setHomeCommunityBooks(cachedBooks);
      setIsHomeCommunityLoading(false);
      return;
    }

    let cancelled = false;
    setIsHomeCommunityLoading(true);

    void Promise.all([
      listHomeCommunityBooks({ tab: 'popular', bookType: 'all', language: 'all', category: 'all', ageGroup: 'all', search: '', limit: 15 }),
      listHomeCommunityBooks({ tab: 'discover', bookType: 'all', language: 'all', category: 'all', ageGroup: 'all', search: '', limit: 30 })
    ]).then(([popularResult, discoveryResult]) => {
      if (cancelled) return;
      const popular = popularResult.data.books.map(parseHomeCommunityBook);
      const discovery = discoveryResult.data.books.map(parseHomeCommunityBook);
      const selectedBooks = shuffledUniqueCommunityBooks(popular, discovery);
      homeCommunitySessionCache.set(cacheKey, selectedBooks);
      setHomeCommunityBooks(selectedBooks);
    }).catch(() => {
      if (!cancelled) setHomeCommunityBooks([]);
    }).finally(() => {
      if (!cancelled) setIsHomeCommunityLoading(false);
    });

    return () => { cancelled = true; };
  }, [authUserId]);

  const openHomeCommunityBook = async (book: CommunityBook) => {
    setSelectedHomeCommunityBook(book);
    setIsHomeCommunityDetailLoading(true);
    try {
      const result = await getHomeCommunityBook({ communityBookId: book.id });
      setSelectedHomeCommunityBook(parseHomeCommunityBook(result.data.book));
    } catch {
      setSelectedHomeCommunityBook(null);
    } finally {
      setIsHomeCommunityDetailLoading(false);
    }
  };

  const handleHomeCommunityDownload = async () => {
    const book = selectedHomeCommunityBook;
    if (!book || isHomeCommunityDownloading) return;
    if (!isLoggedIn) {
      onRequestLogin?.();
      return;
    }
    if (book.isOwned || book.userId === authUserId) return;
    if (!onRequireCredit('community_download', COMMUNITY_DOWNLOAD_CREDIT_COST)) return;

    setIsHomeCommunityDownloading(true);
    try {
      const result = await downloadHomeCommunityBook({ communityBookId: book.id });
      window.dispatchEvent(new CustomEvent(CREDIT_WALLET_UPDATED_EVENT, { detail: result.data.wallet }));
      const downloadCount = book.downloadCount + (result.data.alreadyOwned ? 0 : 1);
      setSelectedHomeCommunityBook((current) => current?.id === book.id ? { ...current, isOwned: true, downloadCount } : current);
      setHomeCommunityBooks((current) => {
        const updated = current.map((item) => item.id === book.id ? { ...item, isOwned: true, downloadCount } : item);
        homeCommunitySessionCache.set(homeCommunitySessionCacheKey(authUserId), updated);
        return updated;
      });
      setSourceNotice(result.data.alreadyOwned ? t('Kitap zaten kitaplığınızda.') : t('Kitap kitaplığınıza eklendi!'));
    } catch {
      setSourceNotice(t('İndirme başarısız oldu.'));
    } finally {
      setIsHomeCommunityDownloading(false);
    }
  };

  const openOwnedHomeCommunityBook = async (book: CommunityBook): Promise<boolean> => {
    const courseId = getOwnedCommunityCourseId(book, authUserId);
    if (!courseId) return false;
    if (isHomeCommunityReading) return false;

    setIsHomeCommunityReading(true);
    try {
      const opened = await onCourseSelect(courseId);
      if (opened === false) {
        setSourceNotice(t('Kitap şu anda açılamadı. Lütfen tekrar deneyin.'));
        return false;
      }
      return true;
    } catch {
      setSourceNotice(t('Kitap şu anda açılamadı. Lütfen tekrar deneyin.'));
      return false;
    } finally {
      setIsHomeCommunityReading(false);
    }
  };

  const resetGenerationProgress = (next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    generationProgressRef.current = clamped;
    setGenerationProgress(clamped);
  };

  const raiseGenerationProgress = (next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    const monotonic = Math.max(generationProgressRef.current, clamped);
    generationProgressRef.current = monotonic;
    setGenerationProgress(monotonic);
  };

  function stopBookGenerationPolling(clearActiveJob = false) {
    if (generationJobPollTimerRef.current !== null) {
      window.clearTimeout(generationJobPollTimerRef.current);
      generationJobPollTimerRef.current = null;
    }
    if (clearActiveJob) {
      activeGenerationJobIdRef.current = null;
      activeGenerationBookTypeRef.current = null;
      setActiveGeneratingLanguage(null);
      loggedGenerationUsageEntryKeysRef.current.clear();
      loggedGenerationUsageFinalKeysRef.current.clear();
    }
  }

  function handleCancelGeneration() {
    const jobId = activeGenerationJobIdRef.current;
    writePendingBookGenerationJob(null);
    stopBookGenerationPolling(true);
    setIsGenerating(false);
    setActiveGeneratingBookType(null);
    setActiveGeneratingLanguage(null);
    generationStartedAtMsRef.current = null;
    setGenerationStartedAtMs(null);
    setGenerationStatus('');
    resetGenerationProgress(0);
    if (jobId) {
      cancelBookGenerationJob(jobId).catch(() => undefined);
    }
  }

  function logGenerationJobUsage(job: BookGenerationJobResult) {
    const usageEntries = Array.isArray(job.usageEntries) ? job.usageEntries : [];
    const seen = loggedGenerationUsageEntryKeysRef.current;

    for (const entry of usageEntries) {
      const key = [job.jobId, entry.label, entry.provider, entry.model, entry.inputTokens, entry.outputTokens, entry.estimatedCostUsd].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      console.info(`[COST] ${formatAiUsageEntryForConsole(entry)}`);
    }

    if (job.status !== 'completed' && job.status !== 'failed') return;

    const finalKey = [job.jobId, job.usage.inputTokens, job.usage.outputTokens, Number(job.usage.estimatedCostUsd || 0).toFixed(6)].join('|');
    if (loggedGenerationUsageFinalKeysRef.current.has(finalKey)) return;
    loggedGenerationUsageFinalKeysRef.current.add(finalKey);

    // Provider bazlı grupla
    const byProvider = new Map<string, { cost: number; count: number; label: string }>();
    for (const entry of usageEntries) {
      const provider = String(entry.provider || 'unknown');
      const model = String(entry.model || '');
      const key = `${provider} ${model}`.trim();
      const cost = Math.max(0, Number(entry.estimatedCostUsd) || 0);
      const existing = byProvider.get(key);
      if (existing) {
        existing.cost += cost;
        existing.count += 1;
      } else {
        byProvider.set(key, { cost, count: 1, label: key });
      }
    }

    const totalCost = Math.max(Number(job.usage.estimatedCostUsd) || 0, Array.from(byProvider.values()).reduce((s, v) => s + v.cost, 0));

    console.group(`📚 Kitap Maliyet Özeti — ${job.status === 'completed' ? '✅ tamamlandı' : '❌ başarısız'}`);
    for (const [, v] of byProvider) {
      console.info(`  ${v.label} × ${v.count}  →  $${v.cost.toFixed(4)}`);
    }
    console.info(`  ──────────────────────────────`);
    console.info(`  💰 Toplam: $${totalCost.toFixed(4)}  (${job.usage.totalTokens.toLocaleString()} token)`);
    console.groupEnd();
  }

  function resetSmartBookCreationForm() {
    setSearchTerm('');
    setCustomSubGenreInput('');
    setCustomThemeInput('');
    setSelectedWorkbookLevel('Ortaokul');
    setIncludeWorkbookExamples(true);
    setIncludeWorkbookQuiz(false);
    setIncludeWorkbookRelatedBooks(false);
    setSettingTimeInput('');
    setSettingPlaceInput('');
    setWorldTypeInput('');
    setBookLanguageInput(defaultBookLanguage);
    setSettingTimeChoice('');
    setSettingPlaceChoice('');
    setWorldTypeChoice('');
    setHeroAgeInput('');
    setHeroGender('');
    setHeroCount(1);
    setCompanionHeroes([]);
    setPremiseMode('examples');
    setSelectedPremise('');
    setCustomPremiseInput('');
    setSelectedPortraitHeroName('');
    setHeroPortraitName('');
    setCreationStep(1);
    setCreationWizardOpen(false);
    setAccentedBookType(null);
    clearSourceFile();
  }

  function resolvePreferredBookZipPath(...values: Array<unknown>): string | undefined {
    const normalized: string[] = [];
    for (const value of values) {
      const current = String(value || '').trim().replace(/^\/+/, '');
      if (!current || normalized.includes(current)) continue;
      normalized.push(current);
      if (/\/book\.zip$/i.test(current)) return current;
      if (/\/package\.json$/i.test(current)) {
        const withoutFile = current.replace(/\/package\.json$/i, '');
        if (/\/v\d+$/i.test(withoutFile)) return `${withoutFile}/book.zip`;
        return `${withoutFile}/v1/book.zip`;
      }
    }
    return normalized[0];
  }

  function syncGenerationUiFromJob(
    job: {
      status: 'queued' | 'processing' | 'completed' | 'failed';
      totalSections: number;
      completedSections: number;
      currentStepLabel: string | null;
    },
    fallbackBookType?: SmartBookBookType | null
  ) {
    const nextBookType = fallbackBookType || activeGenerationBookTypeRef.current || selectedBookType;
    activeGenerationBookTypeRef.current = nextBookType;
    setActiveGeneratingBookType(nextBookType);

    const totalSections = Math.max(1, job.totalSections || 1);
    const completedSections = Math.max(0, Math.min(totalSections, job.completedSections || 0));
    const progress = job.status === 'completed'
      ? 100
      : job.status === 'queued'
        ? 6
        : 10 + Math.round((completedSections / totalSections) * 86);

    raiseGenerationProgress(progress);
    setGenerationStatus(
      job.currentStepLabel?.trim()
      || (job.status === 'queued'
        ? 'Kitap üretim sırasına alındı...'
        : 'Kitabınız birleştiriliyor...')
    );

  }

  async function completeGeneratedBook(course: CourseData) {
    writePendingBookGenerationJob(null);
    stopBookGenerationPolling(true);
    setGenerationStatus('Kitap açılıyor...');
    raiseGenerationProgress(100);
    setActiveGeneratingBookType(null);
    setActiveGeneratingLanguage(null);
    generationStartedAtMsRef.current = null;
    setGenerationStartedAtMs(null);
    resetSmartBookCreationForm();
    try {
      await onCourseCreate(course);
      setIsGenerating(false);
    } catch (error) {
      console.error('Generated book local install failed', error);
      failGenerationJob(getUserFacingError(error, 'Kitap cihaza kaydedilemedi. Lütfen tekrar deneyin.'));
      return;
    }
    const notificationCopy = buildBookReadyNotificationCopy(course, language);
    LocalNotifications.schedule({
      notifications: [{
        id: Date.now() & 0x7fffffff,
        title: notificationCopy.title,
        body: notificationCopy.body,
        schedule: { at: new Date(Date.now() + 500) },
        sound: 'default',
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#9BC7FF',
      }]
    }).catch(() => undefined);
    window.setTimeout(() => {
      setGenerationStatus('');
      resetGenerationProgress(0);
    }, 500);
  }

  function failGenerationJob(message: string) {
    writePendingBookGenerationJob(null);
    stopBookGenerationPolling(true);
    setIsGenerating(false);
    setActiveGeneratingBookType(null);
    setActiveGeneratingLanguage(null);
    generationStartedAtMsRef.current = null;
    setGenerationStartedAtMs(null);
    setGenerationStatus('');
    resetGenerationProgress(0);
    setSourceNotice(getUserFacingError({ message }, GENERIC_TRANSIENT_ERROR_MESSAGE));
  }

  function startBookGenerationPolling(
    jobId: string,
    fallbackBookType?: SmartBookBookType | null,
    immediate = false
  ) {
    if (!jobId) return;
    if (activeGenerationJobIdRef.current !== jobId) {
      loggedGenerationUsageEntryKeysRef.current.clear();
      loggedGenerationUsageFinalKeysRef.current.clear();
    }
    stopBookGenerationPolling(false);
    activeGenerationJobIdRef.current = jobId;
    activeGenerationBookTypeRef.current = fallbackBookType || activeGenerationBookTypeRef.current || selectedBookType;
    if (fallbackBookType) {
      setActiveGeneratingBookType(fallbackBookType);
    }

    const poll = async () => {
      if (activeGenerationJobIdRef.current !== jobId) return;
      try {
        const job = await getBookGenerationJob(jobId);
        if (activeGenerationJobIdRef.current !== jobId) return;

        syncGenerationUiFromJob(job, fallbackBookType);
        logGenerationJobUsage(job);

        if (job.status === 'failed') {
          failGenerationJob(job.error || 'Fortale oluşturulurken bir hata oluştu.');
          return;
        }

        if (job.status === 'completed' && job.course) {
          const preferredPackagePath = resolvePreferredBookZipPath(
            job.bundle?.path,
            job.course.bundle?.path,
            job.course.contentPackagePath
          );
          const normalizedCompletedCourse: CourseData = {
            ...job.course,
            contentPackagePath: preferredPackagePath,
            contentPackageUpdatedAt: job.course.contentPackageUpdatedAt || job.bundle?.generatedAt,
            bundle: job.bundle || job.course.bundle || undefined,
            status: job.course.status || (job.bundle ? 'ready' : 'processing')
          };
          await completeGeneratedBook(normalizedCompletedCourse);
          return;
        }
      } catch (error) {
        if (activeGenerationJobIdRef.current !== jobId) return;
        const rawMessage = String((error as { message?: string } | null)?.message || '');
        if (/permission|denied|auth|giriş|login|unauth/i.test(rawMessage.toLocaleLowerCase('tr-TR'))) {
          failGenerationJob(GENERIC_AUTH_REQUIRED_MESSAGE);
          return;
        }
        setGenerationStatus('Üretim durumu yeniden kontrol ediliyor...');
      }

      generationJobPollTimerRef.current = window.setTimeout(() => {
        void poll();
      }, 1800);
    };

    if (immediate) {
      void poll();
      return;
    }

    generationJobPollTimerRef.current = window.setTimeout(() => {
      void poll();
    }, 1200);
  }

  useEffect(() => {
    setBookLanguageInput((previous) => {
      const trimmedPrevious = previous.trim();
      const previousDefault = lastDefaultBookLanguageRef.current;
      lastDefaultBookLanguageRef.current = defaultBookLanguage;
      if (!trimmedPrevious || trimmedPrevious === previousDefault) {
        return defaultBookLanguage;
      }
      return previous;
    });
  }, [defaultBookLanguage]);

  useEffect(() => {
    if (!sourceNotice) return;
    if (sourceNoticeTimerRef.current !== null) {
      window.clearTimeout(sourceNoticeTimerRef.current);
    }
    sourceNoticeTimerRef.current = window.setTimeout(() => {
      setSourceNotice(null);
      sourceNoticeTimerRef.current = null;
    }, 2600);
  }, [sourceNotice]);

  useEffect(() => {
    return () => {
      if (sourceNoticeTimerRef.current !== null) {
        window.clearTimeout(sourceNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const pendingJob = readPendingBookGenerationJob();
    if (!pendingJob) return;

    setIsGenerating(true);
    setSourceNotice(null);
    setActiveGeneratingBookType(pendingJob.bookType);
    setActiveGeneratingLanguage(pendingJob.language || normalizeAppLanguageCode(bookLanguageInput) || language);
    const pendingStartedAtMs = new Date(pendingJob.startedAt).getTime();
    const safePendingStartedAtMs = Number.isFinite(pendingStartedAtMs) ? pendingStartedAtMs : Date.now();
    generationStartedAtMsRef.current = safePendingStartedAtMs;
    setGenerationStartedAtMs(safePendingStartedAtMs);
    setGenerationStatus('Üretim durumu kontrol ediliyor...');
    resetGenerationProgress(1);
    startBookGenerationPolling(pendingJob.jobId, pendingJob.bookType, true);
  }, [bookLanguageInput, language]);

  useEffect(() => {
    if (!isGenerating || !activeGenerationJobIdRef.current) return;

    const resumePolling = () => {
      if (document.visibilityState !== 'hidden' && activeGenerationJobIdRef.current) {
        startBookGenerationPolling(
          activeGenerationJobIdRef.current,
          activeGenerationBookTypeRef.current,
          true
        );
      }
    };

    window.addEventListener('focus', resumePolling);
    document.addEventListener('visibilitychange', resumePolling);

    let appStateHandle: { remove: () => void } | null = null;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && activeGenerationJobIdRef.current) {
        startBookGenerationPolling(
          activeGenerationJobIdRef.current,
          activeGenerationBookTypeRef.current,
          true
        );
      }
    }).then((handle) => { appStateHandle = handle; }).catch(() => undefined);

    return () => {
      window.removeEventListener('focus', resumePolling);
      document.removeEventListener('visibilitychange', resumePolling);
      appStateHandle?.remove();
    };
  }, [isGenerating]);

  useEffect(() => {
    const factCount = getLiteraryFactsForBookType(activeGeneratingBookType ?? selectedBookType, generationDisplayLanguage).length;
    if (!isGenerating || factCount <= 0) {
      literaryFactAvailableRef.current = [];
      literaryFactShownRef.current = [];
      setCurrentLiteraryFactIndex(null);
      return;
    }

    const initialIndex = Math.floor(Math.random() * factCount);
    literaryFactAvailableRef.current = shuffledLiteraryFactIndices(factCount).filter((i) => i !== initialIndex);
    literaryFactShownRef.current = [initialIndex];
    setCurrentLiteraryFactIndex(initialIndex);
    const interval = window.setInterval(() => {
      setCurrentLiteraryFactIndex((previousIndex) => (
        pickNextLiteraryFactIndex(factCount, previousIndex, literaryFactAvailableRef, literaryFactShownRef)
      ));
    }, LITERARY_FACT_ROTATION_MS);
    return () => window.clearInterval(interval);
  }, [activeGeneratingBookType, generationDisplayLanguage, isGenerating, selectedBookType]);

  useEffect(() => {
    return () => {
      stopBookGenerationPolling(true);
    };
  }, []);

  const sortedCourses = useMemo(() => {
    return [...savedCourses].sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [savedCourses]);

  // When the top course changes (reorder after open), scroll shelf back to start so user sees it.
  const firstCourseId = sortedCourses[0]?.id;
  useEffect(() => {
    const el = homeShelfScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: 'smooth' });
  }, [firstCourseId]);

  const sortedStickyNotes = useMemo(() => {
    return [...stickyNotes].sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [stickyNotes]);

  const stickyTintById = useMemo(() => {
    const assigned = new Map<string, StickyTint>();
    const total = stickyTintPalette.length;
    sortedStickyNotes.forEach((note, index) => {
      assigned.set(note.id, stickyTintPalette[index % total]);
    });
    return assigned;
  }, [sortedStickyNotes]);

  const activeStickyTint = useMemo(() => {
    if (!stickyModal.noteId) return stickyTintPalette[0];
    return stickyTintById.get(stickyModal.noteId) || stickyTintPalette[0];
  }, [stickyModal.noteId, stickyTintById]);

  const homeShelfCourses = sortedCourses.slice(0, 12);
  const renderBootstrapShelf = () => (
    <div
      className="relative overflow-hidden rounded-[28px] border p-5 text-center"
      style={{
        background: 'rgba(8, 36, 70, 0.92)',
        borderColor: 'rgba(139,187,244,0.24)',
        boxShadow: '0 24px 60px rgba(4, 10, 18, 0.34), inset 0 1px 0 rgba(190, 220, 255, 0.08)'
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-[-12%] top-0 h-24 blur-3xl"
        style={{ background: 'rgba(96,151,214,0.14)' }}
      />
      <div className="relative flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 px-4 py-2">
          <FaviconSpinner size={26} />
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white">{t('Kitaplar yükleniyor...')}</span>
        </div>

        <p className="mx-auto max-w-[260px] text-[11px] leading-5 text-white">{bootstrapMessage}</p>

        <div className="grid w-full grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div
              key={`bootstrap-book-${index}`}
              className="relative overflow-hidden rounded-[22px] border px-3 pb-4 pt-5"
              style={{
                background: 'rgba(8, 28, 55, 0.9)',
                borderColor: 'rgba(139,187,244,0.18)',
                animation: `smartbook-loading-dot 1.6s ease-in-out ${index * 0.18}s infinite`
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-14"
                style={{ background: 'rgba(190,220,255,0.08)' }}
              />
              <div className="relative mx-auto h-20 w-14 rounded-[16px] border border-white/10 bg-[rgba(96,151,214,0.24)]" />
              <div className="relative mt-4 space-y-2">
                <div className="mx-auto h-2.5 w-16 rounded-full bg-white/12" />
                <div className="mx-auto h-2 w-10 rounded-full bg-white/8" />
              </div>
            </div>
          ))}
        </div>

        <div className="smartbook-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    const options = SMARTBOOK_SUBGENRE_OPTIONS[selectedBookType] || [];
    if (options.length === 0) {
      setSelectedSubGenre('');
      return;
    }
    if (selectedSubGenre === CUSTOM_WIZARD_OPTION) return;
    if (!options.includes(selectedSubGenre)) {
      setSelectedSubGenre(options[0]);
    }
  }, [selectedBookType, selectedSubGenre]);

  const openStickyModal = (note?: StickyNoteData) => {
    if (note) {
      setStickyModal({
        isOpen: true,
        noteId: note.id,
        title: note.title || '',
        text: note.text || '',
        reminderAt: note.reminderAt ?? null,
        createdAt: note.createdAt.toISOString()
      });
      setReminderDraft(toLocalDateTimeValue(note.reminderAt ?? null));
      setStickyNotice(null);
      setIsStickyCopyConfirmed(false);
      setIsReminderPickerOpen(false);
      return;
    }

    setStickyModal({
      isOpen: true,
      noteId: null,
      title: '',
      text: '',
      reminderAt: null,
      createdAt: new Date().toISOString()
    });
    setReminderDraft('');
    setStickyNotice(null);
    setIsStickyCopyConfirmed(false);
    setIsReminderPickerOpen(false);
  };

  const closeStickyModal = () => {
    if (isStickySaving) return;
    setStickyModal({
      isOpen: false,
      noteId: null,
      title: '',
      text: '',
      reminderAt: null,
      createdAt: new Date().toISOString()
    });
    setReminderDraft('');
    setIsStickyCopyConfirmed(false);
    setIsReminderPickerOpen(false);
    setStickyNotice(null);
  };

  const pushStickyNotice = (message: string) => {
    setStickyNotice(message);
    if (stickyNoticeTimerRef.current !== null) {
      window.clearTimeout(stickyNoticeTimerRef.current);
    }
    stickyNoticeTimerRef.current = window.setTimeout(() => {
      setStickyNotice(null);
      stickyNoticeTimerRef.current = null;
    }, 1800);
  };

  useEffect(() => {
    if (!stickyModal.isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStickyModal();
      }
    };
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [stickyModal.isOpen, isStickySaving]);

  useEffect(() => () => {
    if (stickyCopyTimerRef.current !== null) {
      window.clearTimeout(stickyCopyTimerRef.current);
    }
    if (stickyNoticeTimerRef.current !== null) {
      window.clearTimeout(stickyNoticeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const sourceUrl = heroPortraitCrop?.sourceUrl;
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [heroPortraitCrop?.sourceUrl]);

  useEffect(() => {
    if (!heroPortraitFile) {
      setHeroPortraitPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(heroPortraitFile);
    setHeroPortraitPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [heroPortraitFile]);

  useEffect(() => {
    if (!courseDeleteModal.isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCourseDeleting) {
        setCourseDeleteModal({ isOpen: false, courseId: null, courseTitle: '' });
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [courseDeleteModal.isOpen, isCourseDeleting]);

  useEffect(() => {
    if (!isStickyRowExpanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (stickyRowContainerRef.current?.contains(target)) return;
      setIsStickyRowExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isStickyRowExpanded]);

  const handleStickySave = async () => {
    if (isStickySaving) return;
    const title = stickyModal.title.trim();
    const text = stickyModal.text.trim();
    const reminderAt = stickyModal.reminderAt;
    if (!title && !text) {
      closeStickyModal();
      return;
    }

    setIsStickySaving(true);
    try {
      if (stickyModal.noteId) {
        await onUpdateStickyNote(stickyModal.noteId, { title, text, reminderAt });
      } else {
        await onCreateStickyNote({ title, text, reminderAt });
      }
      closeStickyModal();
    } catch (error) {
      console.error('Sticky note save failed:', error);
      pushStickyNotice('Kaydetme başarısız.');
    } finally {
      setIsStickySaving(false);
    }
  };

  const handleStickyDelete = async () => {
    if (!stickyModal.noteId || isStickySaving) {
      closeStickyModal();
      return;
    }
    const isConfirmed = window.confirm('Yapışkan not silinsin mi?');
    if (!isConfirmed) return;

    setIsStickySaving(true);
    try {
      await onDeleteStickyNote(stickyModal.noteId);
      closeStickyModal();
    } catch (error) {
      console.error('Sticky note delete failed:', error);
      pushStickyNotice('Silme başarısız.');
    } finally {
      setIsStickySaving(false);
    }
  };

  const handleStickyCopy = async () => {
    const content = buildStickyContent(stickyModal.title, stickyModal.text);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setIsStickyCopyConfirmed(true);
      if (stickyCopyTimerRef.current !== null) {
        window.clearTimeout(stickyCopyTimerRef.current);
      }
      stickyCopyTimerRef.current = window.setTimeout(() => {
        setIsStickyCopyConfirmed(false);
        stickyCopyTimerRef.current = null;
      }, 1800);
      pushStickyNotice('Kopyalandı.');
    } catch (error) {
      console.error('Sticky note copy failed:', error);
      pushStickyNotice('Kopyalama başarısız.');
    }
  };

  const openCourseDeleteModal = (course: CourseData) => {
    setCourseDeleteModal({
      isOpen: true,
      courseId: course.id,
      courseTitle: course.topic || 'İsimsiz Kitap'
    });
  };

  const closeCourseDeleteModal = () => {
    if (isCourseDeleting) return;
    setCourseDeleteModal({ isOpen: false, courseId: null, courseTitle: '' });
  };

  const handleCourseDeleteConfirm = async () => {
    if (!courseDeleteModal.courseId || isCourseDeleting) return;
    setIsCourseDeleting(true);
    try {
      await onDeleteCourse(courseDeleteModal.courseId);
      setCourseDeleteModal({ isOpen: false, courseId: null, courseTitle: '' });
    } catch (error) {
      console.error('Book delete failed:', error);
      setSourceNotice('Kitap silinirken bir hata oluştu.');
    } finally {
      setIsCourseDeleting(false);
    }
  };

  const handleStickyDownload = () => {
    const content = buildStickyContent(stickyModal.title, stickyModal.text);
    if (!content) return;
    const fileName = buildStickyDownloadName(stickyModal.title || 'yapiskan-not');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    pushStickyNotice('Dosya indirildi.');
  };

  const handleStickyShare = async () => {
    const content = buildStickyContent(stickyModal.title, stickyModal.text);
    if (!content) return;
    const title = stickyModal.title.trim() || 'Yapışkan Not';
    try {
      if (navigator.share) {
        await navigator.share({ title, text: content });
      } else {
        await navigator.clipboard.writeText(content);
        pushStickyNotice('Paylaşım desteklenmiyor, metin kopyalandı.');
        return;
      }
      pushStickyNotice('Paylaşıldı.');
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
      console.error('Sticky note share failed:', error);
      pushStickyNotice('Paylaşım başarısız.');
    }
  };

  const persistStickyReminder = async (nextReminderAt: string | null) => {
    if (!stickyModal.noteId) return;
    setIsStickySaving(true);
    try {
      await onUpdateStickyNote(stickyModal.noteId, {
        title: stickyModal.title.trim(),
        text: stickyModal.text.trim(),
        reminderAt: nextReminderAt
      });
    } catch (error) {
      console.error('Sticky reminder update failed:', error);
      pushStickyNotice('Hatırlatıcı kaydedilemedi.');
    } finally {
      setIsStickySaving(false);
    }
  };

  const handleReminderApply = async () => {
    const isoValue = toIsoDateTimeValue(reminderDraft);
    if (!isoValue) {
      pushStickyNotice('Geçerli bir tarih seçin.');
      return;
    }
    setStickyModal((prev) => ({ ...prev, reminderAt: isoValue }));
    setIsReminderPickerOpen(false);
    await persistStickyReminder(isoValue);
    pushStickyNotice('Hatırlatıcı ayarlandı.');
  };

  const handleReminderClear = async () => {
    setReminderDraft('');
    setStickyModal((prev) => ({ ...prev, reminderAt: null }));
    setIsReminderPickerOpen(false);
    await persistStickyReminder(null);
    pushStickyNotice('Hatırlatıcı kaldırıldı.');
  };

  const handleSourceFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) return;

    if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
      setSourceNotice('Dosya boyutu 8 MB sınırını aşıyor.');
      setSourceFile(null);
      return;
    }

    setSourceFile(file);
    setSourceNotice(null);
  };

  const clearSourceFile = () => {
    setSourceFile(null);
    setSourceNotice(null);
    if (sourceFileInputRef.current) {
      sourceFileInputRef.current.value = '';
    }
  };

  const handleHeroPortraitPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_HERO_PORTRAIT_SOURCE_FILE_SIZE_BYTES) {
      setSourceNotice(t('Portre görseli 16 MB sınırını aşıyor.'));
      setHeroPortraitFile(null);
      return;
    }

    setHeroPortraitCrop((previous) => {
      if (previous?.sourceUrl) URL.revokeObjectURL(previous.sourceUrl);
      return {
        sourceUrl: URL.createObjectURL(file),
        fileName: file.name || 'hero-portrait',
        crop: { x: 0, y: 0 },
        zoom: 1.18,
        croppedAreaPixels: null,
        isProcessing: false
      };
    });
    setSourceNotice(null);
  };

  const dismissHeroPortraitCrop = () => {
    setHeroPortraitCrop((previous) => {
      if (previous?.sourceUrl) URL.revokeObjectURL(previous.sourceUrl);
      return null;
    });
  };

  const updateHeroPortraitCrop = (patch: Partial<Pick<HeroPortraitCropState, 'crop' | 'zoom' | 'croppedAreaPixels'>>) => {
    setHeroPortraitCrop((previous) => previous ? { ...previous, ...patch } : previous);
  };

  const applyHeroPortraitCrop = async () => {
    const crop = heroPortraitCrop;
    if (!crop || crop.isProcessing) return;
    setHeroPortraitCrop((previous) => previous ? { ...previous, isProcessing: true } : previous);
    try {
      const croppedFile = await createCroppedHeroPortraitFile(crop);
      setHeroPortraitFile(croppedFile);
      setSourceNotice(null);
      dismissHeroPortraitCrop();
    } catch (error) {
      console.error('Hero portrait crop failed', error);
      setHeroPortraitCrop((previous) => previous ? { ...previous, isProcessing: false } : previous);
      setSourceNotice(t('Portre hazırlanamadı.'));
    }
  };

  const clearHeroPortrait = () => {
    setHeroPortraitFile(null);
    dismissHeroPortraitCrop();
    if (heroPortraitInputRef.current) {
      heroPortraitInputRef.current.value = '';
    }
  };

  const handleHeroCountChange = (nextCount: number) => {
    const safeCount = Math.max(1, Math.min(4, Math.round(nextCount || 1)));
    setHeroCount(safeCount);
    setCompanionHeroes((previous) => {
      const nextLength = Math.max(0, safeCount - 1);
      return Array.from({ length: nextLength }, (_, index) => previous[index] || { name: '', gender: '' });
    });
  };

  const updateCompanionHero = (index: number, patch: Partial<WizardCompanionHero>) => {
    setCompanionHeroes((previous) => {
      const nextLength = Math.max(0, heroCount - 1);
      const next = Array.from({ length: nextLength }, (_, itemIndex) => previous[itemIndex] || { name: '', gender: '' });
      next[index] = { ...(next[index] || { name: '', gender: '' }), ...patch };
      return next;
    });
  };

  const handleBookTypeSelect = (bookType: SmartBookBookType) => {
    if (isCreationWizardOpen && selectedBookType === bookType) {
      setCreationWizardOpen(false);
      setAccentedBookType(null);
      setCreationStep(1);
      return;
    }
    setCreationWizardOpen(true);
    setSelectedBookType(bookType);
    setAccentedBookType(bookType);
    if (bookType === 'fairy_tale') {
      setSelectedAgeGroup('1-6');
    }
    if (bookType === 'story') {
      setPremiseMode('custom');
      setSelectedAgeGroup('12-18');
      setSelectedWorkbookLevel((current) => current || 'Ortaokul');
    }
    if (selectedBookType !== bookType) {
      setSelectedSubGenre('');
      setSelectedTheme('');
      setCustomSubGenreInput('');
      setCustomThemeInput('');
      if (bookType === 'story') {
        setSelectedSubGenre('Bilimsel');
        setSelectedTheme('');
      }
    }
    setCreationStep(1);
    if (bookType !== 'fairy_tale' && !isSmartBookAgeGroupAllowedForBookType(bookType, selectedAgeGroup)) {
      setSelectedAgeGroup(getDefaultSmartBookAgeGroupForBookType(bookType));
    }
  };

  const pageRange = getPageRangeByBookType(selectedBookType, selectedAgeGroup);
  const heroPortraitExtraCreditCost = selectedBookType === 'story' ? 0 : (heroPortraitFile ? 1 : 0);
  const selectedCreateCreditCost = getBookTypeCreateCreditCost(selectedBookType) + heroPortraitExtraCreditCost;
  const effectiveSubGenre = selectedSubGenre === CUSTOM_WIZARD_OPTION
    ? compactInlineText(customSubGenreInput)
    : selectedSubGenre;
  const effectiveTheme = selectedTheme === CUSTOM_WIZARD_OPTION
    ? compactInlineText(customThemeInput)
    : selectedTheme;
  const targetPageCountPreview = buildTargetPageFromBrief({
    bookType: selectedBookType,
    targetPageMin: pageRange.min,
    targetPageMax: pageRange.max
  }, selectedAgeGroup);
  const selectedSubGenreThemes = selectedSubGenre && selectedSubGenre !== CUSTOM_WIZARD_OPTION
    ? SMARTBOOK_THEME_OPTIONS[selectedBookType]?.[selectedSubGenre] || []
    : [];
  const ageGroupOptionsForSelectedBookType = getSmartBookAgeGroupOptionsForBookType(selectedBookType);
  const settingTimeLabel = settingTimeChoice
    ? settingTimeChoice === 'custom'
      ? compactInlineText(settingTimeInput)
      : SETTING_TIME_OPTIONS.find((option) => option.value === settingTimeChoice)?.label
    : undefined;
  const settingPlaceBaseLabel = settingPlaceChoice
    ? SETTING_PLACE_OPTIONS.find((option) => option.value === settingPlaceChoice)?.label
    : undefined;
  const settingPlaceLabel = settingPlaceChoice === 'custom'
    ? compactInlineText(settingPlaceInput)
    : settingPlaceBaseLabel;
  const worldTypeLabel = worldTypeChoice
    ? worldTypeChoice === 'custom'
      ? compactInlineText(worldTypeInput)
      : WORLD_TYPE_OPTIONS.find((option) => option.value === worldTypeChoice)?.label
    : undefined;
  const selectedStoryPremise = premiseMode === 'custom'
    ? compactInlineText(customPremiseInput)
    : selectedPremise;
  const workbookAgeGroupForSelectedLevel: SmartBookAgeGroup = selectedWorkbookLevel === 'İlkokul'
    ? '7-11'
    : selectedWorkbookLevel === 'Üniversite'
      ? 'general'
      : '12-18';
  const portraitHeroOptions = [
    compactInlineText(heroPortraitName),
    ...companionHeroes
      .slice(0, Math.max(0, heroCount - 1))
      .map((hero) => compactInlineText(hero.name))
  ].filter(Boolean);
  const selectedPortraitHeroTarget = heroPortraitFile
    ? (portraitHeroOptions.includes(selectedPortraitHeroName) ? selectedPortraitHeroName : portraitHeroOptions[0] || '')
    : '';
  const estimatedGenerationMinutes = getEstimatedGenerationMinutes(selectedBookType);
  const displayedGenerationMinutes = getEstimatedGenerationMinutes(activeGeneratingBookType || selectedBookType);
  const elapsedGenerationMinutes = generationStartedAtMs
    ? Math.floor(Math.max(0, generationCountdownNowMs - generationStartedAtMs) / 60000)
    : 0;
  const displayedGenerationMinutesRemaining = isGenerating
    ? Math.max(1, displayedGenerationMinutes - elapsedGenerationMinutes)
    : displayedGenerationMinutes;

  useEffect(() => {
    if (!isGenerating || !generationStartedAtMs) return;
    setGenerationCountdownNowMs(Date.now());
    const interval = window.setInterval(() => {
      setGenerationCountdownNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [generationStartedAtMs, isGenerating]);

  const buildCreativeBriefPayload = (): SmartBookCreativeBrief => {
    const normalizedPlace = settingPlaceLabel ? compactInlineText(settingPlaceLabel) : '';
    const normalizedTime = settingTimeLabel ? compactInlineText(settingTimeLabel) : '';
    const normalizedPremise = compactInlineText(selectedStoryPremise);
    const normalizedLanguageText = compactInlineText(bookLanguageInput);
    const canonicalBookLanguage = normalizeAppLanguageCode(normalizedLanguageText) || undefined;
    if (selectedBookType === 'story') {
      const workbookCategory = effectiveSubGenre || 'Bilimsel';
      const workbookLevel = selectedWorkbookLevel || 'Ortaokul';
      const workbookExtras = [
        includeWorkbookExamples ? 'gerçek yaşam örnekleri' : undefined,
        includeWorkbookQuiz ? 'quiz' : undefined,
        includeWorkbookRelatedBooks ? 'ilgili kitaplar' : undefined
      ].filter(Boolean).join(', ');
      const workbookFacts = [
        `Tur: Calisma Kitabi`,
        normalizedPremise ? `Konu: ${normalizedPremise}` : undefined,
        `Seviye: ${workbookLevel}`,
        `Calisma kitabi turu: ${workbookCategory}`,
        workbookExtras ? `Ek icerikler: ${workbookExtras}` : 'Ek icerikler: secilmedi'
      ].filter(Boolean) as string[];
      const workbookInstructionParts = [
        `Kullanici baglami (zorunlu): ${workbookFacts.join(' | ')}.`,
        'Bu üretim kurmaca hikaye değildir; bilimsel/akademik çalışma kitabıdır.',
        includeWorkbookExamples
          ? 'Gerçek yaşam ve güncel örnekleri anlatıma doğal biçimde yedir; "Örnek 1" veya "Örnek 2" gibi mekanik başlıklar kullanma.'
          : 'Gerçek yaşam örneklerini zorunlu bölüm haline getirme; yalnızca konu açıklığı için gerekiyorsa kısa kullan.',
        includeWorkbookQuiz
          ? 'Kitabın en sonunda 8 çoktan seçmeli ve 4 doğru/yanlış sorudan oluşan quiz bölümü ekle.'
          : undefined,
        includeWorkbookRelatedBooks
          ? 'Kitabın en sonunda konu ile ilgili en az 4 okuma/kitap önerisi ekle.'
          : undefined,
        'Kısa bir Terimler Sözlüğü ekle.'
      ].filter(Boolean) as string[];
      if (normalizedLanguageText) {
        workbookInstructionParts.push(`Üretim dili zorunluluğu: ${normalizedLanguageText}.`);
      }
      return {
        bookType: selectedBookType,
        subGenre: workbookCategory,
        languageText: canonicalBookLanguage || normalizedLanguageText || undefined,
        workbookLevel,
        workbookCategory,
        includeExamples: includeWorkbookExamples,
        includeQuiz: includeWorkbookQuiz,
        includeRelatedBooks: includeWorkbookRelatedBooks,
        endingStyle: 'happy',
        customInstructions: workbookInstructionParts.join(' '),
        targetPageMin: pageRange.min,
        targetPageMax: pageRange.max
      };
    }
    const normalizedHeroPortraitName = compactInlineText(heroPortraitName);
    const normalizedPortraitHeroTarget = compactInlineText(selectedPortraitHeroTarget);
    const normalizedHeroAge = compactInlineText(heroAgeInput);
    const heroGenderLabel = heroGender
      ? HERO_GENDER_OPTIONS.find((option) => option.value === heroGender)?.label
      : undefined;
    const normalizedCompanionHeroes = companionHeroes
      .slice(0, Math.max(0, heroCount - 1))
      .map((hero, index) => {
        const name = compactInlineText(hero.name);
        const genderLabel = hero.gender
          ? HERO_GENDER_OPTIONS.find((option) => option.value === hero.gender)?.label
          : undefined;
        return name
          ? `${index + 2}. kahraman: ${name}${genderLabel ? ` (${genderLabel})` : ''}`
          : '';
      })
      .filter(Boolean);
    const characterHints = [
      normalizedHeroPortraitName ? `Ana karakter: ${normalizedHeroPortraitName}.` : undefined,
      normalizedHeroAge ? `Ana karakter yaşı: ${normalizedHeroAge}.` : undefined,
      heroGenderLabel ? `Ana karakter cinsiyeti: ${heroGenderLabel}.` : undefined,
      normalizedCompanionHeroes.length > 0 ? `Diğer kahramanlar: ${normalizedCompanionHeroes.join('; ')}.` : undefined
    ].filter(Boolean) as string[];
    const promptFacts = [
      `Tur: ${selectedBookType}`,
      effectiveSubGenre ? `Alt tur: ${effectiveSubGenre}` : undefined,
      effectiveTheme ? `Tema: ${effectiveTheme}` : undefined,
      normalizedHeroPortraitName ? `Ana karakter: ${normalizedHeroPortraitName}` : undefined,
      normalizedHeroAge ? `Ana karakter yasi: ${normalizedHeroAge}` : undefined,
      heroGenderLabel ? `Ana karakter cinsiyeti: ${heroGenderLabel}` : undefined,
      `Kahraman sayisi: ${heroCount}`,
      normalizedCompanionHeroes.length > 0 ? normalizedCompanionHeroes.join(' | ') : undefined,
      normalizedPlace ? `Mekan: ${normalizedPlace}` : undefined,
      normalizedTime ? `Zaman: ${normalizedTime}` : undefined,
      worldTypeLabel ? `Dunya tipi: ${worldTypeLabel}` : undefined,
      normalizedPremise ? `Hikaye cekirdegi: ${normalizedPremise}` : undefined
    ].filter(Boolean) as string[];
    const promptFactsBlock = promptFacts.length > 0
      ? `Kullanici baglami (zorunlu): ${promptFacts.join(' | ')}.`
      : undefined;
    const customInstructionParts = [
      promptFactsBlock,
      normalizedPortraitHeroTarget ? `Portre referansı ${normalizedPortraitHeroTarget} adlı kahramana aittir; görsellerde bu kahramanın kimlik tutarlılığı korunmalı.` : undefined,
      normalizedPremise ? `Hikaye çekirdeği: ${normalizedPremise}.` : undefined,
      normalizedLanguageText ? `Üretim dili zorunluluğu: ${normalizedLanguageText}.` : undefined
    ].filter(Boolean) as string[];
    return {
      bookType: selectedBookType,
      subGenre: effectiveSubGenre || undefined,
      languageText: canonicalBookLanguage || normalizedLanguageText || undefined,
      characters: characterHints.join(' ').trim() || undefined,
      settingPlace: normalizedPlace || undefined,
      settingTime: normalizedTime || undefined,
      endingStyle: 'happy',
      customInstructions: customInstructionParts.join(' '),
      targetPageMin: pageRange.min,
      targetPageMax: pageRange.max
    };
  };

  const handleCreateSmartBook = async () => {
    if (requireLoginForGeneration()) return;

    const topicHint = selectedStoryPremise.trim();
    const detailHint = selectedStoryPremise.trim();
    const selectedFile = sourceFile;
    const selectedHeroPortraitFile = selectedBookType === 'story' ? null : heroPortraitFile;
    const selectedHeroPortraitName = compactInlineText(selectedPortraitHeroTarget);
    const creativeBrief = buildCreativeBriefPayload();

    if (selectedHeroPortraitFile && !selectedHeroPortraitName) {
      setSourceNotice(t('Portre eklenecek kahramanı seçin.'));
      return;
    }

    const localViolation = findRestrictedBookTopicInTexts([
      topicHint,
      detailHint,
      selectedSubGenre,
      selectedTheme,
      customSubGenreInput,
      customThemeInput,
      selectedWorkbookLevel,
      heroPortraitName,
      heroAgeInput,
      ...companionHeroes.map((hero) => `${hero.name} ${hero.gender}`),
      settingTimeLabel,
      settingPlaceLabel,
      worldTypeLabel,
      selectedStoryPremise,
      customPremiseInput,
      settingTimeInput,
      settingPlaceInput,
      worldTypeInput,
      creativeBrief?.characters,
      creativeBrief?.settingPlace,
      creativeBrief?.settingTime,
      creativeBrief?.customInstructions
    ]);
    if (localViolation) {
      setSourceNotice(BOOK_CONTENT_SAFETY_MESSAGE);
      return;
    }

    if (!onRequireCredit('create', selectedCreateCreditCost)) {
      setSourceNotice(
        t('Fortale oluşturmak için {{var0}} oluşturma kredisi gerekiyor.').replace('{{var0}}', String(selectedCreateCreditCost))
      );
      return;
    }

    stopBookGenerationPolling(true);
    writePendingBookGenerationJob(null);
    setIsGenerating(true);
    setActiveGeneratingBookType(selectedBookType);
    const generationStartedAt = Date.now();
    generationStartedAtMsRef.current = generationStartedAt;
    setGenerationStartedAtMs(generationStartedAt);
    resetGenerationProgress(1);
    setSourceNotice(null);
    try {
      let resolvedTopic = topicHint;
      let sourceContent: string | undefined = detailHint || undefined;

      if (selectedFile) {
        setGenerationStatus('Doküman analiz ediliyor...');
        raiseGenerationProgress(4);
        const base64 = await readFileAsBase64(selectedFile);
        const context = await extractDocumentContext(
          base64,
          selectedFile.type || 'application/octet-stream',
          selectedFile.name,
          topicHint || undefined
        );
        if (!resolvedTopic) {
          resolvedTopic = context.topic;
        }
        const mergedSourceContent = [detailHint, context.sourceContent].filter(Boolean).join('\n\n').trim();
        sourceContent = mergedSourceContent || sourceContent;

        const extractedViolation = findRestrictedBookTopicInTexts([
          context.topic,
          context.sourceContent,
          mergedSourceContent
        ]);
        if (extractedViolation) {
          throw new Error(BOOK_CONTENT_SAFETY_MESSAGE);
        }
      }

      if (!resolvedTopic) resolvedTopic = '';

      const normalizedTopic = compactInlineText(resolvedTopic);
      const allowAiBookTitleGeneration = selectedBookType === 'story' || !topicHint;
      const generationLanguage = normalizeAppLanguageCode(bookLanguageInput) || language;
      stopBookGenerationPolling(true);
      writePendingBookGenerationJob(null);
      setActiveGeneratingBookType(selectedBookType);
      setActiveGeneratingLanguage(generationLanguage);
      setGenerationStatus('İçerik hazırlanıyor');
      raiseGenerationProgress(6);

      const jobState = await startBookGenerationJob({
        topic: normalizedTopic || undefined,
        sourceContent,
        ageGroup: selectedBookType === 'story' ? workbookAgeGroupForSelectedLevel : selectedAgeGroup,
        bookType: selectedBookType,
        subGenre: effectiveSubGenre || undefined,
        targetPageCount: targetPageCountPreview,
        creativeBrief,
        allowAiBookTitleGeneration,
        heroPortraitName: selectedHeroPortraitFile ? selectedHeroPortraitName : undefined,
        heroPortraitImage: selectedHeroPortraitFile
          ? {
              base64: await readFileAsBase64(selectedHeroPortraitFile),
              mimeType: selectedHeroPortraitFile.type || 'image/png',
              fileName: selectedHeroPortraitFile.name || 'hero-portrait.png',
              sizeBytes: selectedHeroPortraitFile.size
            }
          : undefined
      });

      writePendingBookGenerationJob({
        jobId: jobState.jobId,
        bookType: selectedBookType,
        language: generationLanguage,
        topic: normalizedTopic || undefined,
        startedAt: new Date().toISOString()
      });

      syncGenerationUiFromJob(jobState, selectedBookType);

      if (jobState.status === 'failed') {
        throw new Error(jobState.error || 'Fortale oluşturulurken bir hata oluştu.');
      }

      if (jobState.status === 'completed' && jobState.course) {
        await completeGeneratedBook(jobState.course);
        return;
      }

      startBookGenerationPolling(jobState.jobId, selectedBookType);
    } catch (error) {
      console.error('Book generation failed', error);
      failGenerationJob(getUserFacingError(error, 'Fortale oluşturulurken bir hata oluştu.'));
    }
  };

  const renderStickyCard = (note: StickyNoteData, fullWidth = false) => {
    const tint = stickyTintById.get(note.id) || stickyTintPalette[0];
    return (
      <button
        key={note.id}
        onClick={() => openStickyModal(note)}
        className={`${fullWidth ? 'w-full' : 'shrink-0'} min-h-[58px] rounded-xl border px-3 py-2 text-left transition-colors hover:border-white/60`}
        style={fullWidth
          ? { backgroundColor: tint.bg, borderColor: tint.border }
          : {
            flex: '0 0 clamp(128px, 30vw, 220px)',
            backgroundColor: tint.bg,
            borderColor: tint.border
          }}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[12px] font-semibold text-white truncate">
            {note.title || t('Yapışkan Not')}
          </span>
          <StickyNote size={12} className="text-white shrink-0" />
        </div>
        <p className={`text-[11px] text-white ${fullWidth ? 'line-clamp-2' : 'truncate'}`}>
          {note.text || t('Boş not')}
        </p>
        {fullWidth && (
          <span className="mt-2 block text-[10px] text-white text-right">
            {formatStickyDate(note.lastActivity, locale)}
          </span>
        )}
      </button>
    );
  };

  const renderHomeCourseCard = (course: CourseData) => {
    const displayCoverImageUrl = course.deviceCoverImageUrl || course.coverImageUrl;
    const openState = courseOpenStates[course.id] || { status: 'idle', progress: 0, updatedAt: 0 };
    const isOpenDownloading = openState.status === 'downloading';
    const openProgress = Math.max(0, Math.min(100, Math.round(openState.progress || 0)));
    const cardDescription = course.description?.trim() || deriveSmartBookDescription(
      course.topic,
      course.nodes,
      course.bookType || 'novel',
      course.subGenre
    );

    return (
      <article key={course.id} className="fortale-book-list-item fortale-home-list-card">
        <button type="button" onClick={() => setSelectedHomeCourse(course)} className="fortale-book-list-cover" aria-label={course.topic}>
          <span className="fortale-book-list-cover-media">
            {displayCoverImageUrl ? (
              <img src={displayCoverImageUrl} alt={`${course.topic} ${t('Fortale kapağı')}`} className="h-full w-full object-cover object-center" />
            ) : (
              <div className="fortale-shelf-cover-empty"><BookOpen size={24} /></div>
            )}
            {isOpenDownloading && (
              <span className="fortale-shelf-download-overlay">
                <span className="fortale-shelf-download-bar"><span style={{ width: `${openProgress}%` }} /></span>
              </span>
            )}
          </span>
        </button>
        <div className="fortale-book-list-info">
          <button type="button" onClick={() => setSelectedHomeCourse(course)} className="fortale-book-list-title !mt-0">{course.topic}</button>
          <button type="button" onClick={() => setSelectedHomeCourse(course)} className="fortale-book-list-description w-full text-left">{cardDescription}</button>
        </div>
      </article>
    );
  };

  const renderHomeCommunityCard = (book: CommunityBook) => {
    const cardDescription = String(book.description || '').trim()
      || String(book.preview?.[0]?.content || '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/^#{1,6}\s+.+$/gm, ' ')
        .replace(/[*_`>#-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      || (book.outline || []).filter(Boolean).slice(0, 3).join(' · ');
    return (
    <article key={book.id} className="fortale-book-list-item fortale-home-list-card">
      <button type="button" onClick={() => void openHomeCommunityBook(book)} className="fortale-book-list-cover" aria-label={book.title}>
        <span className="fortale-book-list-cover-media">
          {book.coverImageUrl ? <img src={book.coverImageUrl} alt={book.title} loading="lazy" /> : <span className="fortale-home-rail-cover-empty"><BookOpen size={22} /></span>}
        </span>
      </button>
      <div className="fortale-book-list-info">
        <button type="button" onClick={() => void openHomeCommunityBook(book)} className="fortale-book-list-title !mt-0">{book.title}</button>
        <button type="button" onClick={() => void openHomeCommunityBook(book)} className="fortale-book-list-description w-full text-left">{cardDescription}</button>
        <div className="fortale-book-list-stats">
          <span title={t('Kalp')}><Heart size={12} /> {book.likeCount || 0}</span>
          <span title={t('İndirilme')}><Download size={12} /> {book.downloadCount || 0}</span>
        </div>
      </div>
    </article>
    );
  };

  const hasStickyContent = Boolean(stickyModal.title.trim() || stickyModal.text.trim());
  const isCreationIntroOnly = !isCreationWizardOpen && !isGenerating;
  const themeStep = 3;
  const ageGroupStep = 4;
  const storyModeStep = 5;
  const optionalBookDetailsStep = 6;
  const premiseStep = 7;
  const portraitStep = 8;
  const summaryStep = 9;
  const visibleCreationSteps = useMemo<number[]>(
    () => selectedBookType === 'story'
      ? [1, premiseStep, ageGroupStep, 2, themeStep, summaryStep]
      : selectedBookType === 'fairy_tale'
        ? [1, 2, 3, 5, 6, 7, 8, 9]
        : [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [selectedBookType]
  );
  const currentVisibleStepIndexRaw = visibleCreationSteps.indexOf(creationStep);
  const currentVisibleStepIndex = currentVisibleStepIndexRaw >= 0 ? currentVisibleStepIndexRaw : 0;
  const currentVisibleStepNumber = currentVisibleStepIndex + 1;
  const totalVisibleStepCount = Math.max(1, visibleCreationSteps.length);

  useLayoutEffect(() => {
    if (!isCreationIntroOnly || typeof document === 'undefined') {
      setHomeCreateDockBounds(null);
      return;
    }

    let frame = 0;
    const syncDockBounds = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const railStack = homeRailStackRef.current;
        const floatIsland = document.querySelector<HTMLElement>('.floatisland-nav');
        if (!railStack || !floatIsland) return;
        const top = Math.ceil(railStack.getBoundingClientRect().bottom);
        const bottom = Math.floor(floatIsland.getBoundingClientRect().top);
        const height = Math.max(202, bottom - top);
        setHomeCreateDockBounds((current) => current?.top === top && current.height === height ? current : { top, height });
      });
    };

    syncDockBounds();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncDockBounds) : null;
    if (homeRailStackRef.current) resizeObserver?.observe(homeRailStackRef.current);
    const floatIsland = document.querySelector<HTMLElement>('.floatisland-nav');
    if (floatIsland) resizeObserver?.observe(floatIsland);
    window.addEventListener('resize', syncDockBounds);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncDockBounds);
    };
  }, [homeCommunityBooks.length, isCreationIntroOnly]);

  useEffect(() => {
    if (currentVisibleStepIndexRaw !== -1) return;
    const nextVisibleStep = visibleCreationSteps.find((step) => step > creationStep);
    const previousVisibleStep = [...visibleCreationSteps].reverse().find((step) => step < creationStep);
    setCreationStep(nextVisibleStep ?? previousVisibleStep ?? visibleCreationSteps[0] ?? 1);
  }, [creationStep, currentVisibleStepIndexRaw, visibleCreationSteps]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const keepFocusedWizardInputVisible = () => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return;
      if (!activeElement.classList.contains('fortale-wizard-keyboard-input')) return;
      window.setTimeout(() => {
        activeElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }, 80);
    };

    window.addEventListener('focusin', keepFocusedWizardInputVisible);
    window.visualViewport?.addEventListener('resize', keepFocusedWizardInputVisible);
    window.visualViewport?.addEventListener('scroll', keepFocusedWizardInputVisible);

    return () => {
      window.removeEventListener('focusin', keepFocusedWizardInputVisible);
      window.visualViewport?.removeEventListener('resize', keepFocusedWizardInputVisible);
      window.visualViewport?.removeEventListener('scroll', keepFocusedWizardInputVisible);
    };
  }, []);


  const isCreationStepComplete = (step: number): boolean => {
    if (step === 1) return Boolean(selectedBookType);
    if (selectedBookType === 'story') {
      if (step === premiseStep) return Boolean(selectedStoryPremise.trim());
      if (step === ageGroupStep) return Boolean(selectedWorkbookLevel);
      if (step === 2) return Boolean(effectiveSubGenre);
      if (step === themeStep) return true;
      if (step === summaryStep) return true;
    }
    if (step === 2) return Boolean(effectiveSubGenre);
    if (step === themeStep) return Boolean(effectiveTheme);
    if (step === ageGroupStep) return Boolean(selectedAgeGroup);
    if (step === storyModeStep) {
      const companionNameCount = companionHeroes
        .slice(0, Math.max(0, heroCount - 1))
        .filter((hero) => Boolean(hero.name.trim())).length;
      return Boolean(heroPortraitName.trim()) && Boolean(heroAgeInput.trim()) && companionNameCount === Math.max(0, heroCount - 1);
    }
    if (step === optionalBookDetailsStep) {
      return Boolean(settingTimeChoice) &&
        Boolean(settingPlaceChoice) &&
        Boolean(worldTypeChoice) &&
        (settingTimeChoice !== 'custom' || Boolean(settingTimeInput.trim())) &&
        (settingPlaceChoice !== 'custom' || Boolean(settingPlaceInput.trim())) &&
        (worldTypeChoice !== 'custom' || Boolean(worldTypeInput.trim()));
    }
    if (step === premiseStep) return Boolean(selectedStoryPremise.trim());
    if (step === portraitStep) {
      return (
        !heroPortraitFile ||
        Boolean(selectedPortraitHeroTarget.trim())
      );
    }
    if (step === summaryStep) return true;
    return false;
  };
  const getNextCreationStep = (step: number): number => {
    const index = visibleCreationSteps.indexOf(step);
    if (index === -1) return visibleCreationSteps[0] ?? 1;
    return visibleCreationSteps[Math.min(visibleCreationSteps.length - 1, index + 1)] ?? step;
  };
  const getPreviousCreationStep = (step: number): number => {
    const index = visibleCreationSteps.indexOf(step);
    if (index === -1) return visibleCreationSteps[0] ?? 1;
    return visibleCreationSteps[Math.max(0, index - 1)] ?? step;
  };
  const isCurrentStepComplete = isCreationStepComplete(creationStep);
  const isAllStepsComplete = visibleCreationSteps.every((step) => isCreationStepComplete(step));
  const selectedBookTypeLabel = HOME_SPLIT_BOOK_TYPES.find((option) => option.value === selectedBookType)?.label || 'Kitap';
  const currentStepBaseTitle = (() => {
    if (creationStep === 1) return t('Kitap Türü');
    if (selectedBookType === 'story' && creationStep === premiseStep) return t('Konu');
    if (selectedBookType === 'story' && creationStep === ageGroupStep) return t('Seviye');
    if (selectedBookType === 'story' && creationStep === 2) return t('Çalışma Kitabı Türü');
    if (selectedBookType === 'story' && creationStep === themeStep) return t('Ek İçerikler');
    if (creationStep === 2) return t('Alt Tür');
    if (creationStep === themeStep) return t('Tema');
    if (creationStep === ageGroupStep) return t('Yaş Grubu');
    if (creationStep === storyModeStep) return t('Kahramanlar');
    if (creationStep === optionalBookDetailsStep) return t('Evren');
    if (creationStep === premiseStep) return t('Hikaye Çekirdeği');
    if (creationStep === portraitStep) return t('Kahraman Portresi');
    if (creationStep === summaryStep) return t('Genel Bakış');
    return t('Kitap Bilgileri');
  })();
  const currentStepTitle = isCreationWizardOpen
    ? `${t(selectedBookTypeLabel)} / ${currentStepBaseTitle}`
    : currentStepBaseTitle;
  const canMoveNext = currentVisibleStepIndex < totalVisibleStepCount - 1 && isCurrentStepComplete && !isGenerating;
  const canCreateOnFinalStep = currentVisibleStepIndex === totalVisibleStepCount - 1 && isAllStepsComplete && !isGenerating;
  const translateTemplate = (template: string, values: Record<string, string | number>): string => (
    Object.entries(values).reduce(
      (message, [key, value]) => message.split(`{{${key}}}`).join(String(value)),
      t(template)
    )
  );
  const trimmedSettingTime = settingTimeLabel ? compactInlineText(settingTimeLabel) : '';
  const trimmedSettingPlace = settingPlaceLabel ? compactInlineText(settingPlaceLabel) : '';
  const trimmedHeroPortraitName = compactInlineText(heroPortraitName);
  const trimmedHeroAge = compactInlineText(heroAgeInput);
  const heroGenderLabel = heroGender ? HERO_GENDER_OPTIONS.find((option) => option.value === heroGender)?.label : undefined;
  const companionHeroSummary = companionHeroes
    .slice(0, Math.max(0, heroCount - 1))
    .map((hero) => {
      const name = compactInlineText(hero.name);
      const genderLabel = hero.gender ? HERO_GENDER_OPTIONS.find((option) => option.value === hero.gender)?.label : undefined;
      return name ? `${name}${genderLabel ? ` (${t(genderLabel)})` : ''}` : '';
    })
    .filter(Boolean)
    .join(', ');
  const workbookExtraSummary = [
    includeWorkbookExamples ? t('Örnekler') : undefined,
    includeWorkbookQuiz ? t('Quiz') : undefined,
    includeWorkbookRelatedBooks ? t('İlgili Kitaplar') : undefined
  ].filter(Boolean).join(', ') || t('Seçilmedi');
  const bookOverviewRows = selectedBookType === 'story'
    ? [
      { label: t('Kitap Türü'), value: t(bookTypeToLabel(selectedBookType)) },
      { label: t('Konu'), value: selectedStoryPremise || t('Belirtilmedi') },
      { label: t('Seviye'), value: selectedWorkbookLevel ? t(selectedWorkbookLevel) : t('Belirtilmedi') },
      { label: t('Çalışma Kitabı Türü'), value: effectiveSubGenre ? t(effectiveSubGenre) : t('Belirtilmedi') },
      { label: t('Ek İçerikler'), value: workbookExtraSummary }
    ]
    : [
      { label: t('Kitap Türü'), value: t(bookTypeToLabel(selectedBookType)) },
      { label: t('Alt Tür'), value: effectiveSubGenre ? t(effectiveSubGenre) : t('Belirtilmedi') },
      { label: t('Tema'), value: effectiveTheme ? t(effectiveTheme) : t('Belirtilmedi') },
      ...(selectedBookType !== 'fairy_tale' ? [{ label: t('Yaş Grubu'), value: t(getSmartBookAgeGroupLabel(selectedAgeGroup)) }] : []),
      { label: t('Ana Kahraman'), value: trimmedHeroPortraitName || t('Belirtilmedi') },
      { label: t('Yaş'), value: trimmedHeroAge || t('Belirtilmedi') },
      ...(heroGenderLabel ? [{ label: t('Cinsiyet'), value: t(heroGenderLabel) }] : []),
      ...(companionHeroSummary ? [{ label: t('Diğer Kahramanlar'), value: companionHeroSummary }] : []),
      ...(trimmedSettingTime ? [{ label: t('Hikayenin Zamanı'), value: trimmedSettingTime }] : []),
      ...(trimmedSettingPlace ? [{ label: t('Hikayenin Yeri'), value: trimmedSettingPlace }] : []),
      ...(worldTypeLabel ? [{ label: t('Dünya Tipi'), value: t(worldTypeLabel) }] : []),
      ...(selectedStoryPremise ? [{ label: t('Hikaye Çekirdeği'), value: selectedStoryPremise }] : []),
      {
        label: t('Portre'),
        value: heroPortraitFile
          ? (selectedPortraitHeroTarget || t('Portre eklendi'))
          : t('Portre eklenmedi')
      }
    ];
  const createCreditUseSentence = translateTemplate(
    'Bu işlem için {{creditCount}} kredi kullanılacaktır.',
    { creditCount: selectedCreateCreditCost }
  );
  const WIZARD_FIELD_HEIGHT_PX = 54;
  const wizardFieldClass = 'fortale-wizard-glass-control fortale-wizard-field fortale-wizard-keyboard-input mt-1 w-full px-3 text-[13px] text-white placeholder:text-white focus:outline-none';
  const wizardFieldStyle = (options: { fixedHeight?: boolean } = {}): React.CSSProperties => ({
    boxSizing: 'border-box',
    ...(options.fixedHeight === false
      ? {}
      : {
        height: WIZARD_FIELD_HEIGHT_PX,
        minHeight: WIZARD_FIELD_HEIGHT_PX,
        maxHeight: WIZARD_FIELD_HEIGHT_PX,
        lineHeight: '1'
      })
  });
  const wizardTextareaClass = 'fortale-wizard-glass-control fortale-wizard-keyboard-input mt-1 w-full px-3 py-3 text-[13px] text-white placeholder:text-white resize-none focus:outline-none';
  const selectedBookTypeOptionStyle = selectedBookType === 'fairy_tale'
    ? {
      borderColor: 'rgba(255,255,255,0.72)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(220,236,255,0.9))',
      color: '#000000',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72), 0 8px 18px rgba(220,236,255,0.16)'
    }
    : selectedBookType === 'novel'
    ? {
      borderColor: 'rgba(255,82,92,0.78)',
      background: 'linear-gradient(135deg, rgba(239,35,47,0.98), rgba(185,18,32,0.94))',
      color: '#ffffff',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24), 0 8px 18px rgba(220,24,39,0.22)'
    }
    : {
      borderColor: 'rgba(255,238,140,0.72)',
      background: 'linear-gradient(135deg, rgba(255,236,120,0.96), rgba(250,204,21,0.9))',
      color: '#000000',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 18px rgba(250,204,21,0.16)'
    };
  const wizardOptionButtonStyle = (isSelected: boolean): React.CSSProperties => ({
    borderColor: isSelected ? selectedBookTypeOptionStyle.borderColor : 'rgba(244, 248, 244, 0.68)',
    background: isSelected ? selectedBookTypeOptionStyle.background : 'rgba(196, 204, 198, 0.42)',
    color: isSelected ? selectedBookTypeOptionStyle.color : '#ffffff',
    WebkitTextFillColor: isSelected ? selectedBookTypeOptionStyle.color : '#ffffff',
    fontWeight: 400,
    opacity: 1,
    minHeight: 46,
    boxShadow: isSelected ? selectedBookTypeOptionStyle.boxShadow : undefined
  });
  const wizardChoiceButtonClass = 'rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition-all active:scale-[0.98]';
  const primaryActionButtonStyle: React.CSSProperties = selectedBookType === 'fairy_tale'
    ? {
      background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(220,236,255,0.94))',
      color: '#000000',
      borderColor: 'rgba(255,255,255,0.76)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 24px rgba(220,236,255,0.22)'
    }
    : selectedBookType === 'novel'
    ? {
      background: 'linear-gradient(135deg, rgba(239,35,47,0.98), rgba(185,18,32,0.94))',
      color: '#ffffff',
      borderColor: 'rgba(255,82,92,0.82)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 10px 24px rgba(220,24,39,0.28)'
    }
    : {
      background: 'linear-gradient(135deg, rgba(255,236,120,0.98), rgba(250,204,21,0.94))',
      color: '#000000',
      borderColor: 'rgba(255,238,140,0.78)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 24px rgba(250,204,21,0.2)'
    };
  const genderPickerOptions = [{ value: '' as WizardHeroGender, label: 'Seçilmedi' }, ...HERO_GENDER_OPTIONS];
  const renderGenderPicker = (
    value: WizardHeroGender,
    onSelect: (nextValue: WizardHeroGender) => void
  ) => (
    <FortaleDropdown
      label={t('Cinsiyet')}
      value={value}
      options={genderPickerOptions.map((option) => ({ ...option, label: t(option.label) }))}
      onChange={onSelect}
      className="w-full"
      triggerClassName="fortale-wizard-glass-control fortale-hero-paired-control !px-3 !text-[13px] !font-normal"
      wizardStyle
    />
  );
  const renderHeroPortraitPanel = () => (
    <div className="space-y-3">
      {/* Feature card */}
      <div className="relative overflow-hidden rounded-[22px]" style={{ background: 'linear-gradient(145deg, #0e2d55 0%, #091c38 100%)', border: '1px solid rgba(155, 199, 255, 0.22)' }}>
        {/* Decorative glow blob */}
        <div aria-hidden style={{ position: 'absolute', top: -24, right: -24, width: 140, height: 140, borderRadius: '50%', background: 'rgba(100, 160, 255, 0.11)', filter: 'blur(36px)', pointerEvents: 'none' }} />

        <div className="relative px-4 pt-5 pb-4">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-[46px] w-[46px] shrink-0 rounded-[14px] flex items-center justify-center" style={{ background: 'rgba(100, 160, 255, 0.16)', border: '1px solid rgba(155, 199, 255, 0.26)' }}>
              <UserRound size={21} style={{ color: '#9BC7FF' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold leading-tight text-white">{t('Kitabın Kahramanı Sen Ol')}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'rgba(155, 199, 255, 0.55)' }}>{t('İsteğe bağlıdır · +1 kredi')}</p>
            </div>
          </div>

          {/* Benefit */}
          <div className="mb-4">
            <div className="flex items-start gap-2">
              <span className="mt-[3px] shrink-0 text-[9px]" style={{ color: 'rgba(155, 199, 255, 0.45)' }}>✦</span>
              <p className="text-[12px] leading-snug" style={{ color: 'rgba(190, 220, 255, 0.76)' }}>{t('Kendi fotoğrafını yükle — kitaptaki kahraman her sayfada sana benzsin')}</p>
            </div>
          </div>

          {/* Portrait preview or upload CTA */}
          {heroPortraitFile && heroPortraitPreviewUrl ? (
            <div>
              <div className="relative overflow-hidden rounded-[18px]" style={{ aspectRatio: '1 / 1', border: '1px solid rgba(155, 199, 255, 0.2)' }}>
                <img
                  src={heroPortraitPreviewUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                />
                <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, rgba(5, 15, 30, 0.72) 100%)' }} />
                {/* Overlay controls */}
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-3 pb-3">
                  <p className="truncate text-[12px] font-bold text-white">
                    {selectedPortraitHeroTarget || t('Portre eklendi')}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => heroPortraitInputRef.current?.click()}
                      className="h-8 rounded-[12px] px-3 text-[11px] font-semibold inline-flex items-center gap-1"
                      style={{ background: 'rgba(8, 25, 52, 0.84)', border: '1px solid rgba(139, 187, 244, 0.36)', color: '#ffffff' }}
                    >
                      {t('Değiştir')}
                    </button>
                    <button
                      type="button"
                      onClick={clearHeroPortrait}
                      className="h-8 w-8 rounded-[12px] inline-flex items-center justify-center"
                      style={{ background: 'rgba(8, 25, 52, 0.84)', border: '1px solid rgba(135, 164, 197, 0.26)', color: '#ffffff' }}
                      aria-label={t('Portreyi kaldır')}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => heroPortraitInputRef.current?.click()}
              className="w-full rounded-[18px] border px-4 py-4 text-[14px] font-normal inline-flex items-center justify-center gap-2.5"
              style={{ background: 'rgba(14, 45, 90, 0.7)', borderColor: 'rgba(155, 199, 255, 0.32)', borderStyle: 'dashed', color: '#ffffff' }}
            >
              <ImagePlus size={18} />
              {t('Fotoğraf Seç')}
            </button>
          )}
        </div>
      </div>

      {/* Hero assignment — only when portrait is added */}
      {heroPortraitFile && portraitHeroOptions.length > 0 && (
        <div className="rounded-[22px] border p-3" style={{ borderColor: 'rgba(190, 220, 255, 0.16)', background: 'rgba(8, 36, 70, 0.46)' }}>
          <p className="fortale-section-kicker mb-3">{t('Portre hangi kahramana ait?')}</p>
          <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
            {portraitHeroOptions.map((name) => {
              const isSelected = selectedPortraitHeroTarget === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedPortraitHeroName(name)}
                  className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                  style={wizardOptionButtonStyle(isSelected)}
                  aria-pressed={isSelected}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
  const wizardThemeVars = {} as React.CSSProperties;
  const wizardAccentColor = (activeGeneratingBookType ?? selectedBookType) === 'fairy_tale'
    ? 'linear-gradient(90deg, rgba(255,255,255,0.98), rgba(220,236,255,0.94))'
    : (activeGeneratingBookType ?? selectedBookType) === 'novel'
    ? 'linear-gradient(90deg, rgba(239,35,47,0.98), rgba(185,18,32,0.94))'
    : 'linear-gradient(90deg, rgba(255,236,120,0.98), rgba(250,204,21,0.94))';
  const showStickyNotes = false;
  const stickyModalTop =
    stickyRowContainerRef.current
      ? `${Math.round(stickyRowContainerRef.current.getBoundingClientRect().bottom)}px`
      : STICKY_MODAL_TOP_INSET;

  const homeStars = useMemo(() => [
    { x: 7,  y: 9,  s: 1.4, dur: 2.8, delay: 0.0, lo: 0.10, hi: 0.84 },
    { x: 17, y: 24, s: 1.0, dur: 3.5, delay: 0.6, lo: 0.08, hi: 0.68 },
    { x: 31, y: 7,  s: 1.9, dur: 2.2, delay: 1.1, lo: 0.14, hi: 0.94 },
    { x: 44, y: 20, s: 1.2, dur: 3.9, delay: 0.3, lo: 0.09, hi: 0.76 },
    { x: 57, y: 5,  s: 2.0, dur: 2.6, delay: 0.9, lo: 0.16, hi: 0.96 },
    { x: 69, y: 17, s: 1.1, dur: 4.1, delay: 0.2, lo: 0.08, hi: 0.64 },
    { x: 81, y: 29, s: 2.3, dur: 3.0, delay: 1.4, lo: 0.18, hi: 1.00 },
    { x: 92, y: 9,  s: 1.3, dur: 2.9, delay: 0.7, lo: 0.10, hi: 0.80 },
    { x: 13, y: 52, s: 1.1, dur: 3.7, delay: 0.4, lo: 0.08, hi: 0.70 },
    { x: 25, y: 40, s: 1.7, dur: 2.4, delay: 1.2, lo: 0.12, hi: 0.88 },
    { x: 37, y: 66, s: 1.0, dur: 4.3, delay: 0.1, lo: 0.07, hi: 0.60 },
    { x: 51, y: 46, s: 2.5, dur: 2.7, delay: 0.8, lo: 0.20, hi: 1.00 },
    { x: 63, y: 71, s: 1.2, dur: 3.2, delay: 1.5, lo: 0.10, hi: 0.74 },
    { x: 75, y: 56, s: 1.6, dur: 2.1, delay: 0.5, lo: 0.13, hi: 0.90 },
    { x: 87, y: 42, s: 1.0, dur: 4.0, delay: 1.0, lo: 0.08, hi: 0.66 },
    { x: 4,  y: 78, s: 1.8, dur: 2.5, delay: 0.3, lo: 0.14, hi: 0.86 },
    { x: 21, y: 83, s: 1.3, dur: 4.1, delay: 0.6, lo: 0.10, hi: 0.72 },
    { x: 39, y: 88, s: 2.0, dur: 3.3, delay: 1.3, lo: 0.16, hi: 0.92 },
    { x: 54, y: 76, s: 1.1, dur: 2.8, delay: 0.2, lo: 0.09, hi: 0.64 },
    { x: 67, y: 86, s: 1.5, dur: 3.6, delay: 0.9, lo: 0.12, hi: 0.80 },
    { x: 79, y: 73, s: 1.9, dur: 2.3, delay: 1.6, lo: 0.18, hi: 0.96 },
    { x: 94, y: 60, s: 1.2, dur: 4.2, delay: 0.4, lo: 0.10, hi: 0.70 },
    { x: 9,  y: 36, s: 2.6, dur: 3.1, delay: 0.7, lo: 0.22, hi: 1.00 },
    { x: 47, y: 33, s: 1.0, dur: 2.6, delay: 1.1, lo: 0.08, hi: 0.62 },
    { x: 72, y: 38, s: 1.4, dur: 3.5, delay: 0.5, lo: 0.11, hi: 0.78 },
    { x: 28, y: 15, s: 1.6, dur: 3.2, delay: 0.4, lo: 0.12, hi: 0.86 },
    { x: 60, y: 92, s: 1.1, dur: 4.4, delay: 1.7, lo: 0.08, hi: 0.64 },
    { x: 83, y: 14, s: 2.1, dur: 2.3, delay: 0.8, lo: 0.17, hi: 0.98 },
    { x: 15, y: 68, s: 1.3, dur: 3.8, delay: 1.3, lo: 0.10, hi: 0.74 },
    { x: 42, y: 57, s: 1.8, dur: 2.7, delay: 0.0, lo: 0.14, hi: 0.90 },
    { x: 58, y: 23, s: 1.0, dur: 4.6, delay: 2.0, lo: 0.07, hi: 0.60 },
    { x: 77, y: 80, s: 2.4, dur: 3.0, delay: 0.6, lo: 0.19, hi: 1.00 },
    { x: 96, y: 45, s: 1.2, dur: 3.7, delay: 1.5, lo: 0.09, hi: 0.70 },
  ], []);

  const homeDust = useMemo(() => [
    { x: 14, y: 58, s: 3.4, dur: 4.2, delay: 0.0, op: 0.62 },
    { x: 27, y: 73, s: 4.0, dur: 5.1, delay: 1.0, op: 0.56 },
    { x: 41, y: 48, s: 3.0, dur: 3.8, delay: 1.8, op: 0.70 },
    { x: 57, y: 80, s: 4.5, dur: 4.7, delay: 0.5, op: 0.58 },
    { x: 69, y: 63, s: 3.2, dur: 5.4, delay: 2.1, op: 0.54 },
    { x: 82, y: 44, s: 4.0, dur: 4.0, delay: 1.3, op: 0.66 },
    { x: 6,  y: 38, s: 3.8, dur: 4.8, delay: 0.8, op: 0.60 },
    { x: 91, y: 76, s: 3.5, dur: 3.6, delay: 2.4, op: 0.68 },
    { x: 35, y: 18, s: 2.8, dur: 5.0, delay: 0.3, op: 0.50 },
    { x: 61, y: 28, s: 3.2, dur: 4.4, delay: 1.6, op: 0.61 },
    // 2. set
    { x: 8,  y: 92, s: 3.6, dur: 4.6, delay: 0.4, op: 0.64 },
    { x: 20, y: 15, s: 2.6, dur: 5.2, delay: 1.2, op: 0.52 },
    { x: 33, y: 67, s: 4.2, dur: 3.9, delay: 2.3, op: 0.68 },
    { x: 48, y: 35, s: 3.0, dur: 4.9, delay: 0.7, op: 0.57 },
    { x: 53, y: 55, s: 4.8, dur: 4.3, delay: 1.5, op: 0.72 },
    { x: 74, y: 22, s: 3.4, dur: 5.6, delay: 0.2, op: 0.55 },
    { x: 85, y: 84, s: 3.8, dur: 4.1, delay: 2.0, op: 0.63 },
    { x: 97, y: 51, s: 2.9, dur: 3.7, delay: 0.9, op: 0.59 },
    { x: 18, y: 42, s: 4.1, dur: 5.3, delay: 1.7, op: 0.66 },
    { x: 44, y: 89, s: 3.3, dur: 4.0, delay: 0.6, op: 0.60 },
    // 3. set
    { x: 3,  y: 62, s: 3.7, dur: 4.5, delay: 1.1, op: 0.58 },
    { x: 16, y: 30, s: 2.7, dur: 5.8, delay: 0.0, op: 0.54 },
    { x: 29, y: 77, s: 4.3, dur: 3.6, delay: 2.5, op: 0.70 },
    { x: 38, y: 12, s: 3.1, dur: 4.7, delay: 1.4, op: 0.56 },
    { x: 50, y: 70, s: 4.6, dur: 5.0, delay: 0.3, op: 0.65 },
    { x: 65, y: 40, s: 3.0, dur: 4.2, delay: 1.9, op: 0.61 },
    { x: 78, y: 58, s: 3.9, dur: 3.8, delay: 0.5, op: 0.67 },
    { x: 88, y: 33, s: 2.8, dur: 5.5, delay: 2.2, op: 0.53 },
    { x: 22, y: 95, s: 4.4, dur: 4.4, delay: 0.8, op: 0.69 },
    { x: 72, y: 88, s: 3.2, dur: 4.8, delay: 1.3, op: 0.62 },
    // 4. set (toplam 50)
    { x: 11, y: 47, s: 3.6, dur: 4.3, delay: 0.2, op: 0.64 },
    { x: 24, y: 8,  s: 2.9, dur: 5.7, delay: 1.9, op: 0.51 },
    { x: 36, y: 59, s: 4.1, dur: 3.5, delay: 0.6, op: 0.67 },
    { x: 46, y: 24, s: 3.3, dur: 4.9, delay: 2.2, op: 0.58 },
    { x: 59, y: 91, s: 4.7, dur: 4.0, delay: 1.0, op: 0.71 },
    { x: 71, y: 16, s: 3.0, dur: 5.3, delay: 0.4, op: 0.54 },
    { x: 80, y: 68, s: 3.9, dur: 4.6, delay: 1.7, op: 0.63 },
    { x: 93, y: 37, s: 2.7, dur: 3.9, delay: 0.1, op: 0.57 },
    { x: 2,  y: 82, s: 4.3, dur: 5.1, delay: 2.6, op: 0.65 },
    { x: 55, y: 6,  s: 3.5, dur: 4.2, delay: 1.4, op: 0.60 },
    { x: 43, y: 43, s: 2.8, dur: 5.6, delay: 0.7, op: 0.53 },
    { x: 66, y: 97, s: 4.0, dur: 3.7, delay: 2.0, op: 0.68 },
    { x: 77, y: 54, s: 3.2, dur: 4.5, delay: 0.9, op: 0.61 },
    { x: 89, y: 20, s: 3.7, dur: 5.0, delay: 1.5, op: 0.56 },
    { x: 31, y: 85, s: 4.5, dur: 3.8, delay: 2.3, op: 0.70 },
    { x: 10, y: 25, s: 3.0, dur: 4.7, delay: 0.3, op: 0.55 },
    { x: 52, y: 72, s: 3.8, dur: 5.2, delay: 1.1, op: 0.64 },
    { x: 84, y: 8,  s: 2.6, dur: 4.1, delay: 2.8, op: 0.50 },
    { x: 19, y: 53, s: 4.2, dur: 3.6, delay: 0.5, op: 0.66 },
    { x: 63, y: 38, s: 3.4, dur: 4.8, delay: 1.8, op: 0.59 },
  ], []);

  return (
    <div className={`view-container fortale-home-view ${isCreationIntroOnly ? 'is-intro' : ''}`}>
      {/* Yıldız ve peri tozu — header altından tüm sayfayı kaplar */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
        {homeStars.map((star, idx) => (
          <span
            key={`hs-${idx}`}
            className="home-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.s}px`,
              height: `${star.s}px`,
              ['--star-dur' as string]: `${star.dur}s`,
              ['--star-delay' as string]: `${star.delay}s`,
              ['--star-lo' as string]: `${star.lo}`,
              ['--star-hi' as string]: `${star.hi}`,
            } as React.CSSProperties}
          />
        ))}
        {homeDust.map((dust, idx) => (
          <span
            key={`hd-${idx}`}
            className="home-fairy-dust"
            style={{
              left: `${dust.x}%`,
              top: `${dust.y}%`,
              width: `${dust.s}px`,
              height: `${dust.s}px`,
              ['--dust-dur' as string]: `${dust.dur}s`,
              ['--dust-delay' as string]: `${dust.delay}s`,
              ['--dust-op' as string]: `${dust.op}`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="app-content-width fortale-home-content space-y-4">
        {showStickyNotes && (
          <section ref={stickyRowContainerRef} className="relative">
            {isStickyRowExpanded && (
              <div
                className="absolute left-0 right-0 top-full z-30 rounded-2xl border border-zinc-500/45 p-2 shadow-[0_20px_30px_-24px_rgba(0,0,0,0.75)]"
                style={{ background: 'rgba(17, 22, 29, 0.94)' }}
              >
                <div className="max-h-[58vh] overflow-y-auto hide-scrollbar space-y-2">
                  {sortedStickyNotes.length === 0 ? (
                    <div className="text-[11px] text-white px-2 py-1">{t('Henüz yapışkan not yok.')}</div>
                  ) : (
                    sortedStickyNotes.map((note) => renderStickyCard(note, true))
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto overflow-y-hidden pb-1 hide-scrollbar">
              <div className="flex items-stretch gap-2 min-w-full">
                <div
                  className="shrink-0 min-h-[58px] rounded-xl border border-zinc-500/65 bg-white/[0.04] overflow-hidden flex"
                  style={{ flex: '0 0 clamp(128px, 30vw, 220px)' }}
                >
                  <button
                    onClick={() => setIsStickyRowExpanded((prev) => !prev)}
                    className={`flex-1 border-r transition-colors flex items-center justify-center ${isStickyRowExpanded
                      ? 'border-[#6287b3]/60 bg-[#1d3855]/22 text-white'
                      : 'border-[#5a7aa0]/45 text-white hover:bg-[#1d3855]/16'
                      }`}
                    title={isStickyRowExpanded ? t('Kapat') : t('Genişlet')}
                    aria-label={isStickyRowExpanded ? t('Kapat') : t('Genişlet')}
                  >
                    <ChevronDown size={16} className={isStickyRowExpanded ? 'rotate-180' : ''} />
                  </button>
                  <button
                    onClick={() => openStickyModal()}
                    className="flex-[1.6] text-accent-green hover:bg-accent-green/10 transition-colors flex items-center justify-center"
                    title={t('Yapışkan not ekle')}
                    aria-label={t('Yapışkan not ekle')}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {sortedStickyNotes.map((note) => renderStickyCard(note))}
              </div>
            </div>
          </section>
        )}

        {isCreationIntroOnly && (
          <div ref={homeRailStackRef} className="fortale-home-rail-stack">
            <section className="fortale-home-book-rail is-library-rail" aria-label={t('Son Kitaplarım')} style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
              <h2 className="fortale-home-rail-label" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{t('Son Kitaplarım')}</h2>
              <div ref={homeShelfScrollRef} className="fortale-home-rail-scroll touch-scroll-x" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
                {homeShelfCourses.length > 0
                  ? homeShelfCourses.map((course) => renderHomeCourseCard(course))
                  : isBootstrapping
                    ? <div className="fortale-home-rail-loading"><FaviconSpinner size={22} /><span>{t('Kitaplar yükleniyor...')}</span></div>
                    : <div className="fortale-home-rail-empty">{t('Henüz hiç kitap yok.')}</div>}
              </div>
            </section>

            <section className="fortale-home-book-rail is-community-rail" aria-label={t('Toplulukta Popüler')} style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
              <h2 className="fortale-home-rail-label" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{t('Toplulukta Popüler')}</h2>
              <div className="fortale-home-rail-scroll touch-scroll-x" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
                {isHomeCommunityLoading
                  ? <div className="fortale-home-rail-loading"><FaviconSpinner size={22} /><span>{t('Kitaplar yükleniyor...')}</span></div>
                  : homeCommunityBooks.length > 0
                    ? homeCommunityBooks.map((book) => renderHomeCommunityCard(book))
                    : <div className="fortale-home-rail-empty">{t('Henüz veri yok')}</div>}
              </div>
            </section>
          </div>
        )}

        <section
          className={`relative ${isCreationIntroOnly ? 'fortale-home-create-dock' : ''}`}
          style={isCreationIntroOnly ? {
            top: homeCreateDockBounds?.top ?? 0,
            height: homeCreateDockBounds?.height ?? 202,
            visibility: homeCreateDockBounds ? 'visible' : 'hidden'
          } : undefined}
        >
          <input
            ref={sourceFileInputRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            onChange={handleSourceFilePick}
            className="hidden"
          />
          <input
            ref={heroPortraitInputRef}
            type="file"
            accept={HERO_PORTRAIT_ACCEPT}
            onChange={handleHeroPortraitPick}
            className="hidden"
          />

          {/* UNIFIED CREATE CONTAINER — intro'da kısa (raf görünsün), wizard 2+'de tam yükseklik */}
          <div
            ref={wizardInlineRef}
            className="flex flex-col rounded-[18px]"
            style={{
              height: isCreationIntroOnly
                ? '202px'
                : creationStep === 1
                  ? 'min(480px, calc(100dvh - var(--app-header-row-top, 0px) - 260px - env(safe-area-inset-bottom, 0px)))'
                  : 'min(700px, calc(100dvh - var(--app-header-row-top, 0px) - env(safe-area-inset-bottom, 0px) - 188px))',
              minHeight: isCreationIntroOnly ? '202px' : '320px',
            }}
          >
            {/* TOP BAR: generating'de gizle, intro'da invisible (layout tutmak için) */}
            {!isGenerating && !isCreationIntroOnly && (
              <div
                className="flex items-center justify-between gap-3 px-4 pt-3 pb-2"
              >
                <p className="text-[14px] font-bold text-white">{currentStepTitle}</p>
                <button
                  type="button"
                  onClick={() => { setCreationWizardOpen(false); setCreationStep(1); setAccentedBookType(null); }}
                  className="h-8 w-8 shrink-0 rounded-[18px] border flex items-center justify-center"
                  style={{ borderColor: 'rgba(135, 164, 197, 0.18)', background: 'rgba(10, 20, 32, 0.42)', color: '#ffffff' }}
                  aria-label={t('Kapat')}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* PROGRESS DOTS: generating'de gizle, intro'da invisible */}
            {!isGenerating && !isCreationIntroOnly && (
              <div
                className="px-4 pb-2"
              >
                <div className="flex gap-1.5">
                  {visibleCreationSteps.map((_, index) => (
                    <div
                      key={index}
                      className="h-[3px] flex-1 rounded-[18px] transition-colors duration-200"
                      style={{ background: index <= currentVisibleStepIndex ? wizardAccentColor : 'rgba(255,255,255,0.1)' }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* CONTENT AREA */}
            <div
              className={`flex-1 min-h-0 scrollbar-hide ${
                (isCreationIntroOnly || (isCreationWizardOpen && !isGenerating && creationStep === 1))
                  ? 'flex flex-col items-center justify-center overflow-visible'
                  : 'overflow-y-auto px-4 pb-2'
              }`}
            >
              {/* TYPE ORB: intro ve wizard adım 1'de göster */}
              {(isCreationIntroOnly || (isCreationWizardOpen && !isGenerating && creationStep === 1)) && (
                <div className="fortale-type-step">
                  <div className="fortale-black-hole-field" aria-hidden="true">
                    {WIZARD_BLACK_HOLE_TILES.map((tile, index) => (
                      <span
                        key={index}
                        className="fortale-black-hole-track"
                        style={{
                          '--tile-angle': `${tile.angle}deg`,
                          '--tile-radius': `${tile.radius}px`,
                          '--tile-delay': `${tile.delay}s`,
                          '--tile-duration': `${tile.duration}s`,
                          '--tile-size': `${tile.size}px`,
                          '--tile-color': tile.color
                        } as React.CSSProperties}
                      >
                        <i />
                      </span>
                    ))}
                  </div>
                  {!isCreationIntroOnly && (
                    <div className="fortale-type-copy">
                      <span>{t('Kitap Türünü Seç')}</span>
                    </div>
                  )}
                  <div className="fortale-type-orb" role="group" aria-label={t('Kitap Türünü Seç')}>
                    <span className="fortale-type-divider horizontal" aria-hidden="true" />
                    <span className="fortale-type-divider left" aria-hidden="true" />
                    <span className="fortale-type-core" aria-hidden="true">
                      <FLogo size={22} />
                    </span>
                    {HOME_SPLIT_BOOK_TYPES.map((option) => {
                      const isSelected = isCreationWizardOpen && selectedBookType === option.value;
                      const isAccented = accentedBookType === option.value;
                      const Icon = option.icon;
                      const translatedLabel = t(option.label);
                      const labelWords = translatedLabel.trim().split(/\s+/);
                      const labelLines = option.value === 'story' && labelWords.length > 1
                        ? [labelWords.slice(0, -1).join(' '), labelWords[labelWords.length - 1]]
                        : null;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleBookTypeSelect(option.value)}
                          className={`fortale-type-choice ${option.placement} accent-${option.value} ${isSelected ? 'selected' : ''} ${isAccented ? 'is-accented' : ''}`}
                          aria-pressed={isSelected}
                          title={t(option.hint)}
                        >
                          <Icon size={option.placement === 'top' ? 22 : 18} strokeWidth={1.8} />
                          <span className={`fortale-type-label ${labelLines ? 'two-line' : ''}`}>
                            {labelLines
                              ? labelLines.map((line) => <span key={line}>{line}</span>)
                              : translatedLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GENERATING STATE */}
              {isGenerating && (
                <div className="flex flex-col h-full min-h-0">
                  <div className="mt-3">
                    <div className="w-full overflow-hidden rounded-[18px]">
                      <video
                        className="h-auto w-full block"
                        src={BOOK_CREATING_LOOP_VIDEO_SRC}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                      />
                    </div>
                    <p className="mt-3 text-center text-[15px] font-bold text-white">
                      {generationStatus
                        ? translateGenerationStatusLabel(generationStatus, generationDisplayLanguage)
                        : translateGenerationStatusLabel('Sunucuda üretim başlatılıyor', generationDisplayLanguage)}
                    </p>
                    <p className="mt-1 text-center text-[13px] text-white">
                      {formatGenerationRemainingTime(displayedGenerationMinutesRemaining, generationDisplayLanguage)}
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-[18px] bg-white/10">
                      <div
                        className="h-full rounded-[18px] transition-all duration-300"
                        style={{ width: `${Math.max(1, Math.min(100, generationProgress || 0))}%`, background: wizardAccentColor }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-[14px] text-white tabular-nums">
                        %{Math.max(1, Math.min(100, Math.round(generationProgress || 0)))}
                      </p>
                      <button
                        type="button"
                        onClick={handleCancelGeneration}
                        className="text-[12px] text-white px-2 py-0.5"
                      >
                        {t('İptal')}
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const bookType = activeGeneratingBookType ?? selectedBookType;
                    const langFacts = getLiteraryFactsForBookType(bookType, generationDisplayLanguage);
                    if (!langFacts.length || currentLiteraryFactIndex === null) return null;
                    const fact = langFacts[currentLiteraryFactIndex % langFacts.length];
                    return (
                      <div className="flex items-center justify-center px-2 mt-auto pt-8">
                        <p
                          key={currentLiteraryFactIndex}
                          className="text-center italic leading-relaxed text-white"
                          style={{ fontSize: 15, animation: 'fadeIn 0.8s ease' }}
                        >
                          &ldquo;{fact}&rdquo;
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* WIZARD STEPS 2-6 */}
              {isCreationWizardOpen && !isGenerating && creationStep !== 1 && (
                <fieldset className="fortale-wizard-fields" style={{ border: 'none', padding: 0, margin: 0 }}>

                  {/* ── ADIM 2: Alt Tür ── */}
                  {creationStep === 2 && (
                    <div className="space-y-2.5 pt-1">
                      <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                        <p className="fortale-section-kicker mb-2.5">{t('Alt tür')}</p>
                        <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
                          {(selectedBookType === 'story'
                            ? WORKBOOK_CATEGORY_OPTIONS
                            : (SMARTBOOK_SUBGENRE_OPTIONS[selectedBookType] || [])).map((sub) => {
                            const isSelected = selectedSubGenre === sub;
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => {
                                  setSelectedSubGenre(sub);
                                  if (selectedSubGenre !== sub) {
                                    setSelectedTheme('');
                                  }
                                }}
                                className={`${wizardChoiceButtonClass} text-left`}
                                style={wizardOptionButtonStyle(isSelected)}
                                aria-pressed={isSelected}
                              >
                                {t(sub)}
                              </button>
                            );
                          })}
                          {selectedBookType !== 'story' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubGenre(CUSTOM_WIZARD_OPTION);
                                setSelectedTheme('');
                              }}
                              className={`${wizardChoiceButtonClass} text-left`}
                              style={wizardOptionButtonStyle(selectedSubGenre === CUSTOM_WIZARD_OPTION)}
                              aria-pressed={selectedSubGenre === CUSTOM_WIZARD_OPTION}
                            >
                              {t('Diğer')}
                            </button>
                          )}
                        </div>
                        {selectedBookType !== 'story' && selectedSubGenre === CUSTOM_WIZARD_OPTION && (
                          <input
                            value={customSubGenreInput}
                            onChange={(event) => setCustomSubGenreInput(event.target.value)}
                            maxLength={80}
                            placeholder={t('Kendi alt türünü yaz')}
                            className={wizardFieldClass}
                            style={wizardFieldStyle()}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── ADIM 3: Tema ── */}
                  {creationStep === themeStep && (
                    <div className="space-y-2.5 pt-1">
                      <div className={selectedBookType === 'story' ? '' : 'fortale-library-panel rounded-2xl border px-3 py-3'}>
                        <p className="fortale-section-kicker mb-2.5">{t(selectedBookType === 'story' ? 'Ek İçerikler' : 'Tema')}</p>
                        {selectedBookType === 'story' ? (
                          <div className="fortale-wizard-choice-chain-stack space-y-2">
                            {WORKBOOK_EXTRA_OPTIONS.map((option) => {
                              const isSelected = option.key === 'examples'
                                ? includeWorkbookExamples
                                : option.key === 'quiz'
                                  ? includeWorkbookQuiz
                                  : includeWorkbookRelatedBooks;
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => {
                                    if (option.key === 'examples') setIncludeWorkbookExamples((value) => !value);
                                    else if (option.key === 'quiz') setIncludeWorkbookQuiz((value) => !value);
                                    else setIncludeWorkbookRelatedBooks((value) => !value);
                                  }}
                                  className="relative w-full rounded-2xl border py-3.5 pl-4 pr-14 text-left transition-all active:scale-[0.98]"
                                  style={wizardOptionButtonStyle(isSelected)}
                                  aria-pressed={isSelected}
                                >
                                  <span className="block text-[14px] font-extrabold">{t(option.label)}</span>
                                  <span className="mt-1 block text-[11px] font-semibold leading-snug">
                                    {t(option.hint)}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    className="absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[7px] border"
                                    style={{
                                      borderColor: isSelected ? '#ffffff' : 'rgba(207,228,255,0.65)',
                                      background: isSelected ? '#fff8d6' : 'rgba(8,35,66,0.16)',
                                      color: isSelected ? '#082342' : '#ffffff',
                                      boxShadow: isSelected
                                        ? '0 3px 10px rgba(3,18,38,0.32), inset 0 0 0 1px rgba(8,35,66,0.08)'
                                        : 'inset 0 1px 0 rgba(255,255,255,0.12)'
                                    }}
                                  >
                                    {isSelected && <Check size={16} strokeWidth={3.4} />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                        <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
                          {selectedSubGenreThemes.map((theme) => {
                            const isSelected = selectedTheme === theme;
                            return (
                              <button
                                key={theme}
                                type="button"
                                onClick={() => setSelectedTheme(theme)}
                                className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                                style={wizardOptionButtonStyle(isSelected)}
                                aria-pressed={isSelected}
                              >
                                {t(theme)}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setSelectedTheme(CUSTOM_WIZARD_OPTION)}
                            className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                            style={wizardOptionButtonStyle(selectedTheme === CUSTOM_WIZARD_OPTION)}
                            aria-pressed={selectedTheme === CUSTOM_WIZARD_OPTION}
                          >
                            {t('Diğer')}
                          </button>
                        </div>
                        {selectedTheme === CUSTOM_WIZARD_OPTION && (
                          <input
                            value={customThemeInput}
                            onChange={(event) => setCustomThemeInput(event.target.value)}
                            maxLength={80}
                            placeholder={t('Kendi temanı yaz')}
                            className={wizardFieldClass}
                            style={wizardFieldStyle()}
                          />
                        )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── ADIM 4: Yaş Grubu ── */}
                  {creationStep === ageGroupStep && (
                    <div className="space-y-2.5 pt-1">
                      <p className="fortale-section-kicker mb-3">{t(selectedBookType === 'story' ? 'Seviye' : 'Yaş grubu')}</p>
                      <div className="fortale-wizard-choice-chain-stack space-y-2">
                        {(selectedBookType === 'story' ? WORKBOOK_LEVEL_OPTIONS : ageGroupOptionsForSelectedBookType).map((option) => {
                          const isSelected = selectedBookType === 'story'
                            ? selectedWorkbookLevel === option.value
                            : selectedAgeGroup === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                if (selectedBookType === 'story') setSelectedWorkbookLevel(option.value as WorkbookLevel);
                                else setSelectedAgeGroup(option.value as SmartBookAgeGroup);
                              }}
                              className="w-full rounded-2xl border px-4 py-4 text-center transition-all active:scale-[0.98]"
                              style={{
                                ...wizardOptionButtonStyle(isSelected),
                                minHeight: 74
                              }}
                              aria-pressed={isSelected}
                            >
                              <span className="block text-[15px] font-extrabold">{t(option.label)}</span>
                              <span className="mt-1.5 block text-[12px] font-semibold leading-snug">
                                {t(option.hint)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── ADIM 5: Kahramanlar ── */}
                  {creationStep === storyModeStep && (
                    <div className="fortale-wizard-component-chain space-y-2.5 pt-1">
                      <div className="fortale-wizard-chain-node fortale-library-panel relative z-[1] rounded-2xl border px-3 py-3">
                        <p className="fortale-section-kicker mb-2.5">{t('Kahraman sayısı')}</p>
                        <div className="fortale-wizard-choice-chain-grid fortale-wizard-choice-chain-grid-four grid grid-cols-4 gap-2">
                          {HERO_COUNT_OPTIONS.map((count) => {
                            const isSelected = heroCount === count;
                            return (
                              <button
                                key={count}
                                type="button"
                                onClick={() => handleHeroCountChange(count)}
                                className="rounded-xl border px-2 py-2.5 text-center text-[13px] font-bold transition-all active:scale-[0.98]"
                                style={wizardOptionButtonStyle(isSelected)}
                                aria-pressed={isSelected}
                              >
                                {count}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        className="fortale-wizard-chain-node fortale-library-panel relative rounded-2xl border px-3 py-3"
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="fortale-section-kicker mb-2 block">{t('Ana kahraman adı')}</label>
                            <input
                              value={heroPortraitName}
                              onChange={(event) => setHeroPortraitName(event.target.value)}
                              maxLength={60}
                              placeholder={t('Örn: Aras')}
                              className={wizardFieldClass}
                              style={wizardFieldStyle()}
                            />
                          </div>
                          <div className="fortale-hero-inline-row grid grid-cols-2 gap-2">
                            <div>
                              <label className="fortale-section-kicker mb-2 block">{t('Yaş')}</label>
                              <input
                                value={heroAgeInput}
                                onChange={(event) => setHeroAgeInput(event.target.value)}
                                maxLength={24}
                                inputMode="numeric"
                                placeholder={t('Örn: 9')}
                                className="fortale-wizard-glass-control fortale-wizard-keyboard-input fortale-hero-age-input fortale-hero-paired-control w-full px-3 text-[13px] text-white placeholder:text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="fortale-section-kicker mb-2 block">
                                {t('Cinsiyet')} <span className="font-normal">({t('opsiyonel')})</span>
                              </label>
                              {renderGenderPicker(heroGender, setHeroGender)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {heroCount > 1 && (
                        <div
                          className="fortale-wizard-chain-node fortale-library-panel relative rounded-2xl border px-3 py-3 space-y-3"
                        >
                          <p className="fortale-section-kicker">{t('Diğer kahramanlar')}</p>
                          {Array.from({ length: heroCount - 1 }, (_, index) => {
                            const companion = companionHeroes[index] || { name: '', gender: '' };
                            return (
                              <div key={index} className="grid grid-cols-[minmax(0,1fr)_138px] gap-2">
                                <div>
                                  <label className="fortale-section-kicker mb-2 block">{index + 2}. {t('kahraman adı')}</label>
                                  <input
                                    value={companion.name}
                                    onChange={(event) => updateCompanionHero(index, { name: event.target.value })}
                                    maxLength={60}
                                    placeholder={t('Örn: Zeynep')}
                                    className={wizardFieldClass}
                                    style={wizardFieldStyle()}
                                  />
                                </div>
                                <div>
                                  <label className="fortale-section-kicker mb-2 block">
                                    {t('Cinsiyet')} <span className="font-normal">({t('opsiyonel')})</span>
                                  </label>
                                  {renderGenderPicker(
                                    companion.gender,
                                    (nextGender) => updateCompanionHero(index, { gender: nextGender })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  )}

                  {/* ── ADIM 5: Evren ── */}
                  {creationStep === optionalBookDetailsStep && (
                    <div className="space-y-2.5 pt-1">
                      <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                        <p className="fortale-section-kicker mb-2.5">{t('Zaman')}</p>
                        <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
                          {SETTING_TIME_OPTIONS.map((option) => {
                            const isSelected = settingTimeChoice === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setSettingTimeChoice(option.value);
                                  if (option.value !== 'custom') {
                                    setSettingTimeInput('');
                                  }
                                }}
                                className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                                style={wizardOptionButtonStyle(isSelected)}
                                aria-pressed={isSelected}
                              >
                                {t(option.label)}
                              </button>
                            );
                          })}
                        </div>
                        {settingTimeChoice === 'custom' && (
                          <input
                            value={settingTimeInput}
                            onChange={(event) => setSettingTimeInput(event.target.value)}
                            maxLength={120}
                            placeholder={t("Örn: 1800'ler, günümüz, 2090 sonrası")}
                            className={wizardFieldClass}
                            style={wizardFieldStyle()}
                          />
                        )}
                      </div>

                      <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                        <p className="fortale-section-kicker mb-2.5">{t('Mekan')}</p>
                        <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
                          {SETTING_PLACE_OPTIONS.map((option) => {
                            const isSelected = settingPlaceChoice === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setSettingPlaceChoice(option.value);
                                  if (option.value !== 'custom') {
                                    setSettingPlaceInput('');
                                  }
                                }}
                                className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                                style={wizardOptionButtonStyle(isSelected)}
                                aria-pressed={isSelected}
                              >
                                {t(option.label)}
                              </button>
                            );
                          })}
                        </div>
                        {settingPlaceChoice === 'custom' && (
                          <input
                            value={settingPlaceInput}
                            onChange={(event) => setSettingPlaceInput(event.target.value)}
                            maxLength={120}
                            placeholder={t('Örn: İstanbul, antik kent, Mars kolonisi')}
                            className={wizardFieldClass}
                            style={wizardFieldStyle()}
                          />
                        )}
                      </div>

                      <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                        <p className="fortale-section-kicker mb-2.5">{t('Dünya tipi')}</p>
                        <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
                          {WORLD_TYPE_OPTIONS.map((option) => {
                            const isSelected = worldTypeChoice === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setWorldTypeChoice(option.value);
                                  if (option.value !== 'custom') {
                                    setWorldTypeInput('');
                                  }
                                }}
                                className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                                style={wizardOptionButtonStyle(isSelected)}
                                aria-pressed={isSelected}
                              >
                                {t(option.label)}
                              </button>
                            );
                          })}
                        </div>
                        {worldTypeChoice === 'custom' && (
                          <input
                            value={worldTypeInput}
                            onChange={(event) => setWorldTypeInput(event.target.value)}
                            maxLength={120}
                            placeholder={t('Örn: gerçekçi, büyülü, alternatif evren')}
                            className={wizardFieldClass}
                            style={wizardFieldStyle()}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── ADIM 6: Hikaye Çekirdeği ── */}
                  {creationStep === premiseStep && (
                    <div className="space-y-2.5 pt-1">
                      {selectedBookType === 'story' ? (
                        <div>
                          <label className="fortale-section-kicker mb-2 block">{t('Konu')}</label>
                          <textarea
                            value={customPremiseInput}
                            onChange={(event) => {
                              setPremiseMode('custom');
                              setSelectedPremise('');
                              setCustomPremiseInput(event.target.value);
                            }}
                            maxLength={600}
                            rows={5}
                            placeholder={t('Örn: Paralel evrenler, fotosentez veya kuantum bilgisayarlar')}
                            className={wizardTextareaClass}
                            style={wizardFieldStyle({ fixedHeight: false })}
                          />
                        </div>
                      ) : (
                        <>
                      <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                        <p className="fortale-section-kicker mb-2.5">{t('Konu kaynağı')}</p>
                        <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPremiseMode('examples');
                              setCustomPremiseInput('');
                            }}
                            className="rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98]"
                            style={wizardOptionButtonStyle(premiseMode === 'examples')}
                            aria-pressed={premiseMode === 'examples'}
                          >
                            <span className="block text-[12px] font-bold">{t('Örneklerden seç')}</span>
                            <span className="mt-0.5 block text-[11px] font-semibold">
                              {t('Fortale hazır çekirdekler sunsun')}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPremiseMode('custom');
                              setSelectedPremise('');
                            }}
                            className="rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98]"
                            style={wizardOptionButtonStyle(premiseMode === 'custom')}
                            aria-pressed={premiseMode === 'custom'}
                          >
                            <span className="block text-[12px] font-bold">{t('Diğer')}</span>
                            <span className="mt-0.5 block text-[11px] font-semibold">
                              {t('Konu fikrini sen belirle')}
                            </span>
                          </button>
                        </div>
                      </div>

                      {premiseMode === 'examples' ? (
                        <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                          <p className="fortale-section-kicker mb-2.5">{t('Hikaye çekirdeği')}</p>
                          <div className="fortale-wizard-choice-chain-grid grid grid-cols-2 gap-2">
                            {STORY_PREMISE_OPTIONS.map((premise) => {
                              const isSelected = selectedPremise === premise;
                              return (
                                <button
                                  key={premise}
                                  type="button"
                                  onClick={() => setSelectedPremise(premise)}
                                  className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                                  style={wizardOptionButtonStyle(isSelected)}
                                  aria-pressed={isSelected}
                                >
                                  {t(premise)}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                setPremiseMode('custom');
                                setSelectedPremise('');
                              }}
                              className="rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all active:scale-[0.98]"
                              style={wizardOptionButtonStyle(false)}
                              aria-pressed={false}
                            >
                              {t('Diğer')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                          <label className="fortale-section-kicker mb-2 block">{t('Konu')}</label>
                          <textarea
                            value={customPremiseInput}
                            onChange={(event) => setCustomPremiseInput(event.target.value)}
                            maxLength={600}
                            rows={4}
                            placeholder={t('Örn: Kahraman, herkesin unuttuğu eski bir sırrı çözmek zorunda kalır.')}
                            className={wizardTextareaClass}
                            style={wizardFieldStyle({ fixedHeight: false })}
                          />
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── ADIM 7: Kahraman Portresi ── */}
                  {creationStep === portraitStep && (
                    <div className="pt-1">
                      {renderHeroPortraitPanel()}
                    </div>
                  )}

                  {/* ── ADIM 8: Genel Bakış ── */}
                  {creationStep === summaryStep && (
                    <div className="space-y-2.5 pt-1">
                      <div className="fortale-library-panel rounded-2xl border px-3 py-3">
                        <p className="text-[16px] font-bold text-white">{t('Kitabınıza genel bakış')}</p>
                        <p className="mt-1 text-[12px] leading-snug text-white">
                          {t('Oluşturmadan önce seçimlerinizi son kez kontrol edin.')}
                        </p>
                      </div>

                      <div className="fortale-library-panel overflow-hidden rounded-2xl border">
                        {bookOverviewRows.map((row, index) => (
                          <div
                            key={`${row.label}-${index}`}
                            className={`flex items-start justify-between gap-4 px-3.5 py-3 ${index > 0 ? 'border-t border-white/[0.08]' : ''}`}
                          >
                            <span className="shrink-0 text-[12px] font-semibold text-white">{row.label}</span>
                            <span className="min-w-0 text-right text-[12px] font-bold leading-snug text-white">
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="fortale-library-panel rounded-2xl border px-3.5 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[13px] font-bold text-white">{t('Maliyet')}</span>
                          <span className="text-[15px] font-extrabold text-white">{selectedCreateCreditCost} {t('kredi')}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-white">{createCreditUseSentence}</p>
                      </div>
                    </div>
                  )}
                </fieldset>
              )}
            </div>

          </div>
        </section>

        {/* WIZARD GERİ / İLERİ — bottom nav üstüne fixed */}
        {isCreationWizardOpen && !isGenerating && (
          <div className="wizard-footer-position fixed left-0 right-0 z-[35] pointer-events-none">
            <div className="app-chrome-width">
              {creationStep === portraitStep && (
                <p
                  className="mx-4 mb-1 rounded-[16px] border px-3 py-2 text-center text-[11px] font-semibold leading-snug pointer-events-auto"
                  style={{ borderColor: 'rgba(139,187,244,0.18)', background: 'rgba(8,36,70,0.72)', color: 'rgba(207,228,255,0.78)' }}
                >
                  {t('Fotoğrafın AI tarafından kitabın görsel stiline uyarlanır. İsteğe bağlıdır, eklenirse +1 kredi kullanır.')}
                </p>
              )}
              <div className={`wizard-footer-controls gap-2 px-4 pointer-events-auto ${currentVisibleStepIndex > 0 ? 'has-back' : 'only-primary'}`}>
                {currentVisibleStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setCreationStep((prev) => getPreviousCreationStep(prev))}
                    className={`${wizardChoiceButtonClass} inline-flex w-full items-center justify-center gap-2 text-center`}
                    style={wizardOptionButtonStyle(false)}
                  >
                    <ArrowLeft size={14} />{t('Geri')}
                  </button>
                )}
                {currentVisibleStepIndex < totalVisibleStepCount - 1 ? (
                  <button
                    type="button"
                    onClick={() => { if (requireLoginForGeneration()) return; setCreationStep((prev) => getNextCreationStep(prev)); }}
                    disabled={!canMoveNext}
                    className={`${wizardChoiceButtonClass} inline-flex w-full items-center justify-center gap-2 text-center`}
                    style={{ ...wizardOptionButtonStyle(true), opacity: canMoveNext ? 1 : 0.55 }}
                  >
                    {t('İleri')}<ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canCreateOnFinalStep) return;
                      void handleCreateSmartBook();
                    }}
                    disabled={!canCreateOnFinalStep}
                    className={`${wizardChoiceButtonClass} inline-flex w-full items-center justify-center gap-2 text-center`}
                    style={{ ...wizardOptionButtonStyle(true), opacity: canCreateOnFinalStep ? 1 : 0.55 }}
                  >
                    <BookPlus size={15} />{t('Oluştur')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <FloatIslandSheet
          isOpen={isLoginRequiredModalOpen}
          onClose={() => setLoginRequiredModalOpen(false)}
          title={t('Üretim için giriş gerekli')}
          subtitle={t('Üretime devam etmek için lütfen giriş yapın.')}
          maxWidth={448}
          layer={1200}
          bodyClassName="p-0"
          footer={(
            <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginRequiredModalOpen(false)}
                    className="h-12 rounded-2xl border border-white/12 bg-[rgba(34,44,58,0.95)] text-[14px] font-normal text-white"
                  >
                    {t('Vazgeç')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRequiredModalOpen(false);
                      onRequestLogin?.();
                    }}
                    className="h-12 rounded-2xl border border-[#7eb3ef]/38 bg-[#0b2342] text-[14px] font-normal text-white"
                  >
                    {t('Giriş Yap')}
                  </button>
            </div>
          )}
        >
          <span />
        </FloatIslandSheet>

        <FloatIslandSheet
          isOpen={Boolean(heroPortraitCrop)}
          onClose={dismissHeroPortraitCrop}
          closeDisabled={Boolean(heroPortraitCrop?.isProcessing)}
          title={t('Portreyi Hazırla')}
          subtitle={heroPortraitCrop?.fileName}
          maxWidth={448}
          layer={1150}
          footer={heroPortraitCrop ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={dismissHeroPortraitCrop}
                disabled={heroPortraitCrop.isProcessing}
                className="h-11 rounded-2xl border border-white/12 bg-[rgba(34,44,58,0.95)] text-[13px] font-normal text-white disabled:opacity-60"
              >
                {t('Vazgeç')}
              </button>
              <button
                type="button"
                onClick={() => void applyHeroPortraitCrop()}
                disabled={heroPortraitCrop.isProcessing}
                className="h-11 rounded-2xl border text-[13px] font-normal disabled:opacity-60"
                style={primaryActionButtonStyle}
              >
                {heroPortraitCrop.isProcessing ? t('İşleniyor...') : t('Portreyi Kullan')}
              </button>
            </div>
          ) : undefined}
        >
          {heroPortraitCrop && (
            <>
                <div className="flex justify-center">
                  <div className="relative h-[min(78vw,360px)] w-[min(78vw,360px)] overflow-hidden rounded-2xl border border-white/14 bg-black/30 touch-none">
                    <Cropper
                      image={heroPortraitCrop.sourceUrl}
                      crop={heroPortraitCrop.crop}
                      zoom={heroPortraitCrop.zoom}
                      aspect={1}
                      cropShape="rect"
                      showGrid
                      minZoom={1}
                      maxZoom={4}
                      zoomSpeed={0.9}
                      restrictPosition
                      onCropChange={(nextCrop) => updateHeroPortraitCrop({ crop: nextCrop })}
                      onZoomChange={(nextZoom) => updateHeroPortraitCrop({ zoom: nextZoom })}
                      onCropComplete={(_, croppedAreaPixels) => updateHeroPortraitCrop({ croppedAreaPixels })}
                      onMediaLoaded={() => updateHeroPortraitCrop({ zoom: Math.max(1.05, heroPortraitCrop.zoom || 1.18) })}
                    />
                  </div>
                </div>
                <p className="mt-3 text-center text-[12px] leading-snug text-white">
                  {t('Portreniz ne kadar belirginse görseliniz o kalitede olur. Yüzünüzü ve saçınızı net biçimde ortalayın.')}
                </p>
            </>
          )}
        </FloatIslandSheet>

        {sourceNotice && (
          <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+80px)] z-[126] -translate-x-1/2 px-4">
            <div className="fortale-cosmos-notice rounded-2xl border px-4 py-3 backdrop-blur-xl shadow-[0_18px_28px_-18px_rgba(0,0,0,0.85)]">
              <p className="text-[12px] font-semibold text-white">{sourceNotice}</p>
            </div>
          </div>
        )}

      </div>

      {selectedHomeCourse && (() => {
        const selectedOpenState = courseOpenStates[selectedHomeCourse.id] || { status: 'idle', progress: 0, updatedAt: 0 };
        const selectedOpenProgress = Math.max(0, Math.min(100, Math.round(selectedOpenState.progress || 0)));
        const selectedIsDownloading = selectedOpenState.status === 'downloading';
        const selectedIsReady = selectedOpenState.status === 'ready' || courseHasReadableContent(selectedHomeCourse);
        const selectedIsFailed = selectedOpenState.status === 'failed';
        const selectedActionLabel = selectedIsReady
          ? t('Oku')
          : selectedIsDownloading
            ? `${t('İndiriliyor')} %${selectedOpenProgress}`
            : selectedIsFailed
              ? t('Tekrar dene')
              : t('İndir');
        const selectedCover = selectedHomeCourse.deviceCoverImageUrl || selectedHomeCourse.coverImageUrl;
        const selectedCanDelete = canDeleteCourse ? canDeleteCourse(selectedHomeCourse) : true;

        return (
          <FloatIslandSheet
            isOpen
            onClose={() => setSelectedHomeCourse(null)}
            title={selectedHomeCourse.topic}
            subtitle={`${t(bookTypeToLabel(selectedHomeCourse.bookType))} · ${formatStickyDate(selectedHomeCourse.lastActivity, locale)}`}
            maxWidth={520}
            layer={980}
            footer={(
              <div className={selectedCanDelete ? 'grid grid-cols-2 gap-2' : ''}>
                {selectedCanDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      const course = selectedHomeCourse;
                      setSelectedHomeCourse(null);
                      openCourseDeleteModal(course);
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-400/10 text-[12px] font-black text-rose-100"
                  >
                    <Trash2 size={14} /> {t('Sil')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const courseId = selectedHomeCourse.id;
                    setSelectedHomeCourse(null);
                    onCourseSelect(courseId);
                  }}
                  disabled={selectedIsDownloading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[12px] font-black text-[#102018] disabled:opacity-55"
                >
                  {selectedIsDownloading ? <FaviconSpinner size={14} /> : selectedIsReady ? <BookOpen size={14} /> : <Download size={14} />}
                  {selectedActionLabel}
                </button>
              </div>
            )}
          >
            <div className="flex gap-4">
              <div className="w-[126px] shrink-0">
                <span className="fortale-book-list-cover-media">
                  {selectedCover ? (
                    <img src={selectedCover} alt={selectedHomeCourse.topic} />
                  ) : (
                    <span className="fortale-home-rail-cover-empty"><BookOpen size={28} /></span>
                  )}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-[11px] leading-5 text-white">
                <span className="inline-flex rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[9px] font-black text-white">
                  {t(bookTypeToLabel(selectedHomeCourse.bookType))}
                </span>
                {selectedHomeCourse.language && <p>{selectedHomeCourse.language}</p>}
                {selectedHomeCourse.subGenre && <p>{t(selectedHomeCourse.subGenre)}</p>}
                <p>{selectedHomeCourse.nodes.length} {t('bölüm')}</p>
              </div>
            </div>
            {selectedHomeCourse.description && (
              <div className="mt-5 border-t border-dashed border-white/15 pt-4">
                <h3 className="text-[13px] font-black text-white">{t('Açıklama')}</h3>
                <p className="mt-2 text-[12px] leading-6 text-white">{selectedHomeCourse.description}</p>
              </div>
            )}
          </FloatIslandSheet>
        );
      })()}

      {selectedHomeCommunityBook && (
        <FloatIslandSheet
          isOpen
          onClose={() => setSelectedHomeCommunityBook(null)}
          title={selectedHomeCommunityBook.title}
          subtitle={`@${selectedHomeCommunityBook.publisherAlias || t('Fortale üreticisi')}`}
          maxWidth={560}
          layer={980}
          bodyClassName="p-0"
          footer={(
            <div className="fortale-home-community-footer grid grid-cols-2 items-stretch gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedHomeCommunityBook(null);
                  _onNavigate('COMMUNITY');
                }}
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-2 text-[11px] font-normal text-white whitespace-nowrap"
              >
                {t('Topluluk')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (getOwnedCommunityCourseId(selectedHomeCommunityBook, authUserId)) {
                    void openOwnedHomeCommunityBook(selectedHomeCommunityBook);
                  } else {
                    void handleHomeCommunityDownload();
                  }
                }}
                disabled={isHomeCommunityDownloading || isHomeCommunityReading}
                className="fortale-community-library-button inline-flex items-center justify-center gap-1.5 rounded-2xl px-2 text-[10px] font-normal whitespace-nowrap"
              >
                {isHomeCommunityDownloading || isHomeCommunityReading ? (
                  <FaviconSpinner size={14} />
                ) : getOwnedCommunityCourseId(selectedHomeCommunityBook, authUserId) ? (
                  <><BookOpen size={13} /><span className="whitespace-nowrap">{t('Oku')}</span></>
                ) : (
                  <><Library size={13} /><span className="whitespace-nowrap">{t('Kütüphaneme Ekle')} {COMMUNITY_DOWNLOAD_CREDIT_COST}C</span></>
                )}
              </button>
            </div>
          )}
        >
          {isHomeCommunityDetailLoading ? (
            <div className="flex justify-center p-16"><FaviconSpinner size={28} /></div>
          ) : (() => {
            const bookLabels = getCommunityBookSectionLabels(selectedHomeCommunityBook.language);
            return (
            <div className="community-book-detail space-y-5 p-4">
              <section className="community-detail-hero flex gap-4">
                <div className="w-[126px] shrink-0">
                  <span className="fortale-book-list-cover-media">
                    {selectedHomeCommunityBook.coverImageUrl ? (
                      <img src={selectedHomeCommunityBook.coverImageUrl} alt={selectedHomeCommunityBook.title} />
                    ) : (
                      <span className="fortale-home-rail-cover-empty"><BookOpen size={30} /></span>
                    )}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="fortale-community-type-chip inline-flex rounded-full border px-2 py-1 text-[9px] font-black" data-book-type={selectedHomeCommunityBook.bookType}>
                    {t(homeCommunityTypeLabel(selectedHomeCommunityBook.bookType))}
                  </span>
                  <p className="mt-3 text-[11px] font-bold text-white">@{selectedHomeCommunityBook.publisherAlias || t('Fortale üreticisi')}</p>
                  <p className="community-detail-cover-summary mt-2 line-clamp-3 text-[10px] leading-[1.45] text-white">{String(selectedHomeCommunityBook.description || '').trim() || String(selectedHomeCommunityBook.preview?.[0]?.content || '').replace(/^#{1,6}\s+.+$/gm, ' ').replace(/[*_`>#-]/g, ' ').replace(/\s+/g, ' ').trim()}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white">
                    {selectedHomeCommunityBook.language && <span>{selectedHomeCommunityBook.language}</span>}
                    {selectedHomeCommunityBook.category && <span>• {t(selectedHomeCommunityBook.category)}</span>}
                    {selectedHomeCommunityBook.pageCount ? <span>• {selectedHomeCommunityBook.pageCount} {t('sayfa')}</span> : null}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-[11px] text-white">
                    <span className="inline-flex items-center gap-1"><Heart size={13} /> {selectedHomeCommunityBook.likeCount || 0}</span>
                    <span className="inline-flex items-center gap-1"><Download size={13} /> {selectedHomeCommunityBook.downloadCount || 0}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {selectedHomeCommunityBook.commentCount || 0}</span>
                  </div>
                </div>
              </section>

              {selectedHomeCommunityBook.previewImages && selectedHomeCommunityBook.previewImages.length > 0 && (
                <section className={`community-detail-media-grid grid gap-3 ${selectedHomeCommunityBook.bookType === 'story' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {selectedHomeCommunityBook.previewImages.slice(0, selectedHomeCommunityBook.bookType === 'story' ? 1 : 2).map((image) => (
                    <div key={image.id} className={`community-detail-media-item ${selectedHomeCommunityBook.bookType === 'story' ? 'aspect-[16/9]' : 'aspect-[4/3]'} overflow-hidden`}>
                      <img src={image.url} alt={image.title || selectedHomeCommunityBook.title} className={`h-full w-full ${selectedHomeCommunityBook.bookType === 'story' ? 'object-contain' : 'object-cover'}`} loading="lazy" />
                    </div>
                  ))}
                </section>
              )}

              {selectedHomeCommunityBook.description && (
                <section className="px-1">
                  <h3 className="community-detail-section-title">{bookLabels.description}</h3>
                  <p className="community-detail-body mt-2 text-white">{selectedHomeCommunityBook.description}</p>
                </section>
              )}

              {selectedHomeCommunityBook.outline && selectedHomeCommunityBook.outline.length > 0 && (
                <section className="px-1">
                  <h3 className="community-detail-section-title">{bookLabels.contents}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedHomeCommunityBook.outline.slice(0, 6).map((title, index) => (
                      <span key={`${title}-${index}`} className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white">{title}</span>
                    ))}
                  </div>
                </section>
              )}

              {selectedHomeCommunityBook.preview && selectedHomeCommunityBook.preview.length > 0 && (
                <section className="space-y-3 px-1">
                  <h3 className="community-detail-section-title">{bookLabels.firstChapterPreview}</h3>
                  <article className="overflow-hidden">
                    {selectedHomeCommunityBook.preview[0].title && <h4 className="text-[12px] font-semibold leading-5 text-white">{selectedHomeCommunityBook.preview[0].title}</h4>}
                    <div className="community-preview-markdown prose prose-invert mt-2 max-w-none text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractHomeCommunityPreview(selectedHomeCommunityBook.preview[0].content)}</ReactMarkdown>
                    </div>
                  </article>
                </section>
              )}
            </div>
            );
          })()}
        </FloatIslandSheet>
      )}

      <FloatIslandSheet
        isOpen={courseDeleteModal.isOpen}
        onClose={closeCourseDeleteModal}
        closeDisabled={isCourseDeleting}
        title={t('Bu kitabı silmek istediğine emin misin?')}
        subtitle={courseDeleteModal.courseTitle}
        maxWidth={448}
        layer={965}
        bodyClassName="p-0"
        footer={(
          <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeCourseDeleteModal}
                  disabled={isCourseDeleting}
                  className="h-12 rounded-2xl border border-white/12 bg-[rgba(34,44,58,0.95)] text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {t('Vazgeç')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCourseDeleteConfirm()}
                  disabled={isCourseDeleting}
                  className="h-12 rounded-2xl border border-red-300/30 bg-[rgba(220,38,38,0.9)] text-[14px] font-bold text-white disabled:opacity-60"
                >
                  {isCourseDeleting ? t('İşleniyor...') : t('Sil')}
                </button>
          </div>
        )}
      >
        <span />
      </FloatIslandSheet>

      {showStickyNotes && stickyModal.isOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="fortale-modal-backdrop absolute inset-0 bg-transparent"
            onClick={closeStickyModal}
            aria-label={t('Kapat')}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[min(42rem,calc(100vw-1rem))]"
            style={{
              top: stickyModalTop,
              bottom: STICKY_MODAL_BOTTOM_INSET
            }}
          >
            <div
              className="fortale-floatisland-sheet-panel fortale-sheet-surface fortale-sticky-modal-surface h-full rounded-2xl border shadow-[0_24px_36px_-24px_rgba(0,0,0,0.78)] overflow-hidden flex flex-col"
              style={{
                borderColor: activeStickyTint.border
              }}
            >
              <div
                className="fortale-cosmos-modal-section px-4 py-3 border-b flex items-center gap-3"
                style={{
                  borderColor: activeStickyTint.border
                }}
              >
                <input
                  value={stickyModal.title}
                  onChange={(event) => setStickyModal((prev) => ({ ...prev, title: event.target.value.slice(0, 80) }))}
                  placeholder={t('Başlık ekle')}
                  className="sticky-modal-title-input flex-1 text-sm text-white placeholder:text-white outline-none ring-0 focus:!ring-0"
                />
                <div className="text-right shrink-0">
                  <span className="block text-[11px] text-white">
                    {formatStickyDate(stickyModal.createdAt, locale)}
                  </span>
                  {stickyModal.reminderAt && (
                    <span className="block text-[10px] text-white">
                      {formatStickyReminder(stickyModal.reminderAt, locale)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeStickyModal}
                  className="w-7 h-7 rounded-lg border border-zinc-600/70 text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="fortale-cosmos-modal-section flex-1 px-4 pb-4 pt-0">
                <textarea
                  value={stickyModal.text}
                  onChange={(event) => setStickyModal((prev) => ({ ...prev, text: event.target.value }))}
                  placeholder={t('Yapışkan notunu yaz...')}
                  className="w-full h-full resize-none !border-0 !bg-transparent !shadow-none text-[14px] leading-relaxed text-white placeholder:text-white outline-none ring-0 focus:!border-0 focus:!ring-0"
                />
              </div>

              {isReminderPickerOpen && (
                <div
                  className="fortale-cosmos-modal-section px-3 py-3 border-t"
                  style={{
                    borderColor: activeStickyTint.border
                  }}
                >
                  <label className="block text-[11px] text-white mb-2">{t('Hatırlatıcı zamanı')}</label>
                  <input
                    type="datetime-local"
                    value={reminderDraft}
                    onChange={(event) => setReminderDraft(event.target.value)}
                    className="w-full h-10 rounded-lg border border-zinc-600/70 bg-black/25 px-2 text-[13px] text-white outline-none focus:border-emerald-400/70"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleReminderClear();
                      }}
                      disabled={!stickyModal.reminderAt && !reminderDraft}
                      className="px-3 h-8 rounded-lg border border-red-500/70 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-45 disabled:hover:bg-transparent transition-colors"
                    >
                      {t('Kaldır')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleReminderApply();
                      }}
                      disabled={!reminderDraft}
                      className="px-3 h-8 rounded-lg border border-sky-300/70 text-[11px] text-sky-200 hover:bg-sky-500/10 disabled:opacity-45 disabled:hover:bg-transparent transition-colors"
                    >
                      {t('Kaydet')}
                    </button>
                  </div>
                </div>
              )}

              <div
                className="fortale-cosmos-modal-section px-3 py-2 border-t flex items-center justify-between gap-2"
                style={{
                  borderColor: activeStickyTint.border
                }}
              >
                <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pr-1">
                  {stickyModal.noteId && (
                    <button
                      type="button"
                      onClick={handleStickyDelete}
                      disabled={isStickySaving}
                      className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center disabled:opacity-50"
                      title={t('Sil')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStickyDownload}
                    disabled={!hasStickyContent}
                    className="w-8 h-8 rounded-lg text-white hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-white"
                    title={t('İndir')}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleStickyCopy();
                    }}
                    disabled={!hasStickyContent}
                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center disabled:opacity-45 disabled:hover:bg-transparent ${isStickyCopyConfirmed ? 'text-sky-300 bg-sky-500/15' : 'text-white hover:text-white hover:bg-white/10'}`}
                    title={isStickyCopyConfirmed ? t('Kopyalandı.') : t('Kopyala')}
                  >
                    {isStickyCopyConfirmed ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleStickyShare();
                    }}
                    disabled={!hasStickyContent}
                    className="w-8 h-8 rounded-lg text-white hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-white"
                    title={t('Paylaş')}
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isReminderPickerOpen) {
                        setIsReminderPickerOpen(false);
                        return;
                      }
                      setReminderDraft(toLocalDateTimeValue(stickyModal.reminderAt));
                      setIsReminderPickerOpen(true);
                    }}
                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${stickyModal.reminderAt ? 'text-sky-300 bg-sky-500/10' : 'text-white hover:text-white hover:bg-white/10'}`}
                    title={stickyModal.reminderAt ? t('Hatırlatıcıyı düzenle') : t('Hatırlatıcı ekle')}
                  >
                    <Bell size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {stickyNotice && <span className="text-[11px] text-white">{stickyNotice}</span>}
                  <button
                    type="button"
                    onClick={handleStickySave}
                    disabled={isStickySaving || !hasStickyContent}
                    className="btn-glass-primary px-4 py-2 text-[12px] disabled:opacity-50"
                  >
                    {isStickySaving ? <FaviconSpinner size={14} /> : (
                      <>
                        <Check size={14} />
                        {t('Kaydet')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
