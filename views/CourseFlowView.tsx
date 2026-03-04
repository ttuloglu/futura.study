import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Activity,
  ArrowRight,
  AudioLines,
  Award,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  History,
  Lock,
  PlayCircle,
  Target,
  Zap,
  X,
  Plus,
  ChevronDown,
  Compass,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { exportCourseToEpub, exportCourseToPdf, exportNodeToPdf } from '../utils/exportUtils';
import { NodeType, TimelineNode, CourseData, PodcastUsageSummary, ViewState } from '../types';
import FLogo from '../components/FLogo';
import FaviconSpinner from '../components/FaviconSpinner';
import {
  generateLectureContent,
  getPodcastAudioJob,
  generateRemedialContent,
  startPodcastAudioJob,
  generateSummaryCard
} from '../ai';
import { PODCAST_CREATE_CREDIT_COST } from '../utils/creditCosts';
import { downloadFile } from '../utils/fileDownload';
import StyledMarkdown from '../components/StyledMarkdown';
import { FREE_PLAN_LIMITS } from '../planLimits';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import { getAppLanguageLabel, normalizeAppLanguageCode } from '../data/appLanguages';
import { useUiI18n } from '../i18n/uiI18n';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface CourseFlowViewProps {
  onBack: () => void;
  onNavigate: (view: ViewState) => void;
  courseData: CourseData | null;
  onUpdateCourse: (nodes: TimelineNode[]) => void;
  onEnsureCourseHydrated?: (courseId: string) => Promise<boolean> | boolean;
  allowOpenAutoGeneration?: boolean;
  onReadingFullscreenChange?: (isFullscreen: boolean) => void;
  onRequireCredit: (action: 'create', costOverride?: number) => boolean;
  onConsumeCredit: (action: 'create', costOverride?: number) => Promise<boolean> | boolean;
  onRefundCredit: (action: 'create', costOverride?: number) => Promise<void> | void;
}

type NodeVisual = {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
};

const NODE_VISUALS: Record<NodeType, NodeVisual> = {
  lecture: { icon: Compass, label: 'Giriş' },
  podcast: { icon: AudioLines, label: 'Podcast' },
  quiz: { icon: Target, label: 'Quiz' },
  reinforce: { icon: Zap, label: 'Detaylar' },
  exam: { icon: ClipboardCheck, label: 'Sınav' },
  retention: { icon: History, label: 'Özet' }
};

const QUIZ_PASS_PERCENT = 70;
const QUIZ_TIME_LIMIT_SECONDS = 300;
const READING_WORDS_PER_MINUTE = 180;
const QUIZ_FEEDBACK_DELAY_MS = 2000;

type MilestoneTone = 'neutral' | 'success' | 'focus' | 'completion';

type MilestonePayload = {
  id: string;
  title: string;
  message: string;
  tone: MilestoneTone;
  nextNodeId?: string;
  persistent?: boolean;
};

type BackgroundReadyToast = {
  id: string;
  title: string;
  message: string;
  nodeId?: string;
};

type MilestoneParticle = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  d: number;
  s: number;
  w: number;
  h: number;
  r: number;
  o: number;
};

function getPodcastCarrierNode(nodes: TimelineNode[]): TimelineNode | null {
  return nodes.find((node) => node.type === 'podcast')
    || nodes.find((node) => node.type === 'lecture')
    || null;
}

function getTimeLimitForNode(node: TimelineNode, questionCount: number): number {
  if (node.type === 'quiz') return Math.max(QUIZ_TIME_LIMIT_SECONDS, questionCount * 30);
  if (node.type === 'exam') return Math.max(QUIZ_TIME_LIMIT_SECONDS, questionCount * 30);
  return Math.max(300, questionCount * 20);
}

function estimateReadingMinutesFromText(text: string): number {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\((?:data:image\/[^)]+|https?:\/\/[^)]+)\)/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  if (!wordCount) return 3;
  return Math.max(1, Math.ceil(wordCount / READING_WORDS_PER_MINUTE));
}

function estimateQuizMinutes(questionCount: number): number {
  if (!questionCount) return 5;
  return Math.max(1, Math.ceil((questionCount * 30) / 60));
}

function estimatePodcastMinutesFromScript(script: string): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 1;
  return Math.max(1, Math.ceil(words / 140));
}

function parsePodcastDurationMinutes(value: string | undefined): number {
  const text = String(value || '').trim().toLocaleLowerCase('tr-TR');
  if (!text) return 0;
  const minuteMatch = text.match(/(\d+)\s*dk/u);
  const secondMatch = text.match(/(\d+)\s*sn/u);
  const minutes = minuteMatch ? Number.parseInt(minuteMatch[1], 10) : 0;
  const seconds = secondMatch ? Number.parseInt(secondMatch[1], 10) : 0;
  const total = minutes + (seconds / 60);
  return Number.isFinite(total) ? total : 0;
}

function formatPodcastDurationFromSeconds(durationSeconds: number, t: (value: string) => string): string {
  const safeSeconds = Number.isFinite(durationSeconds) ? Math.max(0, Math.round(durationSeconds)) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  if (mins <= 0) return `${secs} ${t('sn')}`;
  if (secs === 0) return `${mins} ${t('dk')}`;
  return `${mins} ${t('dk')} ${secs} ${t('sn')}`;
}

function extractRetryTopics(node: TimelineNode, selectedAnswers: number[]): string[] {
  if (!node.questions?.length) return [];
  const wrongQuestions = node.questions.filter((q, idx) => selectedAnswers[idx] !== q.correctAnswer);
  return wrongQuestions
    .slice(0, 3)
    .map((q) => q.question.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function formatTimeAgo(date: Date, t: (value: string) => string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return t('Az önce');
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t('dk önce')}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('saat önce')}`;
  return `${Math.floor(diff / 86400)} ${t('gün önce')}`;
}

function formatQuizTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatLocalizedDurationLabel(value: string | undefined, t: (input: string) => string): string {
  const text = String(value || '').trim();
  if (!text) return `5 ${t('dk')}`;
  const minuteMatch = text.match(/(\d+)\s*dk/u);
  const secondMatch = text.match(/(\d+)\s*sn/u);
  const minutes = minuteMatch ? Number.parseInt(minuteMatch[1], 10) : 0;
  const seconds = secondMatch ? Number.parseInt(secondMatch[1], 10) : 0;
  if (!minutes && !seconds) return text;
  if (!minutes) return `${seconds} ${t('sn')}`;
  if (!seconds) return `${minutes} ${t('dk')}`;
  return `${minutes} ${t('dk')} ${seconds} ${t('sn')}`;
}

function normalizeSectionHeadingToken(value: string | undefined): string {
  return String(value || '')
    .replace(/^#{1,6}\s+/u, '')
    .replace(/[:\-–—\s]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function isSameSectionHeading(a: string | undefined, b: string | undefined): boolean {
  const left = normalizeSectionHeadingToken(a);
  const right = normalizeSectionHeadingToken(b);
  return Boolean(left && right && left === right);
}

function stripLeadingDuplicateSectionHeadings(
  content: string,
  labels: Array<string | undefined>
): string {
  const source = String(content || '');
  if (!source.trim()) return source;

  const candidates = labels
    .map((label) => normalizeSectionHeadingToken(label))
    .filter(Boolean);
  if (!candidates.length) return source;

  const lines = source.split(/\r?\n/);
  let scanStart = 0;
  let removedAny = false;

  for (let round = 0; round < 2; round += 1) {
    while (scanStart < lines.length && !lines[scanStart].trim()) scanStart += 1;
    if (scanStart >= lines.length) break;

    const currentLine = lines[scanStart].trim();
    const headingMatch = currentLine.match(/^#{1,6}\s+(.+?)\s*$/u);
    const headingText = headingMatch
      ? headingMatch[1]
      : (currentLine.length <= 96 ? currentLine : '');
    const normalizedHeading = normalizeSectionHeadingToken(headingText);
    if (!normalizedHeading || !candidates.includes(normalizedHeading)) break;

    removedAny = true;
    lines.splice(scanStart, 1);
    while (scanStart < lines.length && !lines[scanStart].trim()) {
      lines.splice(scanStart, 1);
    }
  }

  if (!removedAny) return source;
  const next = lines.join('\n').trimStart();
  return next || source;
}

function getUserFacingError(error: unknown, fallback: string): string {
  const rawMessage = (error as { message?: string } | null)?.message;
  if (!rawMessage || typeof rawMessage !== 'string') return fallback;

  if (rawMessage.includes('resource-exhausted')) {
    return rawMessage
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, '')
      .trim();
  }

  const cleaned = rawMessage
    .replace(/^Firebase:\s*/i, '')
    .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, '')
    .trim();

  return cleaned || fallback;
}

function getNodeLabelForMessage(node: TimelineNode): string {
  return node.title || NODE_VISUALS[node.type]?.label || 'Bölüm';
}

function getMilestoneMessageForProgress(
  completedNode: TimelineNode,
  nextNode: TimelineNode | null,
  courseTopic: string,
  score?: number
): Omit<MilestonePayload, 'id'> {
  if (!nextNode) {
    const finalScore = typeof score === 'number' ? score : (typeof completedNode.score === 'number' ? completedNode.score : undefined);
    let expertiseLine = `"${courseTopic}" konusunda SmartBook uzmanısınız.`;
    if (typeof finalScore === 'number') {
      if (finalScore >= 90) expertiseLine = `"${courseTopic}" konusunda ileri düzey uzmanlık seviyesinde performans gösterdiniz.`;
      else if (finalScore >= 80) expertiseLine = `"${courseTopic}" konusunda güçlü bir uzmanlık düzeyi yakaladınız.`;
      else expertiseLine = `"${courseTopic}" konusunda güvenilir bir uzmanlık temeli oluşturdunuz.`;
    }
    return {
      title: 'Öğrenme Yolculuğu Tamamlandı',
      message: `Harika bir öğrenme yolculuğuydu. ${expertiseLine}`,
      tone: 'completion',
      persistent: true
    };
  }

  if (completedNode.type === 'lecture' && nextNode.type === 'podcast') {
    return {
      title: 'Giriş Bölümü Tamamlandı',
      message: 'Şimdi podcast ile konuyu dinleyerek öğrenmeyi derinleştirin.',
      tone: 'success',
      nextNodeId: nextNode.id,
      persistent: true
    };
  }

  if (completedNode.type === 'podcast' && nextNode.type === 'quiz') {
    return {
      title: 'Podcast Tamamlandı',
      message: 'İlerleme kontrolü için kısa bir quiz hazır. Kavrayışınızı test edelim.',
      tone: 'focus',
      nextNodeId: nextNode.id,
      persistent: true
    };
  }

  if (completedNode.type === 'quiz' && nextNode.type === 'reinforce') {
    const scoreValue = typeof score === 'number' ? score : (typeof completedNode.score === 'number' ? completedNode.score : undefined);
    const passed = typeof scoreValue === 'number' ? scoreValue >= QUIZ_PASS_PERCENT : false;
    return {
      title: passed ? 'Quiz Geçildi' : 'Quiz Tamamlandı',
      message: passed
        ? 'Şimdi pekiştirme bölümüyle kritik noktaları güçlendirelim ve gerçek örneklerle netleştirelim.'
        : `Başarı oranı %${typeof scoreValue === 'number' ? scoreValue : 0}. Yine de akış devam ediyor; pekiştirme bölümünde eksik noktaları tamamlayabilirsiniz.`,
      tone: 'success',
      nextNodeId: nextNode.id,
      persistent: true
    };
  }

  if (completedNode.type === 'reinforce' && nextNode.type === 'exam') {
    return {
      title: 'Pekiştirme Tamamlandı',
      message: 'Genel sınava geçebilirsiniz. Şimdi konuyu daha geniş kapsamda değerlendireceksiniz.',
      tone: 'focus',
      nextNodeId: nextNode.id,
      persistent: true
    };
  }

  if (completedNode.type === 'exam' && nextNode.type === 'retention') {
    const scoreValue = typeof score === 'number' ? score : (typeof completedNode.score === 'number' ? completedNode.score : undefined);
    const passed = typeof scoreValue === 'number' ? scoreValue >= QUIZ_PASS_PERCENT : false;
    return {
      title: passed ? 'Genel Sınav Geçildi' : 'Genel Sınav Tamamlandı',
      message: passed
        ? 'Final özet bölümü hazır. Kritik noktaları kısa bir özet kartında toparlayalım.'
        : `Başarı oranı %${typeof scoreValue === 'number' ? scoreValue : 0}. Yine de final özet bölümü açıldı; kritik noktaları burada toparlayabilirsiniz.`,
      tone: 'success',
      nextNodeId: nextNode.id,
      persistent: true
    };
  }

  return {
    title: `${getNodeLabelForMessage(completedNode)} Tamamlandı`,
    message: `${getNodeLabelForMessage(nextNode)} bölümüne geçerek öğrenme akışına devam edin.`,
    tone: 'neutral',
    nextNodeId: nextNode.id,
    persistent: true
  };
}

function getQuizResultMilestone(node: TimelineNode, passed: boolean, percent: number): Omit<MilestonePayload, 'id'> {
  if (passed) {
    if (percent >= 90) {
      return {
        title: `${getNodeLabelForMessage(node)} Başarılı`,
        message: `Çok güçlü bir performans: %${percent}. Bir sonraki aşamaya hazırsınız.`,
        tone: 'success',
        persistent: true
      };
    }
    return {
      title: `${getNodeLabelForMessage(node)} Başarılı`,
      message: `Başarı oranı %${percent}. Akışı güvenle sürdürebilirsiniz.`,
      tone: 'success',
      persistent: true
    };
  }

  return {
    title: `${getNodeLabelForMessage(node)} Sonucu`,
    message: `Başarı oranı %${percent}. Kritik noktaları kısa tekrar edip yeniden deneyin.`,
    tone: 'focus',
    persistent: true
  };
}

function getMilestoneDisplayDurationMs(milestone: MilestonePayload, reducedMotion: boolean): number {
  if (milestone.persistent) return 0;
  const charWeight = Math.min(180, milestone.title.length + milestone.message.length);
  const toneBonus = milestone.tone === 'completion' ? 700 : milestone.tone === 'focus' ? 450 : 300;
  const base = reducedMotion ? 3200 : 4300;
  return Math.min(6200, base + charWeight * 8 + toneBonus);
}

function getMilestoneParticlePalette(tone: MilestoneTone): string[] {
  if (tone === 'completion') {
    return ['#cfe4fb', '#8ec1ff', '#f1e4ba', '#a7d7ff'];
  }
  if (tone === 'focus') {
    return ['#efdcb2', '#d7b97c', '#b9d0eb', '#f4e8c8'];
  }
  if (tone === 'success') {
    return ['#cdeedb', '#86d1a8', '#d8e7fb', '#bfe9cf'];
  }
  return ['#d9e0ea', '#b7c8dc', '#d7c5aa', '#d1dae5'];
}

function createParticleLayout(): MilestoneParticle[] {
  return [
    { x: -58, y: -2, dx: -22, dy: -20, d: 0, s: 1.05, w: 3, h: 9, r: -28, o: 0.92 },
    { x: -44, y: -18, dx: -14, dy: -28, d: 45, s: 0.95, w: 3, h: 8, r: -12, o: 0.82 },
    { x: -26, y: -28, dx: -10, dy: -36, d: 90, s: 0.9, w: 4, h: 10, r: -4, o: 0.8 },
    { x: -8, y: -34, dx: -4, dy: -40, d: 135, s: 0.88, w: 4, h: 11, r: 5, o: 0.8 },
    { x: 10, y: -34, dx: 4, dy: -40, d: 170, s: 0.9, w: 4, h: 11, r: 10, o: 0.82 },
    { x: 28, y: -28, dx: 10, dy: -36, d: 215, s: 0.94, w: 4, h: 10, r: 14, o: 0.84 },
    { x: 46, y: -16, dx: 16, dy: -28, d: 260, s: 0.98, w: 3, h: 8, r: 22, o: 0.88 },
    { x: 60, y: -2, dx: 22, dy: -20, d: 305, s: 1.04, w: 3, h: 9, r: 30, o: 0.92 },
    { x: -50, y: 16, dx: -18, dy: -10, d: 60, s: 0.78, w: 3, h: 6, r: -34, o: 0.72 },
    { x: -30, y: 22, dx: -10, dy: -14, d: 110, s: 0.74, w: 3, h: 6, r: -18, o: 0.68 },
    { x: -8, y: 26, dx: -4, dy: -16, d: 150, s: 0.72, w: 3, h: 6, r: -6, o: 0.66 },
    { x: 14, y: 26, dx: 4, dy: -16, d: 190, s: 0.72, w: 3, h: 6, r: 6, o: 0.66 },
    { x: 34, y: 22, dx: 10, dy: -14, d: 230, s: 0.74, w: 3, h: 6, r: 18, o: 0.68 },
    { x: 54, y: 16, dx: 18, dy: -10, d: 270, s: 0.78, w: 3, h: 6, r: 34, o: 0.72 }
  ];
}


function createPodcastSegments(script: string) {
  const cleaned = script.replace(/\r/g, "").replace(/\*\*/g, "").trim();
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
  const rawSegments = lines.length > 0 ? lines : [cleaned || "Podcast metni"];
  const total = rawSegments.reduce((sum, line) => sum + Math.max(1, line.length), 0);
  let consumed = 0;
  return rawSegments.map((line, index) => {
    const startRatio = consumed / total;
    consumed += Math.max(1, line.length);
    return { id: `seg-${index}`, text: line, startRatio, endRatio: consumed / total };
  });
}

function normalizeQuizMathMarkdown(input: string): string {
  const source = String(input || '');
  if (!source) return '';

  return source
    // TeX display math delimiters -> remark-math display syntax
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, expr) => `\n$$\n${String(expr || '').trim()}\n$$\n`)
    // TeX inline math delimiters -> remark-math inline syntax
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, expr) => `$${String(expr || '').trim()}$`);
}

function InlineQuizMarkdown({ content }: { content: string }) {
  const safe = normalizeQuizMathMarkdown(String(content || '')).trim();
  if (!safe) return null;

  return (
    <span className="quiz-inline-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span className="m-0 inline leading-[1.45]">{children}</span>,
          strong: ({ children }) => <strong className="font-extrabold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.92em] text-[#d8f0b6]">
              {children}
            </code>
          ),
          pre: ({ children }) => <span className="inline">{children}</span>,
          ul: ({ children }) => <span className="inline">{children}</span>,
          ol: ({ children }) => <span className="inline">{children}</span>,
          li: ({ children }) => <span className="inline">{children}</span>,
          h1: ({ children }) => <span className="font-bold">{children}</span>,
          h2: ({ children }) => <span className="font-bold">{children}</span>,
          h3: ({ children }) => <span className="font-bold">{children}</span>,
          blockquote: ({ children }) => <span className="inline">{children}</span>,
          hr: () => <span className="inline" />,
          table: ({ children }) => <span className="inline">{children}</span>,
          thead: ({ children }) => <span className="inline">{children}</span>,
          tbody: ({ children }) => <span className="inline">{children}</span>,
          tr: ({ children }) => <span className="inline">{children}</span>,
          th: ({ children }) => <span className="inline">{children}</span>,
          td: ({ children }) => <span className="inline">{children}</span>,
          img: () => <span className="inline" />
        }}
      >
        {safe}
      </ReactMarkdown>
    </span>
  );
}

function DownloadCircleSpinner({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-white/90"
      style={{ width: size, height: size }}
    />
  );
}

function formatPodcastUsd(value: number | undefined): string {
  const amount = Math.max(0, Number(value) || 0);
  if (amount === 0) return '$0';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

function formatPodcastTokenCount(value: number | undefined, locale: string): string {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString(locale);
}

function formatPodcastFileSize(bytes: number | undefined): string {
  const normalized = Math.max(0, Number(bytes) || 0);
  if (!normalized) return '0 MB';
  const megabytes = normalized / (1024 * 1024);
  return `${megabytes >= 100 ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

export default function CourseFlowView({
  onNavigate,
  courseData,
  onUpdateCourse,
  onEnsureCourseHydrated,
  allowOpenAutoGeneration = false,
  onReadingFullscreenChange,
  onRequireCredit,
  onConsumeCredit,
  onRefundCredit
}: CourseFlowViewProps) {
  const { locale, t } = useUiI18n();
  const [activeTabNodeId, setActiveTabNodeId] = useState<string | null>(null);
  const [isCourseExpanded, setIsCourseExpanded] = useState(false);
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const genTimer = useRef<number | null>(null);
  const [podcastTranscriptOpenByNodeId, setPodcastTranscriptOpenByNodeId] = useState<Record<string, boolean>>({});
  const [activeQuizNode, setActiveQuizNode] = useState<TimelineNode | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizPercent, setQuizPercent] = useState(0);
  const [quizPassed, setQuizPassed] = useState<boolean | null>(null);
  const [quizRetryTopics, setQuizRetryTopics] = useState<string[]>([]);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [podcastCompletedByNodeId, setPodcastCompletedByNodeId] = useState<Record<string, boolean>>({});
  const [iosPopupMessage, setIosPopupMessage] = useState<string | null>(null);
  const [podcastSkipConfirmNodeId, setPodcastSkipConfirmNodeId] = useState<string | null>(null);
  const [isHeaderPodcastPanelOpen, setIsHeaderPodcastPanelOpen] = useState(false);
  const [headerPodcastLanguageCode, setHeaderPodcastLanguageCode] = useState<string>('tr');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [milestoneQueue, setMilestoneQueue] = useState<MilestonePayload[]>([]);
  const [activeMilestone, setActiveMilestone] = useState<MilestonePayload | null>(null);
  const [activeExportKey, setActiveExportKey] = useState<string | null>(null);
  const [backgroundReadyToasts, setBackgroundReadyToasts] = useState<BackgroundReadyToast[]>([]);
  const [pulseTabNodeId, setPulseTabNodeId] = useState<string | null>(null);
  const [progressPulse, setProgressPulse] = useState(false);
  const [isReadingFullscreen, setIsReadingFullscreen] = useState(false);
  const [podcastGenerationVisualProgress, setPodcastGenerationVisualProgress] = useState(6);
  const [hydratedContentNodeIds, setHydratedContentNodeIds] = useState<string[]>([]);
  const podcastGenerationProgressRef = useRef<{
    total: number;
    completed: number;
    currentChunkIndex: number | null;
    status: 'idle' | 'queued' | 'processing' | 'finalizing' | 'completed' | 'failed';
  }>({ total: 0, completed: 0, currentChunkIndex: null, status: 'idle' });
  const iosPopupTimerRef = useRef<number | null>(null);
  const milestoneTimerRef = useRef<number | null>(null);
  const pulseTabTimerRef = useRef<number | null>(null);
  const progressPulseTimerRef = useRef<number | null>(null);
  const deferredContentHydrationTimerRef = useRef<number | null>(null);
  const autoIntroGenerationRef = useRef<Set<string>>(new Set());
  const nodeReadySnapshotRef = useRef<Map<string, { primaryReady: boolean; summaryReady: boolean }>>(new Map());
  const nodeReadyInitCourseIdRef = useRef<string | null>(null);
  const podcastCompletionMilestoneShownRef = useRef<Set<string>>(new Set());
  const isNodeVisibleInFlow = (node: TimelineNode) => node.type === 'lecture';
  const isNarrativeBook =
    courseData?.bookType === 'fairy_tale' ||
    courseData?.bookType === 'story' ||
    courseData?.bookType === 'novel';
  const calculateTotalDuration = (nodes: TimelineNode[]): string => {
    const totalMinutes = nodes.reduce((sum, node) => {
      if (!isNodeVisibleInFlow(node)) return sum;
      const durationText = (node.duration || '').toLowerCase();
      const minutesMatch = durationText.match(/(\d+)\s*dk/);
      const secondsMatch = durationText.match(/(\d+)\s*sn/);
      const fallbackMatch = durationText.match(/\d+/);
      let m = 10;
      if (minutesMatch || secondsMatch) {
        const mins = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
        const secs = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;
        m = mins + (secs >= 30 ? 1 : 0);
      } else if (fallbackMatch) {
        m = parseInt(fallbackMatch[0], 10);
      } else {
        const defaults: Record<string, number> = {
          lecture: 14,
          podcast: FREE_PLAN_LIMITS.transcriptMaxMinutes,
          reinforce: 9,
          retention: 4,
          quiz: 9
        };
        m = defaults[node.type] || 5;
      }

      if (node.type === 'lecture') m = Math.min(15, m);
      if (node.type === 'reinforce') {
        const lec = nodes.find(n => n.type === 'lecture');
        const lecM = lec?.duration ? (parseInt(lec.duration) || 12) : 12;
        m = Math.min(10, m, Math.max(2, lecM - 2));
      }
      if (node.type === 'podcast') {
        m = Math.max(3, Math.min(FREE_PLAN_LIMITS.transcriptMaxMinutes, m));
      }
      if (node.type === 'retention') m = Math.max(3, Math.min(6, m));

      return sum + m;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours > 0) {
      return `${hours} ${t('saat')} ${mins > 0 ? `${mins} ${t('dk')} ` : ''}${t('tahmini okuma süresi')}`;
    }
    return `${totalMinutes} ${t('dk')} ${t('tahmini okuma süresi')}`;
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefersReducedMotion(media.matches);
    apply();
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    onReadingFullscreenChange?.(isReadingFullscreen);
    return () => onReadingFullscreenChange?.(false);
  }, [isReadingFullscreen, onReadingFullscreenChange]);

  useEffect(() => {
    if (!isReadingFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReadingFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReadingFullscreen]);

  useEffect(() => {
    const isGeneratingPodcast = activeExportKey === 'podcast-generate';
    if (!isGeneratingPodcast) {
      podcastGenerationProgressRef.current = {
        total: 0,
        completed: 0,
        currentChunkIndex: null,
        status: 'idle'
      };
      setPodcastGenerationVisualProgress(6);
      return;
    }

    setPodcastGenerationVisualProgress(8);
    const timer = window.setInterval(() => {
      setPodcastGenerationVisualProgress((prev) => {
        const { total, completed, currentChunkIndex, status } = podcastGenerationProgressRef.current;
        if (total <= 0) {
          return Math.min(24, prev + 0.35);
        }

        const safeCompleted = Math.max(0, Math.min(total, completed));
        const inFlightUnits =
          status === 'finalizing'
            ? Math.max(safeCompleted, total - 0.15)
            : status === 'processing' && currentChunkIndex !== null
              ? Math.max(safeCompleted, Math.min(total, currentChunkIndex + 0.55))
              : safeCompleted;
        const completedRatio = safeCompleted / total;
        const base = 10 + (completedRatio * 82);
        const inFlightCap = 10 + (Math.min(total, inFlightUnits) / total) * 82;
        const next = Math.max(prev, base);
        return Math.min(97, Math.max(next, Math.min(inFlightCap, prev + 0.55)));
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [activeExportKey]);

  const getPodcastGenerationStatusText = () => {
    const { total, completed, currentChunkIndex, status } = podcastGenerationProgressRef.current;
    if (status === 'finalizing') {
      return t('Ses parçaları birleştiriliyor...');
    }
    if (total <= 0) {
      return t('Podcast hazırlanıyor...');
    }
    if (status === 'processing' && currentChunkIndex !== null) {
      return `${t('Parça')} ${Math.min(total, currentChunkIndex + 1)}/${total} ${t('hazırlanıyor...')}`;
    }
    if (completed > 0) {
      return `${Math.min(total, completed)}/${total} ${t('parça tamamlandı.')}`;
    }
    return `0/${total} ${t('parça sırada.')}`;
  };

  const enqueueMilestone = (payload: Omit<MilestonePayload, 'id'>) => {
    void payload;
    return;
  };

  const triggerTabPulse = (nodeId?: string | null) => {
    if (!nodeId) return;
    setPulseTabNodeId(nodeId);
    if (pulseTabTimerRef.current !== null) {
      window.clearTimeout(pulseTabTimerRef.current);
    }
    pulseTabTimerRef.current = window.setTimeout(() => {
      setPulseTabNodeId((current) => (current === nodeId ? null : current));
      pulseTabTimerRef.current = null;
    }, prefersReducedMotion ? 1000 : 2600);
  };

  const triggerProgressPulse = () => {
    setProgressPulse(false);
    if (progressPulseTimerRef.current !== null) {
      window.clearTimeout(progressPulseTimerRef.current);
    }
    window.setTimeout(() => setProgressPulse(true), 0);
    progressPulseTimerRef.current = window.setTimeout(() => {
      setProgressPulse(false);
      progressPulseTimerRef.current = null;
    }, prefersReducedMotion ? 800 : 2200);
  };

  const pushBackgroundReadyToast = (toast: Omit<BackgroundReadyToast, 'id'>) => {
    void toast;
    return;
    /*
    const nextToast: BackgroundReadyToast = {
      ...toast,
      id: `ready-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    };
    setBackgroundReadyToasts((prev) => [...prev.slice(-2), nextToast]);
    window.setTimeout(() => {
      setBackgroundReadyToasts((prev) => prev.filter((item) => item.id !== nextToast.id));
    }, prefersReducedMotion ? 3000 : 4200);
    */
  };

  useEffect(() => {
    if (activeMilestone || milestoneQueue.length === 0) return;
    const [next, ...rest] = milestoneQueue;
    setMilestoneQueue(rest);
    setActiveMilestone(next);
    if (next.nextNodeId) triggerTabPulse(next.nextNodeId);
    triggerProgressPulse();

    if (!next.persistent) {
      const dismissMs = getMilestoneDisplayDurationMs(next, prefersReducedMotion);
      milestoneTimerRef.current = window.setTimeout(() => {
        setActiveMilestone((current) => (current?.id === next.id ? null : current));
        milestoneTimerRef.current = null;
      }, dismissMs);
    }
  }, [activeMilestone, milestoneQueue, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (milestoneTimerRef.current !== null) window.clearTimeout(milestoneTimerRef.current);
      if (pulseTabTimerRef.current !== null) window.clearTimeout(pulseTabTimerRef.current);
      if (progressPulseTimerRef.current !== null) window.clearTimeout(progressPulseTimerRef.current);
      if (deferredContentHydrationTimerRef.current !== null) {
        window.clearTimeout(deferredContentHydrationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!courseData?.id || !courseData.nodes?.length) return;

    const currentCourseId = courseData.id;
    const nextSnapshot = new Map<string, { primaryReady: boolean; summaryReady: boolean }>();
    const initialForCourse = nodeReadyInitCourseIdRef.current !== currentCourseId;
    if (initialForCourse) {
      nodeReadySnapshotRef.current.clear();
      nodeReadyInitCourseIdRef.current = currentCourseId;
      podcastCompletionMilestoneShownRef.current.clear();
    }

    const computePrimaryReady = (node: TimelineNode): boolean => {
      if (!isNodeVisibleInFlow(node)) return true;
      if (node.type === 'podcast') return Boolean(node.podcastAudioUrl?.trim());
      if (node.type === 'lecture' || node.type === 'reinforce' || node.type === 'retention') return Boolean(node.content?.trim());
      return false;
    };

    courseData.nodes.forEach((node) => {
      const prev = nodeReadySnapshotRef.current.get(node.id);
      const primaryReady = computePrimaryReady(node);
      const summaryReady = node.type === 'retention' ? Boolean(node.content?.trim()) : false;
      nextSnapshot.set(node.id, { primaryReady, summaryReady });

      if (initialForCourse || !prev) return;

      if (!prev.primaryReady && primaryReady && !node.isLoading) {
        pushBackgroundReadyToast({
          title: `${getNodeLabelForMessage(node)} Hazır`,
          message: `${node.title} bölümü arka planda hazırlandı.`,
          nodeId: node.id
        });
        triggerTabPulse(node.id);
      }

      if (node.type === 'retention' && !prev.summaryReady && summaryReady && !node.isLoading) {
        pushBackgroundReadyToast({
          title: 'Özet Hazır',
          message: 'Özet bölümü arka planda oluşturuldu.',
          nodeId: node.id
        });
      }
    });

    nodeReadySnapshotRef.current = nextSnapshot;
  }, [courseData?.id, courseData?.nodes, prefersReducedMotion]);

  useEffect(() => {
    if (!courseData?.nodes || generatingNodeId) return;

    let needsUpdate = false;
    const updatedNodes = courseData.nodes.map(node => {
      let nextDuration = node.duration;

      if (!isNodeVisibleInFlow(node)) {
        return node;
      }

      if ((node.type === 'lecture' || node.type === 'reinforce') && node.content) {
        nextDuration = `${estimateReadingMinutesFromText(node.content)} dk`;
      } else if (node.type === 'retention' && node.content) {
        nextDuration = `${Math.max(3, Math.min(6, estimateReadingMinutesFromText(node.content)))} dk`;
      } else if (node.type === 'podcast' && node.podcastScript && (!node.podcastAudioUrl || !node.duration)) {
        nextDuration = `${Math.max(3, Math.min(FREE_PLAN_LIMITS.transcriptMaxMinutes, estimatePodcastMinutesFromScript(node.podcastScript)))} dk`;
      }

      if (nextDuration && nextDuration !== node.duration) {
        needsUpdate = true;
        return { ...node, duration: nextDuration };
      }

      return node;
    });

    if (needsUpdate) {
      onUpdateCourse(updatedNodes);
    }
  }, [courseData?.nodes, generatingNodeId, onUpdateCourse]);

  const orderedTabNodes = useMemo(() => {
    return (courseData?.nodes || []).filter(isNodeVisibleInFlow);
  }, [courseData?.nodes]);
  const orderedTabNodeIdSignature = useMemo(
    () => orderedTabNodes.map((node) => node.id).join('|'),
    [orderedTabNodes]
  );

  useEffect(() => {
    if (!courseData?.id || !onEnsureCourseHydrated || !orderedTabNodes.length) return;
    const needsHydration = orderedTabNodes.some((node) => {
      if (node.type === 'podcast') return false;
      return !node.content?.trim();
    });
    if (!needsHydration) return;
    void onEnsureCourseHydrated(courseData.id);
  }, [courseData?.id, orderedTabNodeIdSignature, onEnsureCourseHydrated, orderedTabNodes]);

  useEffect(() => {
    if (deferredContentHydrationTimerRef.current !== null) {
      window.clearTimeout(deferredContentHydrationTimerRef.current);
      deferredContentHydrationTimerRef.current = null;
    }
    if (!orderedTabNodes.length) {
      setHydratedContentNodeIds([]);
      return;
    }

    const initialHydratedIds = orderedTabNodes
      .filter((node, index) => index === 0 || node.id === activeTabNodeId || !node.content?.trim())
      .map((node) => node.id);
    setHydratedContentNodeIds(initialHydratedIds);

    const queuedContentNodeIds = orderedTabNodes
      .filter((node) => Boolean(node.content?.trim()) && !initialHydratedIds.includes(node.id))
      .map((node) => node.id);

    let queueIndex = 0;
    const hydrateNextNode = () => {
      if (queueIndex >= queuedContentNodeIds.length) {
        deferredContentHydrationTimerRef.current = null;
        return;
      }
      const nextNodeId = queuedContentNodeIds[queueIndex];
      queueIndex += 1;
      setHydratedContentNodeIds((prev) => (
        prev.includes(nextNodeId) ? prev : [...prev, nextNodeId]
      ));
      deferredContentHydrationTimerRef.current = window.setTimeout(hydrateNextNode, 60);
    };

    deferredContentHydrationTimerRef.current = window.setTimeout(hydrateNextNode, 120);
    return () => {
      if (deferredContentHydrationTimerRef.current !== null) {
        window.clearTimeout(deferredContentHydrationTimerRef.current);
        deferredContentHydrationTimerRef.current = null;
      }
    };
  }, [courseData?.id, orderedTabNodeIdSignature, activeTabNodeId, orderedTabNodes]);

  useEffect(() => {
    if (!activeTabNodeId) return;
    setHydratedContentNodeIds((prev) => (
      prev.includes(activeTabNodeId) ? prev : [...prev, activeTabNodeId]
    ));
  }, [activeTabNodeId]);

  const getFlowTabLabel = (node: TimelineNode, index: number): string => {
    if (isNarrativeBook) {
      if (node.type === 'lecture') {
        if (node.title) return node.title;
        if (courseData?.bookType === 'fairy_tale') return `Masal Kısmı ${index + 1}`;
        if (courseData?.bookType === 'story') return `Hikaye Kısmı ${index + 1}`;
        if (courseData?.bookType === 'novel') return `Roman Kısmı ${index + 1}`;
        return `Bölüm ${index + 1}`;
      }
      return node.title || NODE_VISUALS[node.type]?.label || `Bölüm ${index + 1}`;
    }
    if (node.type === 'lecture') return 'Giriş';
    if (node.type === 'reinforce') return 'Detaylar';
    if (node.type === 'retention') return 'Özet';
    return NODE_VISUALS[node.type]?.label || node.title;
  };

  useEffect(() => {
    if (!orderedTabNodes.length) return;
    if (activeTabNodeId && orderedTabNodes.some((node) => node.id === activeTabNodeId)) return;
    const currentVisible = orderedTabNodes.find((node) => node.status === 'current');
    setActiveTabNodeId(currentVisible?.id || orderedTabNodes[0].id);
  }, [orderedTabNodes, activeTabNodeId]);

  useEffect(() => {
    if (!courseData?.nodes?.length) return;
    const hasLegacyAssessmentNodes = courseData.nodes.some(
      (node) => node.type === 'exam' && node.status !== 'completed'
    );
    if (!hasLegacyAssessmentNodes) return;

    updateNodes((nodes) =>
      nodes.map((node) => (
        node.type === 'exam'
          ? { ...node, status: 'completed' as const }
          : node
      ))
    );
  }, [courseData?.id, courseData?.nodes]);

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const showIosPopup = (message: string) => {
    setIosPopupMessage(message);
    if (iosPopupTimerRef.current !== null) {
      window.clearTimeout(iosPopupTimerRef.current);
    }
    iosPopupTimerRef.current = window.setTimeout(() => {
      setIosPopupMessage(null);
      iosPopupTimerRef.current = null;
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (iosPopupTimerRef.current !== null) {
        window.clearTimeout(iosPopupTimerRef.current);
      }
    };
  }, []);

  const resetQuizSession = () => {
    setCurrentQuestionIndex(0);
    setQuizScore(0);
    setQuizPercent(0);
    setQuizPassed(null);
    setQuizRetryTopics([]);
    setSelectedAnswers([]);
    setIsQuizFinished(false);
  };

  const startQuizSession = (node: TimelineNode, questions: TimelineNode['questions']) => {
    const totalQuestionCount = questions?.length || 0;
    resetQuizSession();
    setTimeRemaining(getTimeLimitForNode(node, totalQuestionCount));
    setActiveQuizNode({ ...node, questions });
  };

  useEffect(() => {
    // Quiz/exam flow has been removed from UI.
  }, [courseData, activeTabNodeId, activeQuizNode]);

  const finalizeQuizAttempt = (node: TimelineNode, answers: number[]) => {
    const total = node.questions?.length || 0;
    const score = (node.questions || []).reduce((sum, question, idx) => {
      return sum + (answers[idx] === question.correctAnswer ? 1 : 0);
    }, 0);
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = percent >= QUIZ_PASS_PERCENT;

    setQuizScore(score);
    setQuizPercent(percent);
    setQuizPassed(passed);
    setQuizRetryTopics(extractRetryTopics(node, answers));
    setIsQuizFinished(true);
    setTimeRemaining(null);
    enqueueMilestone(getQuizResultMilestone(node, passed, percent));
  };

  const jumpBackToLecture = () => {
    const lectureNode = courseData?.nodes.find((node) => node.type === 'lecture');
    setActiveQuizNode(null);
    resetQuizSession();
    if (lectureNode) {
      setActiveTabNodeId(lectureNode.id);
    }
  };

  useEffect(() => {
    if (!activeQuizNode || isQuizFinished || timeRemaining === null) return;
    if (timeRemaining <= 0) {
      finalizeQuizAttempt(activeQuizNode, selectedAnswers);
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeRemaining((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [activeQuizNode, isQuizFinished, selectedAnswers, timeRemaining]);

  const beginGen = (nodeId: string) => {
    updateNodes((nodes) =>
      nodes.map((node) => (node.id === nodeId && !node.isLoading ? { ...node, isLoading: true } : node))
    );
    setGeneratingNodeId(nodeId);
    setGenerationProgress(5);
    genTimer.current = window.setInterval(() => {
      setGenerationProgress(p => p >= 95 ? p : p + Math.floor(Math.random() * 5) + 2);
    }, 400);
  };

  const finishGen = (nodeId?: string) => {
    if (genTimer.current) clearInterval(genTimer.current);
    if (nodeId) {
      updateNodes((nodes) =>
        nodes.map((node) => (node.id === nodeId && node.isLoading ? { ...node, isLoading: false } : node))
      );
    }
    setGenerationProgress(100);
    setTimeout(() => {
      setGeneratingNodeId(null);
      setGenerationProgress(0);
    }, 300);
  };

  const updateNodes = (updater: (nodes: TimelineNode[]) => TimelineNode[]) => {
    const sourceNodes = courseData?.nodes || [];
    const updated = updater([...sourceNodes]);

    const isNoop =
      updated.length === sourceNodes.length &&
      updated.every((node, index) => node === sourceNodes[index]);

    if (isNoop) {
      return sourceNodes;
    }

    onUpdateCourse(updated);
    return updated;
  };

  const togglePodcastTranscript = (nodeId: string) => {
    setPodcastTranscriptOpenByNodeId(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const markNodeCompleted = (node: TimelineNode, patch?: Partial<TimelineNode>) => {
    const updatedNodes = updateNodes(existingNodes => {
      const completedNodes = existingNodes.map(n => {
        if (n.id === node.id) return { ...n, ...(patch || {}), status: 'completed' as const };
        if (!isNodeVisibleInFlow(n)) return { ...n, status: 'completed' as const };
        return n;
      });
      const visibleNodes = completedNodes.filter(isNodeVisibleInFlow);
      let visibleCurrentAssigned = false;

      const visibleStatusById = new Map<string, TimelineNode['status']>();
      visibleNodes.forEach((n) => {
        if (n.status === 'completed') {
          visibleStatusById.set(n.id, 'completed');
          return;
        }
        if (!visibleCurrentAssigned) {
          visibleCurrentAssigned = true;
          visibleStatusById.set(n.id, 'current');
          return;
        }
        if (n.status === 'conditional') {
          visibleStatusById.set(n.id, 'conditional');
          return;
        }
        visibleStatusById.set(n.id, 'locked');
      });

      return completedNodes.map(n => {
        if (!isNodeVisibleInFlow(n)) return n;
        const nextStatus = visibleStatusById.get(n.id) || n.status;
        return nextStatus === n.status ? n : { ...n, status: nextStatus };
      });
    });

    const nextNode = updatedNodes.find((n) => isNodeVisibleInFlow(n) && n.status === 'current' && n.id !== node.id);

    const podcastMilestoneKey = `${courseData?.id || 'course'}:${node.id}`;
    const skipDuplicatePodcastMilestone =
      node.type === 'podcast' && podcastCompletionMilestoneShownRef.current.has(podcastMilestoneKey);
    if (!skipDuplicatePodcastMilestone) {
      const milestone = getMilestoneMessageForProgress(
        { ...node, ...(patch || {}) },
        nextNode || null,
        courseData?.topic || 'Bu konu',
        typeof patch?.score === 'number' ? patch.score : undefined
      );
      enqueueMilestone(milestone);
    }

    if (!nextNode) {
      setActiveTabNodeId(node.id);
      return;
    }

    setActiveTabNodeId(nextNode.id);

    if (nextNode.type === 'podcast' && !nextNode.podcastAudioUrl) {
      if (nextNode.isLoading) {
        showIosPopup('Podcast arka planda hazırlanıyor. Birazdan hazır olacak.');
        return;
      }
      showIosPopup('Podcast paketi henüz hazır değil. Arka planda hazırlanıyor.');
      return;
    }

    if (!nextNode.content && nextNode.type !== 'podcast' && nextNode.type !== 'quiz') {
      if (nextNode.isLoading) {
        showIosPopup('Bu bölüm arka planda hazırlanıyor. Birkaç saniye sonra tekrar dene.');
        return;
      }
      showIosPopup('Bu bölüm paketi henüz hazır değil. Arka planda hazırlanıyor.');
    }
  };


  const handleTabClick = async (node: TimelineNode) => {
    if (node.status === 'locked' || node.status === 'conditional') return;

    setActiveTabNodeId(node.id);

    if (
      node.isLoading &&
      ((node.type === 'podcast' && !node.podcastAudioUrl) ||
        ((node.type === 'lecture' || node.type === 'reinforce') && !node.content) ||
        (node.type === 'retention' && !node.content))
    ) {
      showIosPopup('Bu bölüm arka planda hazırlanıyor. Birazdan tekrar dene.');
      return;
    }

    if (node.type === 'retention' && node.status === 'completed' && node.content) {
      setActiveQuizNode(null);
      return;
    }

    const needsAutoGeneration = (node.type === 'podcast' || node.type === 'quiz') ? false : !node.content;

    if (needsAutoGeneration) {
      if (courseData?.id && onEnsureCourseHydrated) {
        void onEnsureCourseHydrated(courseData.id);
      }
      showIosPopup(node.isLoading
        ? 'Bu bölüm arka planda hazırlanıyor. Birazdan tekrar dene.'
        : 'Bu bölüm paketi henüz hazır değil. Arka planda hazırlanıyor.');
    }
  };

  useEffect(() => {
    if (!allowOpenAutoGeneration) return;
    if (!courseData?.id || !orderedTabNodes.length || generatingNodeId) return;
    const currentNode =
      orderedTabNodes.find((node) => node.status === 'current') ||
      orderedTabNodes[0];
    if (!currentNode || currentNode.type !== 'lecture' || currentNode.content?.trim() || currentNode.isLoading) return;

    const attemptKey = `${courseData.id}:${currentNode.id}`;
    if (autoIntroGenerationRef.current.has(attemptKey)) return;
    autoIntroGenerationRef.current.add(attemptKey);

    if (activeTabNodeId !== currentNode.id) {
      setActiveTabNodeId(currentNode.id);
    }
    // Background packaging prepares content; tab navigation should not trigger generation.
  }, [allowOpenAutoGeneration, courseData?.id, orderedTabNodes, generatingNodeId, activeTabNodeId]);

  const handleQuizSelect = (idx: number) => {
    if (!activeQuizNode || !activeQuizNode.questions?.length) return;
    if (selectedAnswers[currentQuestionIndex] !== undefined) return;
    const isCorrect = idx === activeQuizNode.questions[currentQuestionIndex]?.correctAnswer;
    const nextAnswers = [...selectedAnswers];
    nextAnswers[currentQuestionIndex] = idx;
    setSelectedAnswers(nextAnswers);
    if (isCorrect) setQuizScore(s => s + 1);
    if (currentQuestionIndex < activeQuizNode.questions.length - 1) {
      setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), QUIZ_FEEDBACK_DELAY_MS);
    } else {
      setTimeout(() => {
        finalizeQuizAttempt(activeQuizNode, nextAnswers);
      }, QUIZ_FEEDBACK_DELAY_MS);
    }
  };

  const handleQuizContinue = async (e: React.MouseEvent, node: TimelineNode) => {
    e.stopPropagation();
    if (!activeQuizNode) return;

    const patch: Partial<TimelineNode> = { score: quizPercent };

    markNodeCompleted(node, patch);
    setActiveQuizNode(null);
  };

  const handleQuizFinishToHome = (e: React.MouseEvent, node: TimelineNode) => {
    e.stopPropagation();
    if (!activeQuizNode) return;

    const patch: Partial<TimelineNode> = { score: quizPercent };
    markNodeCompleted(node, patch);
    setActiveQuizNode(null);
    onNavigate('HOME');
  };

  const handleQuizFinishToStart = (e: React.MouseEvent, node: TimelineNode) => {
    e.stopPropagation();
    if (!activeQuizNode) return;

    const patch: Partial<TimelineNode> = { score: quizPercent };
    markNodeCompleted(node, patch);
    setActiveQuizNode(null);

    const lectureNode = courseData?.nodes.find((item) => item.type === 'lecture') || courseData?.nodes[0];
    if (lectureNode) {
      setActiveTabNodeId(lectureNode.id);
    }
  };

  const findNextNodeInOrder = (nodeId: string): TimelineNode | null => {
    if (!orderedTabNodes.length) return null;
    const idx = orderedTabNodes.findIndex((node) => node.id === nodeId);
    if (idx < 0) return null;
    return orderedTabNodes[idx + 1] || null;
  };

  const tryGoToNextSection = (node: TimelineNode, options?: { allowPodcastSkip?: boolean }) => {
    const nextNode = findNextNodeInOrder(node.id);
    if (!nextNode) {
      showIosPopup('Bu SmartBook içinde sonraki bölüm yok.');
      return;
    }

    const allowPodcastSkip = Boolean(options?.allowPodcastSkip);
    const podcastIncomplete =
      node.type === 'podcast' &&
      node.status !== 'completed' &&
      !podcastCompletedByNodeId[node.id];

    if (podcastIncomplete && !allowPodcastSkip) {
      setPodcastSkipConfirmNodeId(node.id);
      return;
    }

    if (node.status !== 'completed') {
      markNodeCompleted(node);
      return;
    }

    if (nextNode.status === 'locked' || nextNode.status === 'conditional') {
      showIosPopup('Sonraki bölümü açmak için bu bölümü tamamlamalısın.');
      return;
    }

    void handleTabClick(nextNode);
  };

  const handleGoToNextSection = (e: React.MouseEvent, node: TimelineNode) => {
    e.stopPropagation();
    tryGoToNextSection(node);
  };

  const handleConfirmPodcastSkip = () => {
    if (!podcastSkipConfirmNodeId || !orderedTabNodes.length) {
      setPodcastSkipConfirmNodeId(null);
      return;
    }

    const node = orderedTabNodes.find((item) => item.id === podcastSkipConfirmNodeId);
    setPodcastSkipConfirmNodeId(null);
    if (!node) return;

    showIosPopup('Podcast tamamlanmadan geçiş yapılıyor.');
    tryGoToNextSection(node, { allowPodcastSkip: true });
  };

  const hasNodePdfContent = (node: TimelineNode): boolean => {
    if (node.podcastScript?.trim()) return true;
    if (node.content?.trim()) return true;
    if (Array.isArray(node.questions) && node.questions.length > 0) return true;
    return false;
  };

  const canDownloadNodePdf = (node: TimelineNode): boolean => {
    const isOpenedForUser = node.status === 'completed' || node.status === 'current';
    return isOpenedForUser && hasNodePdfContent(node);
  };

  const isExportBusy = activeExportKey !== null;
  const isExportingKey = (key: string) => activeExportKey === key;

  const runExportWithSpinner = async (exportKey: string, task: () => Promise<void>) => {
    if (activeExportKey) return;
    setActiveExportKey(exportKey);
    try {
      await task();
    } finally {
      setActiveExportKey((current) => (current === exportKey ? null : current));
    }
  };

  const getFullSmartBookDownloadState = () => {
    if (!orderedTabNodes.length) {
      return { canDownload: false, reason: 'SmartBook henüz hazır değil.' };
    }

    const hasAnyNodeContentReady = orderedTabNodes.some((node) => hasNodePdfContent(node));
    if (!hasAnyNodeContentReady) {
      return {
        canDownload: false,
        reason: 'İçerik henüz hazır değil. Birkaç saniye sonra tekrar dene.'
      };
    }

    return { canDownload: true, reason: '' };
  };

  const handleFullSmartBookDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!courseData) return;
    if (isExportBusy) return;

    const downloadState = getFullSmartBookDownloadState();
    if (!downloadState.canDownload) {
      showIosPopup(downloadState.reason || 'SmartBook indir şu an kilitli.');
      return;
    }

    try {
      await runExportWithSpinner('full-pdf', async () => {
        const exportCourse: CourseData = {
          ...courseData,
          nodes: orderedTabNodes
        };
        await exportCourseToPdf(exportCourse);
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      showIosPopup('PDF indirilemedi.');
    }
  };

  const handleFullSmartBookEpubDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!courseData) return;
    if (isExportBusy) return;

    const downloadState = getFullSmartBookDownloadState();
    if (!downloadState.canDownload) {
      showIosPopup(downloadState.reason || 'SmartBook EPUB indir şu an kilitli.');
      return;
    }

    try {
      await runExportWithSpinner('full-epub', async () => {
        const exportCourse: CourseData = {
          ...courseData,
          nodes: orderedTabNodes
        };
        await exportCourseToEpub(exportCourse);
      });
    } catch (error) {
      console.error('EPUB export failed:', error);
      showIosPopup('EPUB indirilemedi.');
    }
  };

  const resolveActiveLanguageCode = (): string => {
    const explicitNormalized = normalizeAppLanguageCode(courseData?.language);
    if (explicitNormalized) return explicitNormalized;

    const explicitRaw = String(courseData?.language || '').trim().toLowerCase();
    if (explicitRaw) return explicitRaw;

    if (typeof navigator !== 'undefined') {
      const candidates = [...(navigator.languages || []), navigator.language];
      for (const candidate of candidates) {
        const normalized = normalizeAppLanguageCode(candidate);
        if (normalized) return normalized;
      }
    }

    return 'tr';
  };

  const normalizeBookTextForTts = (markdown: string): string => {
    return String(markdown || '')
      .replace(/```[\s\S]*?```/g, '\n')
      .replace(/!\[[^\]]*\]\(([^)]+)\)/g, ' ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/[*_`]/g, '')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  };

  const buildPodcastSourceContent = (): string => {
    if (!courseData?.nodes?.length) return '';
    return courseData.nodes
      .filter((node) => isNodeVisibleInFlow(node) && node.type !== 'podcast' && typeof node.content === 'string' && node.content.trim())
      .map((node) => `${node.title}\n${node.content || ''}`)
      .join('\n\n')
      .slice(0, 22000);
  };

  const buildFullBookPodcastScript = (): string => {
    const bookNodesWithContent = orderedTabNodes.filter(
      (node) => node.type !== 'podcast' && typeof node.content === 'string' && node.content.trim().length > 0
    );

    if (bookNodesWithContent.length > 0) {
      return bookNodesWithContent
        .map((section) => {
          const sectionTitle = String(section.title || '').trim();
          const sectionBody = normalizeBookTextForTts(section.content || '');
          return [sectionTitle, sectionBody].filter(Boolean).join('\n').trim();
        })
        .filter(Boolean)
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    return normalizeBookTextForTts(buildPodcastSourceContent());
  };

  const buildDetailsSourceContent = (): string => {
    if (!courseData?.nodes?.length) return '';
    const prioritized = courseData.nodes
      .filter((node) => node.type === 'lecture' || node.type === 'podcast')
      .map((node) => [node.title, node.content || node.podcastScript || ''].filter(Boolean).join('\n'))
      .filter((chunk) => chunk.trim().length > 0)
      .join('\n\n')
      .slice(0, 22000);
    if (prioritized.trim()) return prioritized;

    return courseData.nodes
      .filter((node) => node.type !== 'reinforce')
      .map((node) => [node.title, node.content || node.podcastScript || ''].filter(Boolean).join('\n'))
      .filter((chunk) => chunk.trim().length > 0)
      .join('\n\n')
      .slice(0, 22000);
  };

  const slugifySmartBookName = (value: string): string => {
    const normalized = String(value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72);
    return normalized || 'smartbook-podcast';
  };

  const getAudioExtensionFromUrl = (audioUrl: string): string => {
    try {
      const parsed = new URL(audioUrl);
      const match = parsed.pathname.match(/\.([a-z0-9]+)$/i);
      const ext = match?.[1]?.toLowerCase();
      if (ext) return ext;
    } catch {
      const clean = String(audioUrl || '').split('?')[0];
      const match = clean.match(/\.([a-z0-9]+)$/i);
      const ext = match?.[1]?.toLowerCase();
      if (ext) return ext;
    }
    return 'mp3';
  };

  const downloadAudioFile = async (audioUrl: string, fileName: string) => {
    await downloadFile({ url: audioUrl, fileName });
  };

  const getPodcastErrorMessage = (error: unknown): string => {
    const raw = String((error as { message?: string } | null)?.message || error || '');
    const normalized = raw.toLocaleLowerCase('tr-TR');
    if (
      normalized.includes('resource-exhausted') ||
      normalized.includes('quota exceeded') ||
      normalized.includes('rate limit') ||
      normalized.includes('"code":429')
    ) {
      const retryMatch = raw.match(/retry in\s+(\d+(?:\.\d+)?)s/i) || raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
      if (retryMatch) {
        const retrySeconds = Math.max(1, Math.ceil(Number.parseFloat(retryMatch[1] || '0')));
        return `${t('Podcast sırası yoğun. Sistem kota nedeniyle bekliyor; yaklaşık')} ${retrySeconds} ${t('sn sonra tekrar deneyin. Kredi iade edildi.')}`;
      }
      if (normalized.includes('podcast sırası çok yoğun')) {
        return t('Podcast sırası çok yoğun. Birkaç dakika sonra tekrar deneyin. Kredi iade edildi.');
      }
      if (normalized.includes('tts kota sınırını aşıyor')) return t('Podcast şu an oluşturulamadı, kredi iade edildi.');
      return t('Podcast kotası dolu. Sistem yoğunluğu azalınca tekrar deneyin. Kredi iade edildi.');
    }
    return t('Podcast oluşturulamadı, kredi iade edildi.');
  };

  const handlePodcastDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!courseData) return;
    if (isExportBusy) return;

    const podcastNode = getPodcastCarrierNode(courseData.nodes);
    if (!podcastNode) {
      showIosPopup('Podcast üretimi için uygun bölüm bulunamadı.');
      return;
    }

    const languageCode = resolveActiveLanguageCode();
    setHeaderPodcastLanguageCode(languageCode);
    setIsHeaderPodcastPanelOpen(true);
  };

  const handleCreatePodcast = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!courseData) return;
    if (isExportBusy) return;

    const podcastNode = getPodcastCarrierNode(courseData.nodes);
    if (!podcastNode) {
      showIosPopup('Podcast üretimi için uygun bölüm bulunamadı.');
      return;
    }

    const languageCode = resolveActiveLanguageCode();
    const fullBookScript = buildFullBookPodcastScript();
    const existingSegments = podcastNode.podcastVariants?.[languageCode]?.segments || podcastNode.podcastSegments || [];
    const existingDurationText = podcastNode.podcastVariants?.[languageCode]?.duration || podcastNode.duration || '';
    const estimatedFullMinutes = fullBookScript ? estimatePodcastMinutesFromScript(fullBookScript) : 0;
    const existingDurationMinutes = parsePodcastDurationMinutes(existingDurationText);
    const shouldRegenerateShortPodcast =
      existingSegments.length > 0 &&
      estimatedFullMinutes >= 2 &&
      existingDurationMinutes > 0 &&
      existingDurationMinutes < Math.max(2, estimatedFullMinutes * 0.7);

    if (existingSegments.length > 0 && !shouldRegenerateShortPodcast) {
      setHeaderPodcastLanguageCode(languageCode);
      return;
    }

    if (!fullBookScript) {
      showIosPopup('Podcast için seslendirilecek içerik bulunamadı.');
      return;
    }

    if (!onRequireCredit('create', PODCAST_CREATE_CREDIT_COST)) {
      showIosPopup(`${t('Podcast oluşturmak için')} ${PODCAST_CREATE_CREDIT_COST} ${t('kredi gerekir.')}`);
      return;
    }

    try {
      let resolvedAudioUrl = '';
      await runExportWithSpinner('podcast-generate', async () => {
        podcastGenerationProgressRef.current = {
          total: 0,
          completed: 0,
          currentChunkIndex: null,
          status: 'queued'
        };
        setPodcastGenerationVisualProgress((prev) => Math.max(prev, 8));
        let script = podcastNode.podcastVariants?.[languageCode]?.script || podcastNode.podcastScript || '';
        let audioUrl = podcastNode.podcastVariants?.[languageCode]?.audioUrl || podcastNode.podcastAudioUrl || '';
        let duration = podcastNode.podcastVariants?.[languageCode]?.duration || podcastNode.duration || '';
        let segments = podcastNode.podcastVariants?.[languageCode]?.segments || podcastNode.podcastSegments || [];
        let usage: PodcastUsageSummary | undefined = podcastNode.podcastVariants?.[languageCode]?.usage || podcastNode.podcastUsage;

        if (shouldRegenerateShortPodcast) {
          script = '';
          audioUrl = '';
          duration = '';
          segments = [];
          usage = undefined;
        }

        if (segments.length === 0) {
          podcastGenerationProgressRef.current = {
            total: 1,
            completed: 0,
            currentChunkIndex: null,
            status: 'queued'
          };
          setPodcastGenerationVisualProgress((prev) => Math.max(prev, 14));
          let jobState = await startPodcastAudioJob(
            courseData.topic || '',
            fullBookScript
          );
          podcastGenerationProgressRef.current = {
            total: Math.max(1, jobState.totalChunks || 1),
            completed: Math.max(0, jobState.completedChunks || 0),
            currentChunkIndex: jobState.currentChunkIndex ?? null,
            status: jobState.status
          };

          while (jobState.status === 'queued' || jobState.status === 'processing' || jobState.status === 'finalizing') {
            if (jobState.status === 'finalizing') {
              podcastGenerationProgressRef.current = {
                total: Math.max(1, jobState.totalChunks || 1),
                completed: Math.max(1, jobState.totalChunks || 1),
                currentChunkIndex: Math.max(0, (jobState.totalChunks || 1) - 1),
                status: 'finalizing'
              };
              setPodcastGenerationVisualProgress((prev) => Math.max(prev, 97));
            }

            await new Promise((resolve) => {
              window.setTimeout(resolve, 2500);
            });
            jobState = await getPodcastAudioJob(jobState.jobId);
            podcastGenerationProgressRef.current = {
              total: Math.max(1, jobState.totalChunks || 1),
              completed: Math.max(0, jobState.completedChunks || 0),
              currentChunkIndex: jobState.currentChunkIndex ?? null,
              status: jobState.status
            };
          }

          if (jobState.status === 'failed') {
            throw new Error(jobState.error || 'Podcast oluşturulamadı.');
          }

          const resolvedFullAudioUrl = jobState.audioUrl || jobState.segments[0]?.audioUrl || '';
          if (!resolvedFullAudioUrl) {
            throw new Error('Podcast sesi üretilemedi.');
          }
          podcastGenerationProgressRef.current = {
            total: Math.max(1, jobState.totalChunks || 1),
            completed: Math.max(1, jobState.totalChunks || 1),
            currentChunkIndex: Math.max(0, (jobState.totalChunks || 1) - 1),
            status: 'completed'
          };
          const fullDuration = `${Math.max(1, estimatePodcastMinutesFromScript(fullBookScript))} dk`;
          segments = [
            ...jobState.segments.map((segment, index) => ({
              id: segment.id || `segment-${index + 1}`,
              title: segment.title || `Bölüm ${index + 1}`,
              script: undefined,
              audioUrl: segment.audioUrl,
              duration: undefined
            }))
          ];
          script = fullBookScript;
          audioUrl = resolvedFullAudioUrl;
          duration = fullDuration;
          usage = {
            inputTokens: jobState.usage.inputTokens,
            outputTokens: jobState.usage.outputTokens,
            totalTokens: jobState.usage.totalTokens,
            estimatedCostUsd: jobState.usage.estimatedCostUsd,
            audioFileBytes: jobState.usage.audioFileBytes
          };

          updateNodes((nodes) =>
            nodes.map((node) => {
              if (node.id !== podcastNode.id) return node;
              return {
                ...node,
                podcastScript: script,
                podcastAudioUrl: audioUrl,
                duration,
                podcastSegments: segments,
                podcastUsage: usage,
                podcastVariants: {
                  ...(node.podcastVariants || {}),
                  [languageCode]: {
                    script,
                    audioUrl,
                    duration,
                    segments,
                    usage
                  }
                }
              };
            })
          );
          setPodcastGenerationVisualProgress((prev) => Math.max(prev, 98));
        }

        if (!audioUrl && segments.length > 0) {
          audioUrl = segments[0].audioUrl || '';
        }
        if (!audioUrl) {
          throw new Error('Podcast sesi üretilemedi.');
        }
        resolvedAudioUrl = audioUrl;
      });
      if (!resolvedAudioUrl) {
        throw new Error('Podcast sesi üretilemedi.');
      }
      setPodcastGenerationVisualProgress(100);
      setHeaderPodcastLanguageCode(languageCode);
      setIsHeaderPodcastPanelOpen(true);
      showIosPopup('Podcast hazır.');
    } catch (error) {
      console.error('Podcast download failed:', error);
      showIosPopup(getPodcastErrorMessage(error));
    }
  };

  const handleHeaderPodcastAudioDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!courseData) return;
    if (isExportBusy) return;
    const podcastNode = getPodcastCarrierNode(courseData.nodes);
    if (!podcastNode) {
      showIosPopup('Bu SmartBook için podcast bulunamadı.');
      return;
    }
    const lang = (headerPodcastLanguageCode || resolveActiveLanguageCode()).toLowerCase();
    const audioUrl = podcastNode.podcastVariants?.[lang]?.audioUrl
      || podcastNode.podcastVariants?.[lang]?.segments?.[0]?.audioUrl
      || podcastNode.podcastSegments?.[0]?.audioUrl
      || podcastNode.podcastAudioUrl
      || '';
    if (!audioUrl) {
      showIosPopup('Önce podcast oluşturmalısınız.');
      return;
    }
    const fileBase = slugifySmartBookName(courseData.topic || 'smartbook');
    const ext = getAudioExtensionFromUrl(audioUrl);
    try {
      await runExportWithSpinner('podcast-download', async () => {
        await downloadAudioFile(audioUrl, `${fileBase}-${lang}-podcast.${ext}`);
      });
    } catch (error) {
      console.error('Header podcast download failed:', error);
      showIosPopup('Podcast indirilemedi.');
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent, node?: TimelineNode) => {
    e.stopPropagation();
    if (!courseData) return;
    if (isExportBusy) return;
    if (node) {
      if (!hasNodePdfContent(node)) {
        showIosPopup('Bu bölüm için indirilecek içerik henüz hazır değil.');
        return;
      }
      if (!canDownloadNodePdf(node)) {
        showIosPopup('Sadece kullanıcıya açılmış bölümleri PDF olarak indirebilirsin.');
        return;
      }
      try {
        await runExportWithSpinner(`node-pdf:${node.id}`, async () => {
          await exportNodeToPdf(courseData, node);
        });
      } catch (error) {
        console.error('Node PDF export failed:', error);
        showIosPopup('Bölüm PDF indirilemedi.');
      }
      return;
    }
    await handleFullSmartBookDownload(e);
  };

  if (!courseData) return null;
  const headerPodcastNode = getPodcastCarrierNode(courseData.nodes);
  const effectiveHeaderPodcastLanguage = (headerPodcastLanguageCode || resolveActiveLanguageCode()).toLowerCase();
  const effectiveHeaderPodcastLanguageLabel = getAppLanguageLabel(
    normalizeAppLanguageCode(effectiveHeaderPodcastLanguage) || 'tr'
  );
  const headerPodcastVariant = headerPodcastNode?.podcastVariants?.[effectiveHeaderPodcastLanguage];
  const headerPodcastSegments = headerPodcastVariant?.segments || headerPodcastNode?.podcastSegments || [];
  const headerPodcastAudioUrl = headerPodcastVariant?.audioUrl
    || headerPodcastSegments?.[0]?.audioUrl
    || headerPodcastNode?.podcastAudioUrl
    || '';
  const headerPodcastScript = headerPodcastVariant?.script
    || headerPodcastSegments.map((segment) => segment.script || '').filter(Boolean).join('\n\n')
    || headerPodcastNode?.podcastScript
    || '';
  const headerPodcastUsage = headerPodcastVariant?.usage || headerPodcastNode?.podcastUsage;
  const hasSegmentedPodcast = headerPodcastSegments.length > 0;
  if (!orderedTabNodes.length) {
    return (
      <div className="view-container">
        <div className="app-content-width px-4 pt-6">
          <div
            className="rounded-2xl border border-dashed px-4 py-4 text-[12px]"
            style={{ background: 'rgba(17,22,29,0.84)', borderColor: 'rgba(173,149,124,0.12)', color: 'rgba(255,255,255,0.78)' }}
          >
            Bu SmartBook için görüntülenecek bölüm bulunamadı.
          </div>
        </div>
      </div>
    );
  }
  const fullSmartBookDownloadState = getFullSmartBookDownloadState();
  const canDownloadFullSmartBook = fullSmartBookDownloadState.canDownload;
  const milestoneDismissMs =
    activeMilestone && !activeMilestone.persistent
      ? getMilestoneDisplayDurationMs(activeMilestone, prefersReducedMotion)
      : 0;

  return (
    <div
      className={isReadingFullscreen ? 'h-full overflow-y-auto px-4 pb-6 pt-3 scroll-smooth' : 'view-container'}
      style={{ background: '#1A1F26', backgroundImage: 'none' }}
    >
      {false && backgroundReadyToasts.length > 0 && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+76px)] z-[58] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 space-y-2.5 pointer-events-none">
          {backgroundReadyToasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-2xl border border-dashed px-4 py-3 shadow-[0_28px_44px_-24px_rgba(0,0,0,0.95)] ${prefersReducedMotion ? '' : 'milestone-toast-in'}`}
              style={{ background: 'rgba(17,22,29,0.95)', borderColor: 'rgba(173,149,124,0.18)' }}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(86,133,190,0.16)] text-[#b7d2f0] border border-dashed border-[rgba(181,201,228,0.18)]">
                  <CheckCircle2 size={12} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold tracking-wide text-white/90 leading-snug">{toast.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/64">{toast.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {false && activeMilestone && (
        <div className="fixed inset-0 z-[59] flex items-center justify-center px-4 py-[max(16px,env(safe-area-inset-top,0px))]">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
          <div
            className={`absolute inset-0 ${prefersReducedMotion ? '' : 'milestone-overlay-aura'}`}
            style={{
              background:
                activeMilestone.tone === 'completion'
                  ? 'radial-gradient(ellipse at 50% 50%, rgba(106,163,224,0.10), rgba(0,0,0,0) 58%)'
                  : activeMilestone.tone === 'focus'
                    ? 'radial-gradient(ellipse at 50% 50%, rgba(219,194,141,0.10), rgba(0,0,0,0) 58%)'
                    : 'radial-gradient(ellipse at 50% 50%, rgba(104,186,146,0.08), rgba(0,0,0,0) 58%)'
            }}
          />
          <div
            className={`relative w-full max-w-[420px] rounded-3xl border border-dashed overflow-hidden shadow-[0_40px_90px_-42px_rgba(0,0,0,0.98)] ${prefersReducedMotion ? '' : 'milestone-overlay-in'
              } pointer-events-auto`}
            style={{
              background: activeMilestone.tone === 'completion' ? 'rgba(17,22,29,0.95)' : 'rgba(17,22,29,0.92)',
              borderColor:
                activeMilestone.tone === 'completion'
                  ? 'rgba(181,201,228,0.22)'
                  : activeMilestone.tone === 'focus'
                    ? 'rgba(173,149,124,0.16)'
                    : 'rgba(173,149,124,0.14)'
            }}
          >
            <div className="absolute inset-0 opacity-90 pointer-events-none">
              <div
                className="absolute inset-x-0 top-0 h-20"
                style={{
                  background:
                    activeMilestone.tone === 'completion'
                      ? 'linear-gradient(180deg, rgba(90,169,255,0.22), rgba(90,169,255,0))'
                      : activeMilestone.tone === 'focus'
                        ? 'linear-gradient(180deg, rgba(219,194,141,0.2), rgba(219,194,141,0))'
                        : 'linear-gradient(180deg, rgba(104,186,146,0.2), rgba(104,186,146,0))'
                }}
              />
              {!prefersReducedMotion && (activeMilestone.tone === 'success' || activeMilestone.tone === 'completion' || activeMilestone.tone === 'focus') && (
                <div className="absolute left-1/2 top-11 -translate-x-1/2 mix-blend-screen">
                  {createParticleLayout().map((p, idx) => (
                    <span
                      key={`particle-${idx}`}
                      className="absolute block rounded-[2px] milestone-particle-float"
                      style={{
                        left: `${p.x}px`,
                        top: `${p.y}px`,
                        width: `${p.w}px`,
                        height: `${p.h}px`,
                        borderRadius: p.w >= 4 ? '3px' : '2px',
                        background: getMilestoneParticlePalette(activeMilestone.tone)[idx % 4],
                        opacity: p.o,
                        animationDelay: `${p.d}ms`,
                        ['--milestone-particle-dx' as unknown as string]: `${p.dx}px`,
                        ['--milestone-particle-dy' as unknown as string]: `${p.dy}px`,
                        ['--milestone-particle-rot' as unknown as string]: `${p.r}deg`,
                        ['--milestone-particle-scale' as unknown as string]: `${p.s}`
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label={t('Bildirim kapat')}
              onClick={() => setActiveMilestone(null)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-xl border border-dashed flex items-center justify-center text-white/72 hover:text-white/92 active:scale-95"
              style={{ background: 'rgba(17,22,29,0.72)', borderColor: 'rgba(173,149,124,0.14)' }}
            >
              <X size={14} />
            </button>

            <div className={`relative px-5 pr-12 ${activeMilestone.persistent ? 'py-5' : 'py-4.5'}`}>
              <div className="flex items-start gap-3.5">
                <div
                  className="relative mt-0.5 shrink-0 h-10 w-10 rounded-2xl border border-dashed flex items-center justify-center"
                  style={{
                    background:
                      activeMilestone.tone === 'completion'
                        ? 'rgba(86,133,190,0.14)'
                        : activeMilestone.tone === 'focus'
                          ? 'rgba(173,149,124,0.12)'
                          : 'rgba(104,186,146,0.12)',
                    borderColor:
                      activeMilestone.tone === 'completion'
                        ? 'rgba(181,201,228,0.18)'
                        : activeMilestone.tone === 'focus'
                          ? 'rgba(173,149,124,0.16)'
                          : 'rgba(104,186,146,0.18)'
                  }}
                >
                  {!prefersReducedMotion && (
                    <>
                      <span
                        className="pointer-events-none absolute -inset-1.5 rounded-[18px] border milestone-icon-ring"
                        style={{
                          borderColor:
                            activeMilestone.tone === 'completion'
                              ? 'rgba(181,201,228,0.24)'
                              : activeMilestone.tone === 'focus'
                                ? 'rgba(219,194,141,0.24)'
                                : 'rgba(104,186,146,0.22)'
                        }}
                      />
                      <span
                        className="pointer-events-none absolute -inset-2.5 rounded-[20px] border milestone-icon-ring milestone-icon-ring-delay"
                        style={{
                          borderColor:
                            activeMilestone.tone === 'completion'
                              ? 'rgba(181,201,228,0.14)'
                              : activeMilestone.tone === 'focus'
                                ? 'rgba(219,194,141,0.14)'
                                : 'rgba(104,186,146,0.12)'
                        }}
                      />
                    </>
                  )}
                  <FLogo
                    size={18}
                    className={
                      activeMilestone.tone === 'completion'
                        ? 'text-[#c6ddf7]'
                        : activeMilestone.tone === 'focus'
                          ? 'text-[#dbc28d]'
                          : 'text-[#86d1a8]'
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-black tracking-wide leading-snug ${activeMilestone.tone === 'completion' ? 'text-[#d8e8fa]' : activeMilestone.tone === 'focus' ? 'text-[#ebd5aa]' : 'text-[#bfe9cf]'
                    }`}>
                    {activeMilestone.title}
                  </p>
                  <p className={`mt-1.5 leading-relaxed ${activeMilestone.persistent ? 'text-[14px] text-white/82' : 'text-[13px] text-white/74'}`}>
                    {activeMilestone.message}
                  </p>
                  {activeMilestone.nextNodeId && !activeMilestone.persistent && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-semibold text-white/75"
                      style={{ background: 'rgba(17,22,29,0.52)', borderColor: 'rgba(173,149,124,0.16)' }}
                    >
                      <ArrowRight size={11} className="text-white/55" />
                      Sonraki bölüm hazır
                    </div>
                  )}
                  {activeMilestone.persistent && (
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveMilestone(null)}
                        className="pointer-events-auto rounded-xl border border-dashed px-3.5 py-2.5 text-[12px] font-bold"
                        style={{ background: 'rgba(17,22,29,0.82)', borderColor: 'rgba(173,149,124,0.14)', color: 'rgba(255,255,255,0.82)' }}
                      >
                        Kapat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {!activeMilestone.persistent && (
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/5">
                <div
                  className={`h-full ${prefersReducedMotion ? '' : 'milestone-timer-bar'}`}
                  style={{
                    background:
                      activeMilestone.tone === 'completion'
                        ? 'rgba(143,192,244,0.9)'
                        : activeMilestone.tone === 'focus'
                          ? 'rgba(219,194,141,0.9)'
                          : 'rgba(134,209,168,0.9)',
                    animationDuration: `${Math.max(1800, milestoneDismissMs)}ms`
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      {iosPopupMessage && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+82px)] z-50 -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-white/55 bg-white/20 px-4 py-3 backdrop-blur-xl shadow-[0_18px_28px_-18px_rgba(0,0,0,0.85)]">
            <p className="text-[12px] font-semibold text-white whitespace-nowrap">{iosPopupMessage}</p>
          </div>
        </div>
      )}
      {podcastSkipConfirmNodeId && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] flex items-start justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+120px)]">
          <div
            className="w-full max-w-xs rounded-2xl border border-dashed px-4 py-4 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.9)]"
            style={{ background: 'rgba(17, 22, 29, 0.9)', borderColor: 'rgba(173,149,124,0.14)' }}
          >
            <p className="text-[12px] font-semibold leading-relaxed text-white/90">
              {t('Podcast’i tam dinlemeden geçmek istiyorsunuz. Yine de geçmek istiyor musunuz?')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPodcastSkipConfirmNodeId(null)}
                className="rounded-xl border border-dashed text-[11px] font-bold py-2"
                style={{ background: 'rgba(17, 22, 29, 0.76)', borderColor: 'rgba(173,149,124,0.12)', color: 'rgba(255,255,255,0.78)' }}
              >
                {t('Vazgeç')}
              </button>
              <button
                type="button"
                onClick={handleConfirmPodcastSkip}
                className="rounded-xl border border-dashed text-[11px] font-bold py-2"
                style={{ background: 'rgba(17, 22, 29, 0.92)', borderColor: 'rgba(181,201,228,0.2)', color: 'rgba(215,229,247,0.96)' }}
              >
                {t('Yine de Geç')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="app-content-width">
        {!isReadingFullscreen && (
          <header className="pt-0 pb-6">
            {/* Book + Info Row */}
            <div
              className="flex items-start gap-4 cursor-pointer active:scale-[0.99] transition-all px-1"
              onClick={() => setIsCourseExpanded(!isCourseExpanded)}
            >
              {/* Small Book Cover */}
              {(() => {
                const hue = Math.abs((courseData.topic || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % 360;
                const totalFlowNodes = Math.max(1, orderedTabNodes.length);
                const progress = Math.round((orderedTabNodes.filter((n) => n.status === 'completed').length / totalFlowNodes) * 100);
                return (
                  <div
                    className="shrink-0 mt-1.5 w-[72px] h-[96px] rounded-[3px] relative overflow-hidden"
                    style={courseData.coverImageUrl ? { background: 'transparent' } : { background: `linear-gradient(135deg, hsl(${hue},52%,24%), hsl(${hue},40%,13%))` }}
                  >
                    {courseData.coverImageUrl && (
                      <img
                        src={courseData.coverImageUrl}
                        alt={`${courseData.topic} ${t('SmartBook kapağı')}`}
                        className="absolute inset-0 w-full h-full object-contain object-center border-0"
                      />
                    )}
                    {!courseData.coverImageUrl && (
                      <>
                        <div className="absolute left-0 top-0 bottom-0 w-[4px] opacity-50" style={{ background: `hsl(${hue},60%,55%)` }} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                          <FLogo size={32} />
                        </div>
                      </>
                    )}
                    <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 ${progressPulse && !prefersReducedMotion ? 'milestone-progress-pulse' : ''}`}>
                      <div className="h-full" style={{ width: `${progress}%`, background: `hsl(${hue},65%,58%)` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Info */}
              <div className="flex-1 min-w-0 pt-0.5">
                <h1 className="text-base font-bold text-white leading-snug line-clamp-2 pr-1 mb-1">{courseData.topic}</h1>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-white/45">{t(courseData.category || 'Akademik')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#b9cde8]">{t(getSmartBookAgeGroupLabel(courseData.ageGroup))}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-accent-green">{calculateTotalDuration(orderedTabNodes)}</span>
                  </div>
                  {courseData.createdAt && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-white/25">
                        {new Date(courseData.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
                {(() => {
                  const isFullPdfExporting = isExportingKey('full-pdf');
                  const isFullEpubExporting = isExportingKey('full-epub');
                  const isPodcastExporting = isExportingKey('podcast-generate');
                  const isPodcastDownloadExporting = isExportingKey('podcast-download');
                  const hasHeaderPodcastAudio = Boolean(headerPodcastAudioUrl);
                  return (
                    <div className="mt-3 -ml-[88px] w-[calc(100%+88px)]">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={handleFullSmartBookDownload}
                          disabled={isExportBusy || !canDownloadFullSmartBook}
                          className={`group flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-2 rounded-xl border border-dashed transition-all whitespace-nowrap ${canDownloadFullSmartBook
                            ? 'text-white hover:-translate-y-[1px] active:scale-95'
                            : 'bg-[#162031] border border-dashed border-[#5a7392]/35 text-white/55'
                            } ${isExportBusy ? 'opacity-85 cursor-wait' : ''}`}
                          style={canDownloadFullSmartBook
                            ? {
                              background: 'linear-gradient(135deg, rgba(28,57,91,0.98) 0%, rgba(22,42,67,0.96) 100%)',
                              borderColor: 'rgba(143,197,255,0.45)',
                              boxShadow: 'inset 0 0 0 1px rgba(130,179,235,0.24), 0 6px 14px rgba(11,23,38,0.28)'
                            }
                            : undefined}
                          title={canDownloadFullSmartBook ? t('Fortale PDF') : fullSmartBookDownloadState.reason}
                          aria-label={canDownloadFullSmartBook ? t('Fortale PDF') : t('Fortale PDF kilitli')}
                        >
                          {isFullPdfExporting ? (
                            <DownloadCircleSpinner size={16} />
                          ) : canDownloadFullSmartBook ? (
                            <Download size={14} className="text-[#d9ecff] transition-transform duration-200 group-hover:scale-110" />
                          ) : (
                            <Lock size={13} className="text-white/55" />
                          )}
                          <span className={`text-[10px] font-bold leading-none ${canDownloadFullSmartBook ? 'text-[#e2f1ff]' : 'text-white/55'}`}>
                            {isFullPdfExporting ? t('Hazırlanıyor') : t('Fortale PDF')}
                          </span>
                        </button>

                        <button
                          onClick={handleFullSmartBookEpubDownload}
                          disabled={isExportBusy || !canDownloadFullSmartBook}
                          className={`group flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-2 rounded-xl border border-dashed transition-all whitespace-nowrap ${canDownloadFullSmartBook
                            ? 'text-white hover:-translate-y-[1px] active:scale-95'
                            : 'bg-[#162031] border border-dashed border-[#5a7392]/35 text-white/55'
                            } ${isExportBusy ? 'opacity-85 cursor-wait' : ''}`}
                          style={canDownloadFullSmartBook
                            ? {
                              background: 'linear-gradient(135deg, rgba(28,57,91,0.98) 0%, rgba(22,42,67,0.96) 100%)',
                              borderColor: 'rgba(143,197,255,0.45)',
                              boxShadow: 'inset 0 0 0 1px rgba(130,179,235,0.24), 0 6px 14px rgba(11,23,38,0.28)'
                            }
                            : undefined}
                          title={canDownloadFullSmartBook ? t('Fortale ePub') : fullSmartBookDownloadState.reason}
                          aria-label={canDownloadFullSmartBook ? t('Fortale ePub') : t('Fortale ePub kilitli')}
                        >
                          {isFullEpubExporting ? (
                            <DownloadCircleSpinner size={16} />
                          ) : canDownloadFullSmartBook ? (
                            <Download size={14} className="text-[#d9ecff] transition-transform duration-200 group-hover:scale-110" />
                          ) : (
                            <Lock size={13} className="text-white/55" />
                          )}
                          <span className={`text-[10px] font-bold leading-none ${canDownloadFullSmartBook ? 'text-[#e2f1ff]' : 'text-white/55'}`}>
                            {isFullEpubExporting ? t('Hazırlanıyor') : t('Fortale ePub')}
                          </span>
                        </button>

                        <button
                          onClick={handlePodcastDownload}
                          disabled={isExportBusy}
                          className={`group flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-2 rounded-xl border border-dashed transition-all whitespace-nowrap ${isExportBusy ? 'opacity-85 cursor-wait' : 'hover:-translate-y-[1px] active:scale-95'
                            }`}
                          style={{
                            background: 'linear-gradient(135deg, rgba(31,64,102,0.98) 0%, rgba(24,46,72,0.96) 100%)',
                            borderColor: 'rgba(171,214,255,0.5)',
                            boxShadow: 'inset 0 0 0 1px rgba(145,191,244,0.24), 0 6px 14px rgba(11,23,38,0.28)'
                          }}
                          title={hasHeaderPodcastAudio ? t('Podcast aç') : t('Podcast')}
                          aria-label={hasHeaderPodcastAudio ? t('Podcast aç') : t('Podcast')}
                        >
                          {isPodcastExporting ? (
                            <DownloadCircleSpinner size={16} />
                          ) : (
                            <AudioLines size={14} className="text-[#d9ecff] transition-transform duration-200 group-hover:scale-110" />
                          )}
                          <span className="text-[10px] font-bold leading-none text-[#e2f1ff]">
                            {isPodcastExporting
                              ? t('Oluşturuluyor')
                              : t('Podcast')}
                          </span>
                        </button>
                      </div>
                      {isPodcastExporting && (
                        <div
                          className="mt-2 rounded-2xl border border-dashed p-3"
                          style={{
                            background: 'linear-gradient(160deg, rgba(24,38,57,0.92) 0%, rgba(17,22,29,0.94) 55%, rgba(14,24,38,0.95) 100%)',
                            borderColor: 'rgba(120,171,226,0.34)',
                            boxShadow: 'inset 0 0 0 1px rgba(93,128,168,0.18)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative h-[116px] w-full">
                            <div
                              className="absolute inset-0 rounded-2xl border border-dashed overflow-hidden"
                              style={{
                                background: 'linear-gradient(135deg, rgba(32,61,95,0.98) 0%, rgba(20,38,60,0.98) 52%, rgba(14,28,44,0.98) 100%)',
                                borderColor: 'rgba(181,218,255,0.42)',
                                animation: 'fortale-book-glow 2.2s ease-in-out infinite'
                              }}
                            >
                              <div className="absolute inset-0 flex items-center justify-between px-4">
                                {Array.from({ length: 24 }).map((_, idx) => (
                                  <span
                                    key={`podcast-gen-${idx}`}
                                    className="w-[4px] rounded-full"
                                    style={{
                                      height: `${14 + ((idx % 6) * 3)}px`,
                                      background: ['#f3d156', '#82d96a', '#67d6ff', '#ff6b6b'][idx % 4],
                                      animation: 'podcast-eq-bar 900ms ease-in-out infinite',
                                      animationDelay: `${idx * 48}ms`
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <p className="mt-2 text-center text-[11px] font-bold text-white">{t('Podcast oluşturuluyor...')}</p>
                          <div className="mt-2 h-2 rounded-full bg-[#102033] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.max(8, Math.min(100, podcastGenerationVisualProgress))}%`,
                                background: 'linear-gradient(90deg, #f3d156 0%, #82d96a 28%, #67d6ff 58%, #ff6b6b 82%, #7fa8ff 100%)'
                              }}
                            />
                          </div>
                          <p className="mt-1 text-center text-[10px] text-[#c9e1fb]">%{Math.max(8, Math.min(100, Math.round(podcastGenerationVisualProgress)))}</p>
                          <p className="mt-1 text-center text-[10px] text-[#afcceb]">
                            {getPodcastGenerationStatusText()}
                          </p>
                          <p className="mt-1 text-center text-[10px] text-[#afcceb]">
                            {t('Kitabın uzunluğuna göre bu işlem birkaç dakika sürebilir.')}
                          </p>
                          <div className="mt-1 flex items-center justify-center">
                            <FaviconSpinner size={24} />
                          </div>
                        </div>
                      )}
                      {isHeaderPodcastPanelOpen && !isPodcastExporting && (
                        <div
                          className="mt-2 rounded-2xl border border-dashed p-2"
                          style={{
                            background: 'linear-gradient(160deg, rgba(24,38,57,0.9) 0%, rgba(17,22,29,0.9) 56%, rgba(14,24,38,0.93) 100%)',
                            borderColor: 'rgba(120,171,226,0.3)',
                            boxShadow: 'inset 0 0 0 1px rgba(93,128,168,0.14)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-2 px-1 text-[10px] font-bold text-[#cde4fb]">
                            {t('Podcast')} ({effectiveHeaderPodcastLanguageLabel})
                          </div>
                          {!!headerPodcastUsage && (
                            <div className="mb-2 grid grid-cols-2 gap-1.5 px-1 text-[10px] text-[#d9ecff] sm:grid-cols-4">
                              <div className="rounded-xl border border-dashed px-2 py-1" style={{ borderColor: 'rgba(120,171,226,0.24)', background: 'rgba(13,24,38,0.45)' }}>
                                <div className="text-[9px] tracking-[0.08em] text-[#8cb2d9]">{t('Maliyet')}</div>
                                <div className="mt-0.5 font-bold text-white">{formatPodcastUsd(headerPodcastUsage.estimatedCostUsd)}</div>
                              </div>
                              <div className="rounded-xl border border-dashed px-2 py-1" style={{ borderColor: 'rgba(120,171,226,0.24)', background: 'rgba(13,24,38,0.45)' }}>
                                <div className="text-[9px] tracking-[0.08em] text-[#8cb2d9]">{t('Toplam Token')}</div>
                                <div className="mt-0.5 font-bold text-white">{formatPodcastTokenCount(headerPodcastUsage.totalTokens, locale)}</div>
                              </div>
                              <div className="rounded-xl border border-dashed px-2 py-1" style={{ borderColor: 'rgba(120,171,226,0.24)', background: 'rgba(13,24,38,0.45)' }}>
                                <div className="text-[9px] tracking-[0.08em] text-[#8cb2d9]">{t('Girdi / Çıktı')}</div>
                                <div className="mt-0.5 font-bold text-white">
                                  {formatPodcastTokenCount(headerPodcastUsage.inputTokens, locale)} / {formatPodcastTokenCount(headerPodcastUsage.outputTokens, locale)}
                                </div>
                              </div>
                              <div className="rounded-xl border border-dashed px-2 py-1" style={{ borderColor: 'rgba(120,171,226,0.24)', background: 'rgba(13,24,38,0.45)' }}>
                                <div className="text-[9px] tracking-[0.08em] text-[#8cb2d9]">{t('Dosya')}</div>
                                <div className="mt-0.5 font-bold text-white">{formatPodcastFileSize(headerPodcastUsage.audioFileBytes)}</div>
                              </div>
                            </div>
                          )}
                          {(headerPodcastAudioUrl && hasSegmentedPodcast) ? (
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <PodcastInlinePlayer
                                  script={headerPodcastScript}
                                  audio={{ audioUrl: headerPodcastAudioUrl, segments: headerPodcastSegments }}
                                  transcriptOpen={headerPodcastNode ? !!podcastTranscriptOpenByNodeId[headerPodcastNode.id] : false}
                                  onToggleTranscript={() => {
                                    if (headerPodcastNode) togglePodcastTranscript(headerPodcastNode.id);
                                  }}
                                  onDurationResolved={(seconds) => {
                                    if (!headerPodcastNode) return;
                                    const formatted = formatPodcastDurationFromSeconds(seconds, t);
                                    if (headerPodcastNode.duration === formatted) return;
                                    updateNodes((nodes) =>
                                      nodes.map((node) =>
                                        node.id === headerPodcastNode.id && node.duration !== formatted
                                          ? { ...node, duration: formatted }
                                          : node
                                      )
                                    );
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleHeaderPodcastAudioDownload}
                                disabled={isExportBusy}
                                className={`mt-1 h-10 w-10 rounded-xl border border-dashed inline-flex items-center justify-center active:scale-95 ${isExportBusy ? 'opacity-85 cursor-wait' : ''}`}
                                style={{
                                  borderColor: 'rgba(143,197,255,0.46)',
                                  background: 'linear-gradient(135deg, rgba(31,64,102,0.98) 0%, rgba(24,46,72,0.96) 100%)',
                                  color: 'rgba(225,240,255,0.95)',
                                  boxShadow: 'inset 0 0 0 1px rgba(130,179,235,0.22), 0 4px 10px rgba(11,23,38,0.24)'
                                }}
                                aria-label={t('Podcast indir')}
                                title={t('Podcast indir')}
                              >
                                {isPodcastDownloadExporting ? <DownloadCircleSpinner size={15} /> : <Download size={15} />}
                              </button>
                            </div>
                          ) : (
                            <div
                              className="rounded-xl border border-dashed px-3 py-3"
                              style={{
                                borderColor: 'rgba(120,171,226,0.24)',
                                background: 'rgba(13,24,38,0.45)'
                              }}
                            >
                              <p className="text-[11px] text-[#b9d3ee]">
                                {headerPodcastAudioUrl && !hasSegmentedPodcast
                                  ? t('Eski kısa podcast bulundu. Tam kitap podcast için yeniden oluşturun.')
                                  : t('Podcast henüz hazır değil.')}
                              </p>
                              <button
                                type="button"
                                onClick={handleCreatePodcast}
                                disabled={isExportBusy}
                                className={`mt-2 h-14 w-full rounded-2xl border border-dashed px-3 inline-flex items-center justify-between transition-all overflow-hidden relative ${isExportBusy ? 'opacity-80 cursor-wait' : 'hover:-translate-y-[1px] hover:shadow-[0_10px_20px_rgba(26,71,116,0.36)] active:scale-[0.99]'}`}
                                style={{
                                  background: 'linear-gradient(120deg, rgba(20,62,104,0.99) 0%, rgba(35,92,147,0.98) 48%, rgba(46,112,172,0.98) 100%)',
                                  borderColor: 'rgba(255,217,122,0.78)',
                                  color: '#ffffff',
                                  boxShadow: 'inset 0 0 0 1px rgba(173,218,255,0.28), 0 8px 16px rgba(18,44,74,0.34)'
                                }}
                              >
                                <div
                                  className="pointer-events-none absolute inset-0"
                                  style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 36%, rgba(10,26,45,0.08) 100%)' }}
                                />
                                <span className="relative inline-flex items-center gap-2 min-w-0">
                                  <span
                                    className="h-7 w-7 shrink-0 rounded-xl inline-flex items-center justify-center border border-dashed"
                                    style={{
                                      borderColor: 'rgba(255,228,164,0.7)',
                                      background: 'rgba(12,28,48,0.34)'
                                    }}
                                  >
                                    {isExportBusy ? <DownloadCircleSpinner size={13} /> : <AudioLines size={13} className="text-[#fff3cf]" />}
                                  </span>
                                  <span className="min-w-0 text-left leading-tight">
                                    <span className="block text-[13px] font-black tracking-[0.01em] truncate" style={{ textShadow: '0 1px 1px rgba(8,20,35,0.72)' }}>
                                      {headerPodcastAudioUrl && !hasSegmentedPodcast ? t('Tam Kitap Podcast Oluştur') : t('Podcast Oluştur')}
                                    </span>
                                    <span className="block mt-1 text-[11px] font-semibold text-[#eef6ff] truncate" style={{ textShadow: '0 1px 1px rgba(8,20,35,0.62)' }}>
                                      {isExportBusy ? t('Hazırlanıyor...') : t('Tek parça sesli anlatım')}
                                    </span>
                                  </span>
                                </span>
                                <span
                                  className="relative ml-2 shrink-0 h-8 px-2.5 rounded-xl border border-dashed inline-flex items-center justify-center text-[11px] font-black"
                                  style={{
                                    borderColor: 'rgba(255,224,147,0.72)',
                                    background: 'rgba(9,24,40,0.52)',
                                    color: '#fff4d0'
                                  }}
                                >
                                  {PODCAST_CREATE_CREDIT_COST} {t('kredi')}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-2 border-t border-dashed" style={{ borderColor: 'rgba(120,171,226,0.22)' }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          </header>
        )}

        <section className={`mt-3 animate-enter flex-1 ${isReadingFullscreen ? 'pb-6' : 'pb-24'}`}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsReadingFullscreen((current) => !current)}
              className={`h-9 w-9 rounded-xl border border-dashed flex items-center justify-center text-white/80 transition-all duration-200 active:scale-95 ${isReadingFullscreen
                ? 'fixed right-4 z-[95]'
                : 'absolute right-0 -top-1 z-20'
                }`}
              style={isReadingFullscreen
                ? {
                  top: 'var(--app-header-row-top)',
                  background: 'rgba(17,22,29,0.78)',
                  borderColor: 'rgba(173,149,124,0.16)'
                }
                : {
                  background: 'rgba(17,22,29,0.78)',
                  borderColor: 'rgba(173,149,124,0.16)'
                }}
              aria-label={isReadingFullscreen ? t('Tam ekrandan çık') : t('Tam ekran okuma')}
              title={isReadingFullscreen ? t('Tam ekrandan çık') : t('Tam ekran okuma')}
            >
              {isReadingFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <div className={`${isReadingFullscreen ? 'pt-11' : 'pt-9'} space-y-7`}>
              {orderedTabNodes.map((node, index) => {
                const sectionTitle = getFlowTabLabel(node, index);
                const isLocked = (node.status === 'locked' || node.status === 'conditional') && !node.content;
                const isGen = generatingNodeId === node.id;
                const isBackgroundPreparing = Boolean(node.isLoading && !isGen);
                const showNodeSubtitle = Boolean(node.title && !isSameSectionHeading(node.title, sectionTitle));
                const isContentHydrated = !node.content || hydratedContentNodeIds.includes(node.id);
                const displayContent = isContentHydrated && node.content
                  ? stripLeadingDuplicateSectionHeadings(node.content, [sectionTitle, node.title])
                  : '';
                const visualProgress = isGen ? generationProgress : 36;
                const showGenerateButton =
                  !node.content &&
                  !isLocked &&
                  (node.type === 'lecture' || node.type === 'reinforce' || node.type === 'retention') &&
                  !node.isLoading &&
                  !isGen;

                return (
                  <article
                    key={node.id}
                    className="px-0 py-1.5 border-b border-dashed"
                    style={{ borderColor: 'rgba(173,149,124,0.12)' }}
                  >
                    {!isReadingFullscreen && (
                      <header className="mb-4 border-b border-dashed pb-3" style={{ borderColor: 'rgba(173,149,124,0.12)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-base md:text-[17px] font-bold text-white/95 leading-[1.3]">{sectionTitle}</h2>
                          <span className="text-[11px] font-bold text-white/55">{formatLocalizedDurationLabel(node.duration, t)}</span>
                        </div>
                        {showNodeSubtitle && (
                          <p className="mt-1 text-[11px] md:text-[12px] text-white/60">{node.title}</p>
                        )}
                      </header>
                    )}

                    {isLocked && !isReadingFullscreen && (
                      <div
                        className="rounded-xl border border-dashed px-3 py-3 text-[12px] leading-relaxed text-white/70"
                        style={{ background: 'rgba(17,22,29,0.66)', borderColor: 'rgba(173,149,124,0.12)' }}
                      >
                        Bu bölüm henüz açık değil. Önce önceki bölümlerin hazırlanması tamamlanmalı.
                      </div>
                    )}

                    {!isLocked && !isReadingFullscreen && (isGen || isBackgroundPreparing) && (
                      <div className="space-y-4 py-6 max-w-[300px] mx-auto text-center">
                        <div className="w-16 h-16 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mx-auto">
                          <FaviconSpinner size={30} />
                        </div>
                        <h3 className="text-sm font-bold text-white/90">{t('İçerik Hazırlanıyor')}</h3>
                        <p className="text-[11px] text-white/45 leading-relaxed">
                          {isBackgroundPreparing
                            ? t('Bu bölüm arka planda hazırlanıyor. Hazır olduğunda içerik burada görünecek.')
                            : t('İçerik üretiliyor. Lütfen bekleyin.')}
                        </p>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
                          <div className="h-full bg-accent-green transition-all duration-300" style={{ width: `${visualProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {!isLocked && node.content && isContentHydrated && (
                      <StyledMarkdown
                        content={displayContent}
                        variant="inline"
                        className="text-sm md:text-[15px]"
                        quoteFirstParagraph={node.type === 'lecture'}
                      />
                    )}
                    {!isLocked && node.content && !isContentHydrated && (
                      <div
                        className="rounded-xl border border-dashed px-3 py-3 text-[12px] leading-relaxed text-white/64"
                        style={{ background: 'rgba(17,22,29,0.64)', borderColor: 'rgba(173,149,124,0.12)' }}
                      >
                        {t('Bölüm yükleniyor...')}
                      </div>
                    )}

                    {showGenerateButton && !isReadingFullscreen && (
                      <div className="flex flex-col items-center justify-center py-6">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            beginGen(node.id);
                            try {
                              let narrativeContext: any = undefined;

                              if (node.type === 'lecture' && isNarrativeBook && courseData) {
                                const allLectures = courseData.nodes.filter(n => n.type === 'lecture');
                                const totalLectures = allLectures.length;
                                const currentLectureIndex = allLectures.findIndex(n => n.id === node.id) + 1;

                                const nodeIndex = courseData.nodes.findIndex(n => n.id === node.id);
                                const previousLectureNodes = courseData.nodes
                                  .slice(0, Math.max(0, nodeIndex))
                                  .filter(chapter => chapter.type === 'lecture' && Boolean(chapter.content?.trim()));
                                const normalizeContextChapterText = (value: string | undefined): string => String(value || '')
                                  .replace(/!\[[^\]]*]\((?:data:image\/[^)]+|https?:\/\/[^)]+)\)/gi, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim();
                                const previousChapterContent = previousLectureNodes.length > 0
                                  ? normalizeContextChapterText(previousLectureNodes[previousLectureNodes.length - 1].content).slice(-2800)
                                  : undefined;
                                const storySoFarContent = previousLectureNodes.length > 0
                                  ? previousLectureNodes
                                    .map((chapter, chapterIndex) => {
                                      const chapterText = normalizeContextChapterText(chapter.content);
                                      if (!chapterText) return '';
                                      return `[Bölüm ${chapterIndex + 1} - ${chapter.title}]\n${chapterText.slice(0, 1800)}`;
                                    })
                                    .filter(Boolean)
                                    .join('\n\n')
                                    .slice(-8200)
                                    .trim()
                                  : undefined;

                                narrativeContext = {
                                  outlinePositions: { current: currentLectureIndex, total: totalLectures },
                                  previousChapterContent,
                                  storySoFarContent
                                };
                              }

                              const generationPayload = {
                                bookType: courseData?.bookType,
                                subGenre: courseData?.subGenre,
                                targetPageCount: courseData?.targetPageCount,
                                creativeBrief: courseData?.creativeBrief,
                                narrativeContext
                              };
                              let content: string;
                              if (node.type === 'reinforce') {
                                const detailsSource = buildDetailsSourceContent();
                                content = await generateRemedialContent(
                                  courseData?.topic || '',
                                  detailsSource || undefined,
                                  courseData?.ageGroup,
                                  generationPayload
                                );
                              } else if (node.type === 'retention') {
                                const sourceContent = (courseData?.nodes || [])
                                  .map((n) => [n.title, n.content || n.podcastScript || ''].filter(Boolean).join('\n'))
                                  .join('\n\n')
                                  .slice(0, 22000);
                                content = await generateSummaryCard(
                                  courseData?.topic || '',
                                  sourceContent,
                                  courseData?.ageGroup,
                                  generationPayload
                                );
                              } else {
                                content = await generateLectureContent(
                                  courseData?.topic || '',
                                  node.title,
                                  courseData?.ageGroup,
                                  generationPayload
                                );
                              }
                              let mins = estimateReadingMinutesFromText(content);
                              if (node.type === 'reinforce') {
                                const lectureNode = courseData?.nodes.find((n) => n.type === 'lecture');
                                const lectureMins = lectureNode?.duration ? parseInt(lectureNode.duration, 10) || 0 : 0;
                                if (mins > lectureMins && lectureMins > 0) mins = Math.max(2, lectureMins - 1);
                              } else if (node.type === 'retention') {
                                mins = Math.max(3, Math.min(6, mins));
                              }
                              updateNodes((nodes) =>
                                nodes.map((n) =>
                                  n.id === node.id ? { ...n, content, duration: `${mins} dk` } : n
                                )
                              );
                            } catch (err) {
                              alert(getUserFacingError(err, t('İçerik oluşturulamadı.')));
                            } finally {
                              finishGen(node.id);
                            }
                          }}
                          className="px-8 py-3.5 btn-glass-primary shadow-lg text-[13px] font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                        >
                          <Compass size={18} />{
                            node.type === 'retention'
                              ? (isNarrativeBook ? t('Sonucu Oluştur') : t('Özeti Oluştur'))
                              : (node.type === 'reinforce' && isNarrativeBook ? t('Gelişmeyi Oluştur') : t('İçeriği Oluştur'))
                          }
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

interface PodcastInlinePlayerProps {
  script: string;
  audio: {
    audioUrl?: string;
    segments?: Array<{
      id?: string;
      title?: string;
      audioUrl?: string;
      script?: string;
      duration?: string;
    }>;
  };
  transcriptOpen: boolean;
  onToggleTranscript: () => void;
  onCompleted?: () => void;
  onDurationResolved?: (seconds: number) => void;
}

function PodcastInlinePlayer({
  script,
  audio,
  transcriptOpen,
  onToggleTranscript,
  onCompleted,
  onDurationResolved
}: PodcastInlinePlayerProps) {
  const { t } = useUiI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const normalizedAudioSegments = useMemo(
    () =>
      Array.isArray(audio?.segments)
        ? audio.segments
          .filter((segment) => typeof segment?.audioUrl === 'string' && segment.audioUrl.trim().length > 0)
          .map((segment, index) => ({
            id: segment.id || `segment-${index + 1}`,
            title: segment.title || `${t('Bölüm')} ${index + 1}`,
            audioUrl: String(segment.audioUrl || '').trim()
          }))
        : [],
    [audio, t]
  );
  const baseAudioSrc = useMemo(() => String(audio?.audioUrl || '').trim(), [audio]);
  const [activeAudioSegmentIndex, setActiveAudioSegmentIndex] = useState(0);
  const [completionNotified, setCompletionNotified] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const lastReportedDurationRef = useRef<number | null>(null);
  const shouldAutoPlayNextRef = useRef(false);

  const audioSegmentKey = useMemo(
    () => normalizedAudioSegments.map((segment) => segment.audioUrl).join('|'),
    [normalizedAudioSegments]
  );
  const currentAudioSrc = normalizedAudioSegments.length > 0
    ? (normalizedAudioSegments[activeAudioSegmentIndex]?.audioUrl || '')
    : baseAudioSrc;
  const canShowTranscript = Boolean(String(script || '').trim());
  const activeSegmentTitle = normalizedAudioSegments.length > 0
    ? (normalizedAudioSegments[activeAudioSegmentIndex]?.title || `${t('Parça')} ${activeAudioSegmentIndex + 1}`)
    : t('Tam Podcast');

  useEffect(() => {
    setActiveAudioSegmentIndex(0);
    setCompletionNotified(false);
    setIsAudioPlaying(false);
    shouldAutoPlayNextRef.current = false;
  }, [baseAudioSrc, audioSegmentKey]);

  useEffect(() => {
    lastReportedDurationRef.current = null;
  }, [currentAudioSrc]);

  useEffect(() => {
    if (!shouldAutoPlayNextRef.current) return;
    const el = audioRef.current;
    if (!el || !currentAudioSrc) {
      shouldAutoPlayNextRef.current = false;
      return;
    }
    const playPromise = el.play();
    if (playPromise && typeof (playPromise as Promise<void>).catch === 'function') {
      (playPromise as Promise<void>).catch(() => {
        // Autoplay can be blocked by browser policy; user can press play manually.
      });
    }
    shouldAutoPlayNextRef.current = false;
  }, [currentAudioSrc]);

  const maybeNotifyCompleted = () => {
    const el = audioRef.current;
    if (!el || completionNotified) return;
    const duration = el.duration;
    const currentTime = el.currentTime;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return;
    const ratio = currentTime / duration;
    const remaining = duration - currentTime;
    if (ratio >= 0.96 || remaining <= 2) {
      setCompletionNotified(true);
      onCompleted?.();
    }
  };

  return (
    <div
      className="rounded-xl border border-dashed p-3 space-y-3"
      style={{ background: 'rgba(17,22,29,0.86)', borderColor: 'rgba(173,149,124,0.12)' }}
    >
      <div className="relative flex items-center justify-between gap-2 pr-1">
        <span className="flex items-center gap-2 text-[11px] font-bold text-white/72">
          <AudioLines size={12} className="text-white/80" />
          {t('Podcast Oynatıcı')}
        </span>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center justify-center gap-[3px] h-3.5 min-w-[98px] opacity-90">
            {[
              '#b8d0eb', '#dbc28d', '#e1a698', '#bfd0e6',
              '#cdb08c', '#a7bed8', '#e1a698', '#b8d0eb',
              '#dbc28d', '#bfd0e6', '#e1a698', '#a7bed8',
              '#cdb08c', '#b8d0eb', '#e1a698', '#bfd0e6'
            ].map((color, idx) => (
              <span
                key={`eq-${idx}`}
                className="w-[2px] rounded-full"
                style={{
                  height: `${6 + (idx % 4)}px`,
                  backgroundColor: color,
                  transformOrigin: 'center',
                  animation: 'podcast-eq-bar 780ms ease-in-out infinite',
                  animationDelay: `${idx * 70}ms`,
                  animationPlayState: isAudioPlaying ? 'running' : 'paused',
                  opacity: isAudioPlaying ? 1 : 0.45
                }}
              />
            ))}
          </div>
        </div>
        <span className="text-[10px] font-bold text-white/55">
          {normalizedAudioSegments.length > 0
            ? `${activeAudioSegmentIndex + 1}/${normalizedAudioSegments.length}`
            : '1/1'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-white/70 truncate">{activeSegmentTitle}</p>
        {canShowTranscript && (
          <button
            type="button"
            onClick={onToggleTranscript}
            className="h-7 rounded-lg border border-dashed px-2 text-[10px] font-bold inline-flex items-center justify-center"
            style={{ borderColor: 'rgba(181,201,228,0.22)', color: 'rgba(215,229,247,0.96)', background: 'rgba(17,22,29,0.92)' }}
          >
            {transcriptOpen ? t('Metni Gizle') : t('Metni Göster')}
          </button>
        )}
      </div>

      <audio
        ref={audioRef}
        src={currentAudioSrc}
        controls
        onLoadedMetadata={() => {
          const duration = audioRef.current?.duration;
          if (!duration || !Number.isFinite(duration)) return;
          const rounded = Math.round(duration);
          if (lastReportedDurationRef.current === rounded) return;
          lastReportedDurationRef.current = rounded;
          onDurationResolved?.(rounded);
        }}
        onPlay={() => setIsAudioPlaying(true)}
        onPause={() => {
          setIsAudioPlaying(false);
          maybeNotifyCompleted();
        }}
        onSeeked={maybeNotifyCompleted}
        onTimeUpdate={maybeNotifyCompleted}
        onEnded={() => {
          if (normalizedAudioSegments.length > 0 && activeAudioSegmentIndex < normalizedAudioSegments.length - 1) {
            shouldAutoPlayNextRef.current = true;
            setActiveAudioSegmentIndex((current) => current + 1);
            return;
          }
          setIsAudioPlaying(false);
          if (!completionNotified) {
            setCompletionNotified(true);
            onCompleted?.();
          }
        }}
        className="w-full h-8 opacity-70 invert grayscale"
      />

      {normalizedAudioSegments.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setActiveAudioSegmentIndex((current) => Math.max(0, current - 1))}
            disabled={activeAudioSegmentIndex <= 0}
            className="h-8 rounded-lg border border-dashed px-3 text-[10px] font-bold disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ borderColor: 'rgba(181,201,228,0.22)', color: 'rgba(215,229,247,0.96)', background: 'rgba(17,22,29,0.92)' }}
          >
            {t('Önceki Parça')}
          </button>
          <span className="text-[10px] text-white/55">
            {activeAudioSegmentIndex + 1}. {t('parça')}
          </span>
          <button
            type="button"
            onClick={() => setActiveAudioSegmentIndex((current) => Math.min(normalizedAudioSegments.length - 1, current + 1))}
            disabled={activeAudioSegmentIndex >= normalizedAudioSegments.length - 1}
            className="h-8 rounded-lg border border-dashed px-3 text-[10px] font-bold disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ borderColor: 'rgba(181,201,228,0.22)', color: 'rgba(215,229,247,0.96)', background: 'rgba(17,22,29,0.92)' }}
          >
            {t('Sonraki Parça')}
          </button>
        </div>
      )}

      {canShowTranscript && transcriptOpen && (
        <div
          className="max-h-[220px] overflow-auto rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed text-white/72"
          style={{ borderColor: 'rgba(173,149,124,0.1)', background: 'rgba(17,22,29,0.66)' }}
        >
          {script}
        </div>
      )}
    </div>
  );
}
