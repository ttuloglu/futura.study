export type ViewState =
  | 'HOME'
  | 'COURSE_FLOW'
  | 'PROFILE'
  | 'AI_CHAT'
  | 'EXPLORE'
  | 'COMMUNITY'
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

export type SmartBookAgeGroup = '1-6' | '7+' | '1-3' | '4-6' | '7-9' | '7-11' | '12-18' | 'general';

export type SmartBookBookType = 'fairy_tale' | 'story' | 'novel';

export type SmartBookEndingStyle = 'happy' | 'bittersweet' | 'twist';

export interface SmartBookCreativeBrief {
  bookType: SmartBookBookType;
  subGenre?: string;
  languageText?: string;
  workbookLevel?: string;
  workbookCategory?: string;
  includeExamples?: boolean;
  includeQuiz?: boolean;
  includeRelatedBooks?: boolean;
  characters?: string;
  settingPlace?: string;
  settingTime?: string;
  endingStyle?: SmartBookEndingStyle;
  narrativeStyle?: string;
  customInstructions?: string;
  targetPageMin?: number;
  targetPageMax?: number;
}

export type CreditActionType = 'create' | 'community_download';

export interface CommunityBook {
  id: string;
  userId: string;
  bookId: string;
  title: string;
  description?: string;
  publisherAlias?: string;
  coverImageUrl?: string;
  bookType: SmartBookBookType;
  subGenre?: string;
  category?: string;
  ageGroup?: SmartBookAgeGroup;
  language?: string;
  tags?: string[];
  pageCount?: number;
  outline?: string[];
  preview?: Array<{ id: string; title: string; content: string }>;
  previewImages?: Array<{ id: string; title: string; url: string }>;
  downloadCount: number;
  likeCount: number;
  commentCount?: number;
  isFeatured?: boolean;
  hotScore?: number;
  isLiked?: boolean;
  isOwned?: boolean;
  publishedAt: Date;
}

export interface CreditWallet {
  purchasedCredits: number;
  communityEarnedCredits: number;
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

export type VisualStoryAudioStatus = 'pending' | 'ready' | 'failed' | 'partial';

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
  pageText?: string;
  pageImageUrl?: string;
  pageAudioUrl?: string;
  pageAudioStatus?: VisualStoryAudioStatus;
  pageAudioStoragePath?: string;
  pageSequence?: number;
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
  visualStoryMode?: boolean;
  visualStoryAudioStatus?: VisualStoryAudioStatus;
  coverNarrationText?: string;
  coverNarrationAudioUrl?: string;
  coverNarrationAudioStoragePath?: string;
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
  visualStoryMode?: boolean;
  visualStoryAudioStatus?: VisualStoryAudioStatus;
  coverNarrationText?: string;
  coverNarrationAudioUrl?: string;
  coverNarrationAudioStoragePath?: string;
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
  visualStoryMode?: boolean;
  visualStoryAudioStatus?: VisualStoryAudioStatus;
  coverNarrationText?: string;
  coverNarrationAudioUrl?: string;
  coverNarrationAudioStoragePath?: string;
  coverImageUrl?: string;
  deviceCoverImageUrl?: string;
  contentPackageUrl?: string;
  contentPackagePath?: string;
  contentPackageUpdatedAt?: Date;
  bundle?: BookBundleDescriptor;
  cover?: BookCoverDescriptor;
  status?: 'processing' | 'ready' | 'failed';
  communityPublication?: {
    id: string;
    status: 'published' | 'unpublished' | 'hidden' | 'removed';
    updatedAt?: Date;
  };
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
