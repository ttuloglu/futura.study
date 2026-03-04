import { httpsCallable } from "firebase/functions";
import { appCheckReady, functions } from "./firebaseConfig";
import {
  TimelineNode,
  QuizQuestion,
  ChatMessage,
  SmartBookAgeGroup,
  SmartBookBookType,
  SmartBookCreativeBrief
} from "./types";
import { BOOK_CONTENT_SAFETY_MESSAGE, findRestrictedBookTopicInTexts } from "./utils/contentSafety";

type AiOperation =
  | "extractDocumentContext"
  | "generateCourseOutline"
  | "generateCourseCover"
  | "generateLectureContent"
  | "generateLectureImages"
  | "generatePodcastScript"
  | "generatePodcastAudio"
  | "generateQuizQuestions"
  | "generateRemedialContent"
  | "generateSummaryCard"
  | "chatWithAI";

interface AiGatewayRequest {
  operation: AiOperation;
  payload: Record<string, unknown>;
}

interface UsageReportEntry {
  label: string;
  provider: "google" | "openai" | "xai";
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface UsageReport {
  operation: AiOperation;
  entries: UsageReportEntry[];
  totalEstimatedCostUsd: number;
}

export interface CreditWalletSnapshot {
  createCredits: number;
}

export const CREDIT_WALLET_UPDATED_EVENT = "fortale:credit-wallet-updated";
export const CREDIT_EXHAUSTED_EVENT = "fortale:credit-exhausted";

interface AiGatewayResponse {
  detectedTopic?: string;
  sourceContent?: string;
  outline?: TimelineNode[];
  courseMeta?: CourseOutlineMetadata;
  coverImageUrl?: string;
  content?: string;
  audioFilePath?: string;
  questions?: QuizQuestion[];
  message?: string;
  usage?: UsageReport;
  creditWallet?: CreditWalletSnapshot;
}

interface PodcastAudioJobResponse {
  success?: boolean;
  jobId?: string;
  status?: string;
  totalChunks?: number;
  completedChunks?: number;
  currentChunkIndex?: number | null;
  currentChunkLabel?: string | null;
  audioFilePath?: string | null;
  audioFileBytes?: number;
  segmentPaths?: string[];
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  error?: string | null;
  wallet?: CreditWalletSnapshot;
}

export interface PodcastUsageSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  audioFileBytes: number;
}

function asPayloadText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function assertPayloadBookSafety(operation: AiOperation, payload: Record<string, unknown>): void {
  if (operation === "chatWithAI") return;
  if (operation === "generateQuizQuestions") return;

  const textsToScan: Array<string | undefined> = [];
  const push = (value: unknown) => textsToScan.push(asPayloadText(value));

  push(payload.topic);
  push(payload.topicHint);
  push(payload.nodeTitle);
  push(payload.sourceContent);
  push(payload.script);
  push(payload.subGenre);
  push(payload.newMessage);
  push(payload.topicContext);

  if (payload.creativeBrief && typeof payload.creativeBrief === "object" && !Array.isArray(payload.creativeBrief)) {
    const brief = payload.creativeBrief as Record<string, unknown>;
    push(brief.subGenre);
    push(brief.languageText);
    push(brief.characters);
    push(brief.settingPlace);
    push(brief.settingTime);
    push(brief.narrativeStyle);
    push(brief.customInstructions);
  }

  const violation = findRestrictedBookTopicInTexts(textsToScan);
  if (violation) {
    throw new Error(BOOK_CONTENT_SAFETY_MESSAGE);
  }
}

export interface CourseOutlineMetadata {
  bookTitle?: string;
  bookDescription?: string;
  bookCategory?: string;
  searchTags?: string[];
  bookType?: SmartBookBookType;
  subGenre?: string;
  targetPageCount?: number;
}

export interface SmartBookGenerationPayload {
  bookType?: SmartBookBookType;
  subGenre?: string;
  targetPageCount?: number;
  creativeBrief?: SmartBookCreativeBrief;
  allowAiBookTitleGeneration?: boolean;
  deferImageGeneration?: boolean;
  coverContext?: string;
  narrativeContext?: {
    outlinePositions: { current: number; total: number };
    previousChapterContent?: string;
    storySoFarContent?: string;
  };
}

const aiGateway = httpsCallable<AiGatewayRequest, AiGatewayResponse>(functions, "aiGateway", {
  timeout: 70_000
});

// Podcast TTS generation can take several minutes — use a much longer timeout
const aiGatewayLong = httpsCallable<AiGatewayRequest, AiGatewayResponse>(functions, "aiGateway", {
  timeout: 540_000
});
const startPodcastAudioJobCallable = httpsCallable<Record<string, unknown>, PodcastAudioJobResponse>(
  functions,
  "startPodcastAudioJob",
  { timeout: 60_000 }
);
const getPodcastAudioJobCallable = httpsCallable<{ jobId: string }, PodcastAudioJobResponse>(
  functions,
  "getPodcastAudioJob",
  { timeout: 30_000 }
);

const OPERATION_LABELS: Record<AiOperation, string> = {
  extractDocumentContext: "dokuman analizi",
  generateCourseOutline: "akis plani",
  generateCourseCover: "kitap kapagi",
  generateLectureContent: "giris",
  generateLectureImages: "bolum gorseli",
  generatePodcastScript: "podcast",
  generatePodcastAudio: "podcast ses",
  generateQuizQuestions: "quiz",
  generateRemedialContent: "pekistirme",
  generateSummaryCard: "ozet karti",
  chatWithAI: "chat"
};

function toTokenCount(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function toUsd(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "0.000000";
  const rounded = Math.round(Math.max(0, num) * 1_000_000) / 1_000_000;
  return rounded.toFixed(6);
}

function normalizeCreditWalletSnapshot(value: unknown): CreditWalletSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CreditWalletSnapshot>;
  const createCredits = Number(raw.createCredits);
  if (!Number.isFinite(createCredits)) return null;
  return {
    createCredits: Math.max(0, Math.floor(createCredits))
  };
}

function emitCreditWalletSnapshot(snapshot: unknown): void {
  if (typeof window === "undefined") return;
  const wallet = normalizeCreditWalletSnapshot(snapshot);
  if (!wallet) return;
  try {
    window.dispatchEvent(new CustomEvent(CREDIT_WALLET_UPDATED_EVENT, { detail: wallet }));
  } catch {
    // Ignore event dispatch issues in constrained runtimes.
  }
}

function emitCreditExhausted(action: "create"): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(CREDIT_EXHAUSTED_EVENT, { detail: { action } }));
  } catch {
    // Ignore event dispatch issues in constrained runtimes.
  }
}

function logAiUsage(operation: AiOperation, usage?: UsageReport): void {
  if (!usage || !Array.isArray(usage.entries) || usage.entries.length === 0) {
    return;
  }

  const operationLabel = OPERATION_LABELS[operation] || operation;
  for (const entry of usage.entries) {
    const label = (entry.label || operationLabel).trim() || operationLabel;
    const provider = (entry.provider || "unknown").trim();
    const model = (entry.model || "unknown").trim();
    const inputTokens = toTokenCount(entry.inputTokens);
    const outputTokens = toTokenCount(entry.outputTokens);
    const totalTokens = toTokenCount(entry.totalTokens);
    const priceUsd = toUsd(entry.estimatedCostUsd);
    console.info(
      `[AI COST] ${label}: ${provider} ${model} in ${inputTokens} out ${outputTokens} total ${totalTokens} price ${priceUsd} usd`
    );
  }

  const totalPriceUsd = toUsd(
    usage.totalEstimatedCostUsd ?? usage.entries.reduce((sum, entry) => sum + (Number(entry.estimatedCostUsd) || 0), 0)
  );
  console.info(`[AI COST] ${operationLabel} toplam: ${totalPriceUsd} usd`);
}

async function callAi(operation: AiOperation, payload: Record<string, unknown>): Promise<AiGatewayResponse> {
  assertPayloadBookSafety(operation, payload);
  await appCheckReady;

  const longRunningOperations = new Set<AiOperation>([
    "generateLectureContent",
    "generateLectureImages",
    "generateRemedialContent",
    "generateSummaryCard",
    "generateQuizQuestions",
    "generatePodcastScript",
    "generatePodcastAudio"
  ]);
  const callable = longRunningOperations.has(operation) ? aiGatewayLong : aiGateway;

  const extractRetryDelayMs = (error: any): number | undefined => {
    const raw = String(error?.message || error || '');
    const retryDelayField = raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
    if (retryDelayField) {
      const seconds = Number.parseFloat(retryDelayField[1]);
      if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
    }
    const retryInField = raw.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    if (retryInField) {
      const seconds = Number.parseFloat(retryInField[1]);
      if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
    }
    return undefined;
  };

  const maxAttempts = operation === "generatePodcastAudio" ? 4 : 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await callable({ operation, payload });
      const data = response.data;
      emitCreditWalletSnapshot(data.creditWallet);
      logAiUsage(operation, data.usage);
      return data;
    } catch (error: any) {
      const code = String(error?.code || '').toLowerCase();
      const message = String(error?.message || '').toLowerCase();
      const isCreditExhausted =
        code.includes('resource-exhausted') &&
        (message.includes('yetersiz') || message.includes('insufficient'));
      if (isCreditExhausted) {
        emitCreditExhausted('create');
        throw error;
      }
      const isRetriable =
        code.includes('deadline-exceeded') ||
        code.includes('unavailable') ||
        code.includes('resource-exhausted') ||
        message.includes('resource_exhausted') ||
        message.includes('quota exceeded') ||
        message.includes('rate limit') ||
        message.includes('"code":429');
      if (!isRetriable || attempt >= maxAttempts) throw error;
      const hintedDelayMs = extractRetryDelayMs(error);
      const fallbackDelayMs = 1200 * attempt;
      const delayMs = Math.max(fallbackDelayMs, Math.min(hintedDelayMs || 0, 45_000)) + 400;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('AI service request failed.');
}

function normalizeSmartBookMarkdownContent(input: string): string {
  const markdown = String(input || '');
  if (!markdown.trim()) return '';

  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }

    if (inCodeFence) {
      output.push(line);
      continue;
    }

    if (/^\s*\*{3,}\s*$/.test(line)) {
      output.push('---');
      continue;
    }

    const normalizedLine = line
      .replace(/([.!?;:])\s+\*\s+(?=[A-ZÇĞİÖŞÜ0-9])/g, '$1\n\n- ')
      .replace(/([)\]])\s+\*\s+(?=[A-ZÇĞİÖŞÜ0-9])/g, '$1\n\n- ');

    output.push(normalizedLine);
  }

  return output.join('\n').trim();
}

export async function generateCourseOutline(
  topic?: string,
  sourceContent?: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<{ outline: TimelineNode[]; courseMeta?: CourseOutlineMetadata }> {
  const payload: Record<string, unknown> = {};
  if (topic && topic.trim()) {
    payload.topic = topic.trim();
  }
  if (sourceContent && sourceContent.trim()) {
    payload.sourceContent = sourceContent.trim();
  }
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(8, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;
  if (generationPayload?.allowAiBookTitleGeneration === true) payload.allowAiBookTitleGeneration = true;
  const data = await callAi("generateCourseOutline", payload);
  if (!data.outline) {
    throw new Error("Outline response is missing.");
  }
  return {
    outline: data.outline,
    courseMeta: data.courseMeta
  };
}

export async function extractDocumentContext(
  fileBase64: string,
  mimeType: string,
  fileName: string,
  topicHint?: string
): Promise<{ topic: string; sourceContent: string }> {
  const payload: Record<string, unknown> = {
    fileBase64,
    mimeType,
    fileName
  };
  if (topicHint && topicHint.trim()) {
    payload.topicHint = topicHint.trim();
  }

  const data = await callAi("extractDocumentContext", payload);
  const topic = data.detectedTopic?.trim();
  const sourceContent = data.sourceContent?.trim();

  if (!topic || !sourceContent) {
    throw new Error("Document context response is missing.");
  }

  return { topic, sourceContent };
}

export async function generateCourseCover(
  topic: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<string> {
  const payload: Record<string, unknown> = { topic };
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;
  if (generationPayload?.coverContext) payload.coverContext = generationPayload.coverContext;
  const data = await callAi("generateCourseCover", payload);
  if (!data.coverImageUrl) {
    throw new Error("Course cover response is missing.");
  }
  return data.coverImageUrl;
}

export async function generateLectureContent(
  topic: string,
  nodeTitle: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<string> {
  const payload: Record<string, unknown> = { topic, nodeTitle };
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(8, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;
  if (generationPayload?.narrativeContext) payload.narrativeContext = generationPayload.narrativeContext;
  if (generationPayload?.deferImageGeneration === true) payload.deferImageGeneration = true;
  const data = await callAi("generateLectureContent", payload);
  if (!data.content) {
    throw new Error("Lecture content response is missing.");
  }
  return normalizeSmartBookMarkdownContent(data.content);
}

export async function generateLectureImages(
  topic: string,
  nodeTitle: string,
  sourceContent: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<string> {
  const payload: Record<string, unknown> = { topic, nodeTitle, sourceContent };
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(8, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;
  if (generationPayload?.narrativeContext) payload.narrativeContext = generationPayload.narrativeContext;
  const data = await callAi("generateLectureImages", payload);
  if (!data.content) {
    return normalizeSmartBookMarkdownContent(sourceContent);
  }
  return normalizeSmartBookMarkdownContent(data.content);
}

export async function generatePodcastScript(topic: string, sourceContent?: string, ageGroup?: SmartBookAgeGroup): Promise<string> {
  const payload: Record<string, unknown> = { topic };
  if (sourceContent && sourceContent.trim()) {
    payload.sourceContent = sourceContent;
  }
  if (ageGroup) payload.ageGroup = ageGroup;
  const data = await callAi("generatePodcastScript", payload);
  if (!data.content) {
    throw new Error("Podcast content response is missing.");
  }
  return normalizeSmartBookMarkdownContent(data.content);
}

export async function generatePodcastScriptWithBrief(
  topic: string,
  sourceContent?: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<string> {
  const payload: Record<string, unknown> = { topic };
  if (sourceContent && sourceContent.trim()) {
    payload.sourceContent = sourceContent;
  }
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(8, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;
  const data = await callAi("generatePodcastScript", payload);
  if (!data.content) {
    throw new Error("Podcast content response is missing.");
  }
  return normalizeSmartBookMarkdownContent(data.content);
}

import { getStorage, ref, getDownloadURL } from "firebase/storage";

export interface PodcastAudioResult {
  content: string;
  audioUrl: string;
}

export interface PodcastAudioJobResult {
  jobId: string;
  status: 'queued' | 'processing' | 'finalizing' | 'completed' | 'failed';
  totalChunks: number;
  completedChunks: number;
  currentChunkIndex: number | null;
  currentChunkLabel: string | null;
  audioUrl: string;
  audioFilePath?: string | null;
  segmentPaths: string[];
  usage: PodcastUsageSummary;
  segments: Array<{
    id: string;
    title: string;
    audioUrl: string;
  }>;
  error?: string | null;
}

async function resolveStorageDownloadUrl(pathValue: string | null | undefined): Promise<string> {
  const storagePath = String(pathValue || '').trim();
  if (!storagePath) return '';
  const storage = getStorage();
  const fileRef = ref(storage, storagePath);
  return await getDownloadURL(fileRef);
}

async function hydratePodcastAudioJob(data: PodcastAudioJobResponse): Promise<PodcastAudioJobResult> {
  emitCreditWalletSnapshot(data.wallet);
  const jobId = String(data.jobId || '').trim();
  if (!jobId) {
    throw new Error('Podcast job response is missing jobId.');
  }

  const rawStatus = String(data.status || 'queued').trim();
  const status: PodcastAudioJobResult['status'] =
    rawStatus === 'processing' ||
    rawStatus === 'finalizing' ||
    rawStatus === 'completed' ||
    rawStatus === 'failed'
      ? rawStatus
      : 'queued';
  const segmentPaths = Array.isArray(data.segmentPaths)
    ? data.segmentPaths.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const audioUrl = await resolveStorageDownloadUrl(data.audioFilePath || '');
  const segments = await Promise.all(
    segmentPaths.map(async (segmentPath, index) => ({
      id: `segment-${index + 1}`,
      title: `Bölüm ${index + 1}`,
      audioUrl: await resolveStorageDownloadUrl(segmentPath)
    }))
  );

  return {
    jobId,
    status,
    totalChunks: Math.max(0, Math.floor(Number(data.totalChunks) || 0)),
    completedChunks: Math.max(0, Math.floor(Number(data.completedChunks) || 0)),
    currentChunkIndex: Number.isFinite(Number((data as { currentChunkIndex?: unknown }).currentChunkIndex))
      ? Math.max(0, Math.floor(Number((data as { currentChunkIndex?: unknown }).currentChunkIndex)))
      : null,
    currentChunkLabel: typeof (data as { currentChunkLabel?: unknown }).currentChunkLabel === 'string'
      ? (data as { currentChunkLabel?: string }).currentChunkLabel || null
      : null,
    audioUrl,
    audioFilePath: typeof data.audioFilePath === 'string' ? data.audioFilePath : null,
    segmentPaths,
    usage: {
      inputTokens: Math.max(0, Math.floor(Number(data.inputTokens) || 0)),
      outputTokens: Math.max(0, Math.floor(Number(data.outputTokens) || 0)),
      totalTokens: Math.max(0, Math.floor(Number(data.totalTokens) || 0)),
      estimatedCostUsd: Math.max(0, Number(data.estimatedCostUsd) || 0),
      audioFileBytes: Math.max(0, Math.floor(Number(data.audioFileBytes) || 0))
    },
    segments,
    error: typeof data.error === 'string' ? data.error : null
  };
}

export async function startPodcastAudioJob(
  topic: string,
  script: string
): Promise<PodcastAudioJobResult> {
  await appCheckReady;
  const response = await startPodcastAudioJobCallable({ topic, script });
  return await hydratePodcastAudioJob(response.data || {});
}

export async function getPodcastAudioJob(jobId: string): Promise<PodcastAudioJobResult> {
  await appCheckReady;
  const response = await getPodcastAudioJobCallable({ jobId });
  return await hydratePodcastAudioJob(response.data || {});
}

export async function generatePodcastAudio(
  topic: string,
  script?: string,
  sourceContent?: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<PodcastAudioResult> {
  const payload: Record<string, unknown> = { topic };
  if (script && script.trim()) payload.script = script;
  if (sourceContent && sourceContent.trim()) payload.sourceContent = sourceContent;
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(8, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;

  const data = await callAi("generatePodcastAudio", payload);
  if (!data.audioFilePath) {
    throw new Error("Podcast audio response is missing audioFilePath.");
  }

  const storage = getStorage();
  const fileRef = ref(storage, data.audioFilePath);
  const audioUrl = await getDownloadURL(fileRef);

  return {
    content: data.content || script || "",
    audioUrl
  };
}

export async function generateQuizQuestions(
  topic: string,
  difficulty: string = "Zor",
  quizType: 'quiz' | 'exam' | 'retention' = 'quiz',
  options?: {
    sourceContent?: string;
    excludeQuestionStems?: string[];
    ageGroup?: SmartBookAgeGroup;
    mcqCount?: number;
    tfCount?: number;
  }
): Promise<QuizQuestion[]> {
  const payload: Record<string, unknown> = { topic, difficulty, quizType };
  if (options?.sourceContent?.trim()) {
    payload.sourceContent = options.sourceContent.trim();
  }
  if (Array.isArray(options?.excludeQuestionStems) && options.excludeQuestionStems.length > 0) {
    payload.excludeQuestionStems = options.excludeQuestionStems;
  }
  if (options?.ageGroup) payload.ageGroup = options.ageGroup;
  if (Number.isFinite(options?.mcqCount as number)) payload.mcqCount = Math.max(1, Math.floor(options!.mcqCount as number));
  if (Number.isFinite(options?.tfCount as number)) payload.tfCount = Math.max(1, Math.floor(options!.tfCount as number));
  const data = await callAi("generateQuizQuestions", payload);
  if (!data.questions) {
    throw new Error("Quiz questions response is missing.");
  }
  return data.questions;
}

export async function generateRemedialContent(
  topic: string,
  sourceContent?: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<string> {
  const payload: Record<string, unknown> = { topic };
  if (sourceContent && sourceContent.trim()) {
    payload.sourceContent = sourceContent.trim();
  }
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(8, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;
  const data = await callAi("generateRemedialContent", payload);
  if (!data.content) {
    throw new Error("Remedial content response is missing.");
  }
  return normalizeSmartBookMarkdownContent(data.content);
}

export async function generateSummaryCard(
  topic: string,
  sourceContent?: string,
  ageGroup?: SmartBookAgeGroup,
  generationPayload?: SmartBookGenerationPayload
): Promise<string> {
  const payload: Record<string, unknown> = { topic };
  if (sourceContent && sourceContent.trim()) {
    payload.sourceContent = sourceContent.trim();
  }
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(8, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;

  const data = await callAi("generateSummaryCard", payload);
  if (!data.content) {
    throw new Error("Summary card response is missing.");
  }
  return normalizeSmartBookMarkdownContent(data.content);
}

export async function chatWithAI(
  history: ChatMessage[],
  newMessage: string,
  topicContext?: string
): Promise<string> {
  const payload: Record<string, unknown> = {
    history: history.map((message) => ({
      role: message.role,
      content: message.content
    })),
    newMessage
  };

  if (topicContext && topicContext.trim()) {
    payload.topicContext = topicContext.trim();
  }

  const data = await callAi("chatWithAI", payload);

  if (!data.message) {
    throw new Error("Chat response is missing.");
  }
  return data.message;
}
