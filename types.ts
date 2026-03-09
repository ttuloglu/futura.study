export type ViewState =
  | 'HOME'
  | 'COURSE_FLOW'
  | 'PROFILE'
  | 'AI_CHAT'
  | 'EXPLORE'
  | 'PRIVACY'
  | 'TERMS';

export interface Subject {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  progress: number; // 0-100
  lastActivity: string;
  image: string;
}

export type NodeType = 'lecture' | 'podcast' | 'quiz' | 'reinforce' | 'exam' | 'retention';

export type SmartBookAgeGroup = '1-3' | '4-6' | '7-9' | '7-11' | '12-18' | 'general';

export type SmartBookBookType = 'fairy_tale' | 'story' | 'novel';

export type SmartBookEndingStyle = 'happy' | 'bittersweet' | 'twist';

export interface SmartBookCreativeBrief {
  bookType: SmartBookBookType;
  subGenre?: string;
  languageText?: string;
  characters?: string;
  settingPlace?: string;
  settingTime?: string;
  endingStyle?: SmartBookEndingStyle;
  narrativeStyle?: string;
  customInstructions?: string;
  targetPageMin?: number;
  targetPageMax?: number;
}

export type CreditActionType = 'create';

export interface CreditWallet {
  createCredits: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number; // index
}

export interface PodcastUsageSummary {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  audioFileBytes?: number;
}

export interface PodcastSegment {
  id: string;
  title: string;
  audioUrl: string;
  script?: string;
  duration?: string;
}

export type PodcastVoiceName =
  | 'Kore'
  | 'Leda'
  | 'Aoede'
  | 'Autonoe'
  | 'Enceladus'
  | 'Iapetus'
  | 'Umbriel'
  | 'Algieba';

export interface TimelineNode {
  id: string;
  title: string;
  description: string;
  type: NodeType;
  status: 'completed' | 'current' | 'locked' | 'conditional';
  score?: number; // For exams
  duration?: string;
  // Dynamic Content Fields
  content?: string; // Markdown content for lectures/reinforce
  podcastScript?: string; // Script for podcast
  podcastAudioUrl?: string; // Generated Audio Url
  podcastSegments?: PodcastSegment[];
  podcastUsage?: PodcastUsageSummary;
  podcastVoiceName?: PodcastVoiceName;
  podcastVariants?: Record<string, {
    audioUrl?: string;
    script?: string;
    duration?: string;
    segments?: PodcastSegment[];
    usage?: PodcastUsageSummary;
    voiceName?: PodcastVoiceName;
  }>;
  questions?: QuizQuestion[]; // For quizzes/exams
  isLoading?: boolean; // To show loading state during generation
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export interface BookBundleDescriptor {
  path: string;
  version: number;
  checksumSha256?: string;
  sizeBytes?: number;
  includesPodcast?: boolean;
  generatedAt: Date;
}

export interface BookCoverDescriptor {
  path?: string;
  url?: string;
}

export interface BookMeta {
  id: string;
  userId: string;
  title: string;
  description?: string;
  creatorName?: string;
  language?: string;
  ageGroup?: SmartBookAgeGroup;
  bookType?: SmartBookBookType;
  subGenre?: string;
  targetPageCount?: number;
  category?: string;
  searchTags?: string[];
  totalDuration?: string;
  cover?: BookCoverDescriptor;
  bundle?: BookBundleDescriptor;
  status?: 'processing' | 'ready' | 'failed';
  createdAt: Date;
  updatedAt?: Date;
  lastActivity: Date;
}

export interface BookBundleManifest {
  schemaVersion: number;
  id: string;
  userId: string;
  title: string;
  description?: string;
  creatorName?: string;
  language?: string;
  ageGroup?: SmartBookAgeGroup;
  bookType?: SmartBookBookType;
  subGenre?: string;
  targetPageCount?: number;
  category?: string;
  searchTags?: string[];
  totalDuration?: string;
  cover?: BookCoverDescriptor;
  includesPodcast?: boolean;
  nodes: TimelineNode[];
  generatedAt: Date;
  createdAt: Date;
  lastActivity: Date;
}

export interface BookDownloadState {
  status: 'idle' | 'queued' | 'downloading' | 'ready' | 'failed';
  progress: number;
  updatedAt: number;
  error?: string;
}

export interface CourseData {
  id: string;
  topic: string;
  description?: string;
  creatorName?: string;
  language?: string;
  ageGroup?: SmartBookAgeGroup;
  bookType?: SmartBookBookType;
  subGenre?: string;
  creativeBrief?: SmartBookCreativeBrief;
  targetPageCount?: number;
  category?: string;
  searchTags?: string[];
  totalDuration?: string;
  coverImageUrl?: string;
  contentPackageUrl?: string;
  contentPackagePath?: string;
  contentPackageUpdatedAt?: Date;
  bundle?: BookBundleDescriptor;
  cover?: BookCoverDescriptor;
  status?: 'processing' | 'ready' | 'failed';
  userId?: string;
  nodes: TimelineNode[];
  createdAt: Date;
  lastActivity: Date;
}

export type CourseOpenUiStatus = 'idle' | 'downloading' | 'ready' | 'failed';

export interface CourseOpenUiState {
  status: CourseOpenUiStatus;
  progress: number; // 0-100
  updatedAt: number;
}

export interface StickyNoteData {
  id: string;
  title: string;
  text: string;
  noteType: 'sticky';
  reminderAt?: string | null;
  createdAt: Date;
  lastActivity: Date;
}
