import { httpsCallable } from "firebase/functions";
import { appCheckReady, functions } from "./firebaseConfig";
import {
  CourseData,
  BookMeta,
  BookBundleDescriptor,
  TimelineNode,
  QuizQuestion,
  ChatMessage,
  SmartBookAgeGroup,
  SmartBookBookType,
  SmartBookCreativeBrief,
  PodcastVoiceName
} from "./types";
import { BOOK_CONTENT_SAFETY_MESSAGE, findRestrictedBookTopicInTexts } from "./utils/contentSafety";
import { normalizeMarkdownNarrativeLayout } from "./utils/markdownLayout";

type AiOperation =
  | "extractDocumentContext"
  | "generateCourseOutline"
  | "generateCourseCover"
  | "generateLectureContent"
  | "generateLectureImages"
  | "generatePodcastScript"
  | "generatePodcastAudio"
  | "previewPodcastVoice"
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
  inputTextTokens?: number;
  inputImageTokens?: number;
  costUsdInputText?: number;
  costUsdInputImage?: number;
  costUsdOutputImage?: number;
  costMode?: "usage" | "flat";
  quality?: string;
  size?: string;
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
  audioData?: string;
  mimeType?: string;
  voiceName?: PodcastVoiceName;
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
  usageEntries?: unknown;
  error?: string | null;
  wallet?: CreditWalletSnapshot;
}

interface BookGenerationJobResponse {
  success?: boolean;
  bookId?: string | null;
  jobId?: string;
  courseId?: string | null;
  status?: string;
  totalSections?: number;
  completedSections?: number;
  currentSectionIndex?: number | null;
  currentSectionTitle?: string | null;
  currentStepLabel?: string | null;
  resultPath?: string | null;
  book?: Record<string, unknown> | null;
  bundle?: Record<string, unknown> | null;
  course?: Record<string, unknown> | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  usageEntries?: unknown;
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

export interface BookGenerationJobResult {
  jobId: string;
  bookId: string | null;
  courseId: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  totalSections: number;
  completedSections: number;
  currentSectionIndex: number | null;
  currentSectionTitle: string | null;
  currentStepLabel: string | null;
  resultPath: string | null;
  book: BookMeta | null;
  bundle: BookBundleDescriptor | null;
  course: CourseData | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  usageEntries: UsageReportEntry[];
  error: string | null;
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
  push(payload.previewText);
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
const startBookGenerationJobCallable = httpsCallable<Record<string, unknown>, BookGenerationJobResponse>(
  functions,
  "startBookGenerationJob",
  { timeout: 60_000 }
);
const getBookGenerationJobCallable = httpsCallable<{ jobId: string }, BookGenerationJobResponse>(
  functions,
  "getBookGenerationJob",
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
  previewPodcastVoice: "podcast ses onizleme",
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

function isGptImage2Model(value: unknown): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "gpt-image-2-2026-04-21" || normalized === "gpt-image-2" || normalized.includes("gpt-image-2");
}

export function formatAiUsageEntryForConsole(entry: UsageReportEntry): string {
  const label = (entry.label || "İşlem").trim() || "İşlem";
  const provider = (entry.provider || "unknown").trim();
  const model = (entry.model || "unknown").trim();
  const inputTokens = toTokenCount(entry.inputTokens);
  const outputTokens = toTokenCount(entry.outputTokens);
  const totalTokens = toTokenCount(entry.totalTokens);
  const priceUsd = toUsd(entry.estimatedCostUsd);
  const suffixParts: string[] = [];

  if (provider === "openai" && isGptImage2Model(model)) {
    if (entry.costMode) suffixParts.push(`mode ${entry.costMode}`);
    if (entry.quality) suffixParts.push(`quality ${entry.quality}`);
    if (entry.size) suffixParts.push(`size ${entry.size}`);
    if (toTokenCount(entry.inputTextTokens) > 0) suffixParts.push(`in_text ${toTokenCount(entry.inputTextTokens)}`);
    if (toTokenCount(entry.inputImageTokens) > 0) suffixParts.push(`in_image ${toTokenCount(entry.inputImageTokens)}`);
    if (Number(entry.costUsdInputText) > 0) suffixParts.push(`cost_in_text ${toUsd(entry.costUsdInputText)} usd`);
    if (Number(entry.costUsdInputImage) > 0) suffixParts.push(`cost_in_image ${toUsd(entry.costUsdInputImage)} usd`);
    if (Number(entry.costUsdOutputImage) > 0) suffixParts.push(`cost_out_image ${toUsd(entry.costUsdOutputImage)} usd`);
  }

  return `${label}: ${provider} ${model} in ${inputTokens} out ${outputTokens} total ${totalTokens} price ${priceUsd} usd${suffixParts.length ? ` | ${suffixParts.join(" ")}` : ""}`;
}

function isImageUsageEntry(entry: UsageReportEntry): boolean {
  const provider = String(entry.provider || "").trim().toLowerCase();
  const model = String(entry.model || "").trim().toLowerCase();
  const label = String(entry.label || "").trim().toLocaleLowerCase("tr-TR");
  if (provider === "openai" && isGptImage2Model(model)) return true;
  return (
    label.includes("görsel") ||
    label.includes("kapak") ||
    label.includes("image") ||
    label.includes("cover")
  );
}

export function formatBookGenerationCostSummaryForConsole(job: BookGenerationJobResult): string {
  const usageEntries = Array.isArray(job.usageEntries) ? job.usageEntries : [];
  const imageCostUsd = usageEntries.reduce((sum, entry) => (
    sum + (isImageUsageEntry(entry) ? Math.max(0, Number(entry.estimatedCostUsd) || 0) : 0)
  ), 0);
  const contentCostUsdFromEntries = usageEntries.reduce((sum, entry) => (
    sum + (!isImageUsageEntry(entry) ? Math.max(0, Number(entry.estimatedCostUsd) || 0) : 0)
  ), 0);
  const totalCostUsdFromEntries = usageEntries.reduce((sum, entry) => (
    sum + Math.max(0, Number(entry.estimatedCostUsd) || 0)
  ), 0);
  const totalCostUsd = Math.max(
    0,
    Number(job.usage?.estimatedCostUsd) || 0,
    totalCostUsdFromEntries
  );
  const contentCostUsd = Math.max(0, Math.max(contentCostUsdFromEntries, totalCostUsd - imageCostUsd));
  return `kitap içerik: ${toUsd(contentCostUsd)} usd; görseller: ${toUsd(imageCostUsd)} usd; toplam: ${toUsd(totalCostUsd)} usd`;
}

function normalizeStorageObjectPath(value: unknown): string | undefined {
  const normalized = String(value || "").trim().replace(/^\/+/, "");
  return normalized || undefined;
}

function getBookPackagePathCandidates(value: unknown): string[] {
  const normalized = normalizeStorageObjectPath(value);
  if (!normalized) return [];
  const result: string[] = [];
  const push = (nextValue: string | undefined) => {
    const next = normalizeStorageObjectPath(nextValue);
    if (!next || result.includes(next)) return;
    result.push(next);
  };

  if (/\/package\.json$/i.test(normalized)) {
    const withoutFile = normalized.replace(/\/package\.json$/i, "");
    if (/\/v\d+$/i.test(withoutFile)) {
      push(`${withoutFile}/book.zip`);
    } else {
      push(`${withoutFile}/v1/book.zip`);
      push(`${withoutFile}/book.zip`);
    }
    push(normalized);
    return result;
  }

  if (/\/book\.json$/i.test(normalized)) {
    const withoutFile = normalized.replace(/\/book\.json$/i, "");
    if (/\/v\d+$/i.test(withoutFile)) {
      push(`${withoutFile}/book.zip`);
    } else {
      push(`${withoutFile}/v1/book.zip`);
    }
    push(normalized);
    return result;
  }

  push(normalized);
  return result;
}

function resolvePreferredBookZipPath(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    const candidates = getBookPackagePathCandidates(value);
    const zipCandidate = candidates.find((candidate) => /\/book\.zip$/i.test(candidate));
    if (zipCandidate) return zipCandidate;
  }
  return undefined;
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
  const parts: string[] = [];
  for (const entry of usage.entries) {
    parts.push(formatAiUsageEntryForConsole(entry));
  }

  const totalPriceUsd = toUsd(
    usage.totalEstimatedCostUsd ?? usage.entries.reduce((sum, entry) => sum + (Number(entry.estimatedCostUsd) || 0), 0)
  );
  if (parts.length === 1) {
    console.info(`[AI COST] ${parts[0]}`);
    return;
  }
  console.info(`[AI COST] ${operationLabel}: total ${totalPriceUsd} usd | ${parts.join(" || ")}`);
}

function normalizeJobUsageEntries(raw: unknown): UsageReportEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: UsageReportEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const data = item as Record<string, unknown>;
    const providerRaw = String(data.provider || "google").trim().toLowerCase();
    const provider: UsageReportEntry["provider"] =
      providerRaw === "openai" || providerRaw === "xai"
        ? providerRaw
        : "google";
    const inputTokens = toTokenCount(data.inputTokens);
    const outputTokens = toTokenCount(data.outputTokens);
    const totalTokensRaw = toTokenCount(data.totalTokens);
    entries.push({
      label: String(data.label || "İşlem").trim() || "İşlem",
      provider,
      model: String(data.model || "unknown").trim() || "unknown",
      inputTokens,
      outputTokens,
      totalTokens: totalTokensRaw > 0 ? totalTokensRaw : inputTokens + outputTokens,
      estimatedCostUsd: Number(toUsd(data.estimatedCostUsd)),
      inputTextTokens: toTokenCount(data.inputTextTokens),
      inputImageTokens: toTokenCount(data.inputImageTokens),
      costUsdInputText: Number(toUsd(data.costUsdInputText)),
      costUsdInputImage: Number(toUsd(data.costUsdInputImage)),
      costUsdOutputImage: Number(toUsd(data.costUsdOutputImage)),
      costMode: data.costMode === "usage" ? "usage" : (data.costMode === "flat" ? "flat" : undefined),
      quality: typeof data.quality === "string" ? data.quality : undefined,
      size: typeof data.size === "string" ? data.size : undefined
    });
  }
  return entries;
}

function extractErrorUsage(error: any): UsageReport | undefined {
  const details = error?.details;
  if (!details || typeof details !== "object") return undefined;
  const usage = (details as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  return usage as UsageReport;
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
      logAiUsage(operation, extractErrorUsage(error));
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

  const normalized = output.join('\n').trim();
  return normalizeMarkdownNarrativeLayout(normalized);
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
    payload.targetPageCount = Math.max(6, Math.floor(generationPayload!.targetPageCount as number));
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
    payload.targetPageCount = Math.max(6, Math.floor(generationPayload!.targetPageCount as number));
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
    payload.targetPageCount = Math.max(6, Math.floor(generationPayload!.targetPageCount as number));
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
    payload.targetPageCount = Math.max(6, Math.floor(generationPayload!.targetPageCount as number));
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

export interface PodcastVoicePreviewResult {
  audioData: string;
  mimeType: string;
  voiceName: PodcastVoiceName;
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
  usageEntries: UsageReportEntry[];
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

function hydrateCourseNode(raw: unknown): TimelineNode {
  const node = raw && typeof raw === 'object' ? raw as Partial<TimelineNode> : {};
  return {
    id: typeof node.id === 'string' ? node.id : '',
    title: typeof node.title === 'string' ? node.title : '',
    description: typeof node.description === 'string' ? node.description : '',
    type:
      node.type === 'lecture' ||
      node.type === 'podcast' ||
      node.type === 'quiz' ||
      node.type === 'reinforce' ||
      node.type === 'exam' ||
      node.type === 'retention'
        ? node.type
        : 'lecture',
    status:
      node.status === 'completed' ||
      node.status === 'current' ||
      node.status === 'locked' ||
      node.status === 'conditional'
        ? node.status
        : 'locked',
    score: typeof node.score === 'number' ? node.score : undefined,
    duration: typeof node.duration === 'string' ? node.duration : undefined,
    content: typeof node.content === 'string' ? node.content : undefined,
    podcastScript: typeof node.podcastScript === 'string' ? node.podcastScript : undefined,
    podcastAudioUrl: typeof node.podcastAudioUrl === 'string' ? node.podcastAudioUrl : undefined,
    pageText: typeof node.pageText === 'string' ? node.pageText : undefined,
    pageImageUrl: typeof node.pageImageUrl === 'string' ? node.pageImageUrl : undefined,
    pageAudioUrl: typeof node.pageAudioUrl === 'string' ? node.pageAudioUrl : undefined,
    pageAudioStatus:
      node.pageAudioStatus === 'pending' ||
      node.pageAudioStatus === 'ready' ||
      node.pageAudioStatus === 'failed' ||
      node.pageAudioStatus === 'partial'
        ? node.pageAudioStatus
        : undefined,
    pageAudioStoragePath: typeof node.pageAudioStoragePath === 'string' ? node.pageAudioStoragePath : undefined,
    pageSequence: Number.isFinite(Number(node.pageSequence)) ? Math.max(1, Math.floor(Number(node.pageSequence))) : undefined,
    questions: Array.isArray(node.questions) ? node.questions : undefined,
    isLoading: typeof node.isLoading === 'boolean' ? node.isLoading : undefined
  };
}

function hydrateCourseData(raw: unknown): CourseData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<CourseData> & Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : '';
  const topic = typeof data.topic === 'string' ? data.topic : '';
  if (!id || !topic) return null;

  const createdAt = new Date(typeof data.createdAt === 'string' ? data.createdAt : Date.now());
  const lastActivity = new Date(typeof data.lastActivity === 'string' ? data.lastActivity : createdAt.toISOString());

  const normalizedContentPath = resolvePreferredBookZipPath(data.contentPackagePath)
    || normalizeStorageObjectPath(data.contentPackagePath);

  return {
    id,
    topic,
    description: typeof data.description === 'string' ? data.description : undefined,
    creatorName: typeof data.creatorName === 'string' ? data.creatorName : undefined,
    language: typeof data.language === 'string' ? data.language : undefined,
    ageGroup: typeof data.ageGroup === 'string' ? data.ageGroup as SmartBookAgeGroup : undefined,
    bookType:
      data.bookType === 'fairy_tale' ||
      data.bookType === 'story' ||
      data.bookType === 'novel'
        ? data.bookType
        : undefined,
    subGenre: typeof data.subGenre === 'string' ? data.subGenre : undefined,
    creativeBrief: data.creativeBrief && typeof data.creativeBrief === 'object'
      ? data.creativeBrief as SmartBookCreativeBrief
      : undefined,
    targetPageCount: Number.isFinite(Number(data.targetPageCount))
      ? Math.max(1, Math.floor(Number(data.targetPageCount)))
      : undefined,
    category: typeof data.category === 'string' ? data.category : undefined,
    searchTags: Array.isArray(data.searchTags)
      ? data.searchTags.filter((item): item is string => typeof item === 'string')
      : undefined,
    totalDuration: typeof data.totalDuration === 'string' ? data.totalDuration : undefined,
    visualStoryMode: data.visualStoryMode === true,
    visualStoryAudioStatus:
      data.visualStoryAudioStatus === 'pending' ||
      data.visualStoryAudioStatus === 'ready' ||
      data.visualStoryAudioStatus === 'failed' ||
      data.visualStoryAudioStatus === 'partial'
        ? data.visualStoryAudioStatus
        : undefined,
    coverNarrationText: typeof data.coverNarrationText === 'string' ? data.coverNarrationText : undefined,
    coverNarrationAudioUrl: typeof data.coverNarrationAudioUrl === 'string' ? data.coverNarrationAudioUrl : undefined,
    coverNarrationAudioStoragePath: typeof data.coverNarrationAudioStoragePath === 'string'
      ? data.coverNarrationAudioStoragePath
      : undefined,
    coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined,
    contentPackageUrl: typeof data.contentPackageUrl === 'string' ? data.contentPackageUrl : undefined,
    contentPackagePath: normalizedContentPath,
    contentPackageUpdatedAt: typeof data.contentPackageUpdatedAt === 'string'
      ? new Date(data.contentPackageUpdatedAt)
      : undefined,
    status:
      data.status === 'processing' || data.status === 'ready' || data.status === 'failed'
        ? data.status
        : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    nodes: Array.isArray(data.nodes) ? data.nodes.map(hydrateCourseNode) : [],
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    lastActivity: Number.isNaN(lastActivity.getTime()) ? new Date() : lastActivity
  };
}

function hydrateBookBundleDescriptor(raw: unknown): BookBundleDescriptor | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<BookBundleDescriptor> & Record<string, unknown>;
  const path = resolvePreferredBookZipPath(data.path) || normalizeStorageObjectPath(data.path) || '';
  if (!path) return null;
  const version = Number.isFinite(Number(data.version))
    ? Math.max(1, Math.floor(Number(data.version)))
    : 1;
  const generatedAt = new Date(typeof data.generatedAt === 'string' ? data.generatedAt : Date.now());
  return {
    path,
    version,
    checksumSha256: typeof data.checksumSha256 === 'string' ? data.checksumSha256 : undefined,
    sizeBytes: Number.isFinite(Number(data.sizeBytes)) ? Math.max(0, Math.floor(Number(data.sizeBytes))) : undefined,
    includesPodcast: data.includesPodcast === true,
    generatedAt: Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt
  };
}

function hydrateBookMeta(raw: unknown): BookMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<BookMeta> & Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id.trim() : '';
  const userId = typeof data.userId === 'string' ? data.userId.trim() : '';
  const title = typeof data.title === 'string'
    ? data.title.trim()
    : (typeof data.topic === 'string' ? data.topic.trim() : '');
  if (!id || !userId || !title) return null;

  const createdAt = new Date(typeof data.createdAt === 'string' ? data.createdAt : Date.now());
  const updatedAt = new Date(typeof data.updatedAt === 'string' ? data.updatedAt : createdAt.toISOString());
  const lastActivity = new Date(typeof data.lastActivity === 'string' ? data.lastActivity : createdAt.toISOString());
  const bundle = hydrateBookBundleDescriptor(data.bundle);
  const rawCover = data.cover && typeof data.cover === 'object' ? data.cover as Record<string, unknown> : null;

  return {
    id,
    userId,
    title,
    description: typeof data.description === 'string' ? data.description : undefined,
    creatorName: typeof data.creatorName === 'string' ? data.creatorName : undefined,
    language: typeof data.language === 'string' ? data.language : undefined,
    ageGroup: typeof data.ageGroup === 'string' ? data.ageGroup as SmartBookAgeGroup : undefined,
    bookType:
      data.bookType === 'fairy_tale' ||
      data.bookType === 'story' ||
      data.bookType === 'novel'
        ? data.bookType
        : undefined,
    subGenre: typeof data.subGenre === 'string' ? data.subGenre : undefined,
    targetPageCount: Number.isFinite(Number(data.targetPageCount))
      ? Math.max(1, Math.floor(Number(data.targetPageCount)))
      : undefined,
    category: typeof data.category === 'string' ? data.category : undefined,
    searchTags: Array.isArray(data.searchTags)
      ? data.searchTags.filter((item): item is string => typeof item === 'string')
      : undefined,
    totalDuration: typeof data.totalDuration === 'string' ? data.totalDuration : undefined,
    visualStoryMode: data.visualStoryMode === true,
    visualStoryAudioStatus:
      data.visualStoryAudioStatus === 'pending' ||
      data.visualStoryAudioStatus === 'ready' ||
      data.visualStoryAudioStatus === 'failed' ||
      data.visualStoryAudioStatus === 'partial'
        ? data.visualStoryAudioStatus
        : undefined,
    coverNarrationText: typeof data.coverNarrationText === 'string' ? data.coverNarrationText : undefined,
    coverNarrationAudioUrl: typeof data.coverNarrationAudioUrl === 'string' ? data.coverNarrationAudioUrl : undefined,
    coverNarrationAudioStoragePath: typeof data.coverNarrationAudioStoragePath === 'string'
      ? data.coverNarrationAudioStoragePath
      : undefined,
    cover: rawCover
      ? {
        path: typeof rawCover.path === 'string' ? rawCover.path : undefined,
        url: typeof rawCover.url === 'string' ? rawCover.url : (typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined)
      }
      : (typeof data.coverImageUrl === 'string' ? { url: data.coverImageUrl } : undefined),
    bundle: bundle || undefined,
    status: data.status === 'processing' || data.status === 'ready' || data.status === 'failed'
      ? data.status
      : undefined,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    updatedAt: Number.isNaN(updatedAt.getTime()) ? undefined : updatedAt,
    lastActivity: Number.isNaN(lastActivity.getTime()) ? new Date() : lastActivity
  };
}

function buildCoursePlaceholderFromBookMeta(book: BookMeta): CourseData {
  return {
    id: book.id,
    topic: book.title,
    description: book.description,
    creatorName: book.creatorName,
    language: book.language,
    ageGroup: book.ageGroup,
    bookType: book.bookType,
    subGenre: book.subGenre,
    targetPageCount: book.targetPageCount,
    category: book.category,
    searchTags: book.searchTags,
    totalDuration: book.totalDuration,
    visualStoryMode: book.visualStoryMode,
    visualStoryAudioStatus: book.visualStoryAudioStatus,
    coverNarrationText: book.coverNarrationText,
    coverNarrationAudioUrl: book.coverNarrationAudioUrl,
    coverNarrationAudioStoragePath: book.coverNarrationAudioStoragePath,
    coverImageUrl: book.cover?.url,
    contentPackagePath: book.bundle?.path,
    contentPackageUpdatedAt: book.bundle?.generatedAt,
    bundle: book.bundle,
    cover: book.cover,
    status: book.status,
    userId: book.userId,
    nodes: [],
    createdAt: book.createdAt,
    lastActivity: book.lastActivity
  };
}

async function hydrateBookGenerationJob(data: BookGenerationJobResponse): Promise<BookGenerationJobResult> {
  emitCreditWalletSnapshot(data.wallet);
  const jobId = String(data.jobId || '').trim();
  if (!jobId) {
    throw new Error('Book job response is missing jobId.');
  }

  const rawStatus = String(data.status || 'queued').trim();
  const status: BookGenerationJobResult['status'] =
    rawStatus === 'processing' ||
    rawStatus === 'completed' ||
    rawStatus === 'failed'
      ? rawStatus
      : 'queued';
  const hydratedBook = hydrateBookMeta(data.book);
  const hydratedBundle = hydrateBookBundleDescriptor(data.bundle) || hydratedBook?.bundle || null;
  const hydratedCourseBase = hydrateCourseData(data.course) || (hydratedBook ? buildCoursePlaceholderFromBookMeta(hydratedBook) : null);
  const hydratedCourse = hydratedCourseBase
    ? {
      ...hydratedCourseBase,
      contentPackagePath: resolvePreferredBookZipPath(
        hydratedBundle?.path,
        hydratedCourseBase.contentPackagePath
      ) || hydratedCourseBase.contentPackagePath || hydratedBundle?.path,
      contentPackageUpdatedAt: hydratedCourseBase.contentPackageUpdatedAt || hydratedBundle?.generatedAt,
      bundle: hydratedCourseBase.bundle || hydratedBundle || undefined,
      status: hydratedCourseBase.status || hydratedBook?.status || (hydratedBundle ? 'ready' : undefined)
    }
    : null;
  const usageEntries = normalizeJobUsageEntries(data.usageEntries);
  const courseId = typeof data.courseId === 'string'
    ? data.courseId
    : (typeof data.bookId === 'string' ? data.bookId : null);

  return {
    jobId,
    bookId: typeof data.bookId === 'string' ? data.bookId : courseId,
    courseId,
    status,
    totalSections: Math.max(0, Math.floor(Number(data.totalSections) || 0)),
    completedSections: Math.max(0, Math.floor(Number(data.completedSections) || 0)),
    currentSectionIndex: Number.isFinite(Number(data.currentSectionIndex))
      ? Math.max(0, Math.floor(Number(data.currentSectionIndex)))
      : null,
    currentSectionTitle: typeof data.currentSectionTitle === 'string' ? data.currentSectionTitle : null,
    currentStepLabel: typeof data.currentStepLabel === 'string' ? data.currentStepLabel : null,
    resultPath: typeof data.resultPath === 'string' ? data.resultPath : null,
    book: hydratedBook,
    bundle: hydratedBundle,
    course: hydratedCourse,
    usage: {
      inputTokens: Math.max(0, Math.floor(Number(data.inputTokens) || 0)),
      outputTokens: Math.max(0, Math.floor(Number(data.outputTokens) || 0)),
      totalTokens: Math.max(0, Math.floor(Number(data.totalTokens) || 0)),
      estimatedCostUsd: Math.max(0, Number(data.estimatedCostUsd) || 0)
    },
    usageEntries,
    error: typeof data.error === 'string' ? data.error : null
  };
}

async function hydratePodcastAudioJob(data: PodcastAudioJobResponse): Promise<PodcastAudioJobResult> {
  emitCreditWalletSnapshot(data.wallet);
  const jobId = String(data.jobId || '').trim();
  if (!jobId) {
    throw new Error('Podcast job response is missing jobId.');
  }
  const usageEntries = normalizeJobUsageEntries(data.usageEntries);

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
    usageEntries,
    segments,
    error: typeof data.error === 'string' ? data.error : null
  };
}

export async function startBookGenerationJob(params: {
  topic?: string;
  sourceContent?: string;
  creatorName?: string;
  ageGroup?: SmartBookAgeGroup;
  bookType?: SmartBookBookType;
  subGenre?: string;
  targetPageCount?: number;
  creativeBrief?: SmartBookCreativeBrief;
  allowAiBookTitleGeneration?: boolean;
}): Promise<BookGenerationJobResult> {
  await appCheckReady;
  const payload: Record<string, unknown> = {};
  if (params.topic?.trim()) payload.topic = params.topic.trim();
  if (params.sourceContent?.trim()) payload.sourceContent = params.sourceContent.trim();
  if (params.creatorName?.trim()) payload.creatorName = params.creatorName.trim();
  if (params.ageGroup) payload.ageGroup = params.ageGroup;
  if (params.bookType) payload.bookType = params.bookType;
  if (params.subGenre?.trim()) payload.subGenre = params.subGenre.trim();
  if (Number.isFinite(params.targetPageCount as number)) {
    payload.targetPageCount = Math.max(1, Math.floor(params.targetPageCount as number));
  }
  if (params.creativeBrief) payload.creativeBrief = params.creativeBrief;
  if (params.allowAiBookTitleGeneration === true) payload.allowAiBookTitleGeneration = true;
  const response = await startBookGenerationJobCallable(payload);
  return await hydrateBookGenerationJob(response.data || {});
}

export async function getBookGenerationJob(jobId: string): Promise<BookGenerationJobResult> {
  await appCheckReady;
  const response = await getBookGenerationJobCallable({ jobId });
  return await hydrateBookGenerationJob(response.data || {});
}

export async function startPodcastAudioJob(
  topic: string,
  script: string,
  options?: {
    bookType?: SmartBookBookType;
    voiceName?: PodcastVoiceName;
    bookId?: string;
    nodeId?: string;
    target?: 'podcast' | 'visualStory';
    coverScript?: string;
    visualStoryPages?: Array<{
      nodeId: string;
      title?: string;
      script: string;
      pageSequence?: number;
    }>;
  }
): Promise<PodcastAudioJobResult> {
  await appCheckReady;
  const payload: Record<string, unknown> = { topic, script };
  if (options?.bookType) payload.bookType = options.bookType;
  if (options?.voiceName) payload.voiceName = options.voiceName;
  if (options?.bookId) payload.bookId = options.bookId;
  if (options?.nodeId) payload.nodeId = options.nodeId;
  if (options?.target) payload.target = options.target;
  if (options?.coverScript?.trim()) payload.coverScript = options.coverScript.trim();
  if (Array.isArray(options?.visualStoryPages) && options.visualStoryPages.length > 0) {
    payload.visualStoryPages = options.visualStoryPages
      .map((page) => ({
        nodeId: page.nodeId,
        title: page.title || '',
        script: page.script,
        pageSequence: page.pageSequence
      }))
      .filter((page) => page.nodeId && page.script.trim());
  }
  const response = await startPodcastAudioJobCallable(payload);
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
  generationPayload?: SmartBookGenerationPayload,
  voiceName?: PodcastVoiceName
): Promise<PodcastAudioResult> {
  const payload: Record<string, unknown> = { topic };
  if (script && script.trim()) payload.script = script;
  if (sourceContent && sourceContent.trim()) payload.sourceContent = sourceContent;
  if (ageGroup) payload.ageGroup = ageGroup;
  if (generationPayload?.bookType) payload.bookType = generationPayload.bookType;
  if (generationPayload?.subGenre) payload.subGenre = generationPayload.subGenre;
  if (Number.isFinite(generationPayload?.targetPageCount as number)) {
    payload.targetPageCount = Math.max(6, Math.floor(generationPayload!.targetPageCount as number));
  }
  if (generationPayload?.creativeBrief) payload.creativeBrief = generationPayload.creativeBrief;
  if (voiceName) payload.voiceName = voiceName;

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

export async function previewPodcastVoice(
  voiceName: PodcastVoiceName,
  previewText: string,
  options?: {
    bookType?: SmartBookBookType;
  }
): Promise<PodcastVoicePreviewResult> {
  const payload: Record<string, unknown> = {
    voiceName,
    previewText
  };
  if (options?.bookType) payload.bookType = options.bookType;
  const data = await callAi("previewPodcastVoice", payload);
  if (!data.audioData || !data.mimeType) {
    throw new Error("Podcast voice preview response is missing audio data.");
  }
  return {
    audioData: data.audioData,
    mimeType: data.mimeType,
    voiceName: (data.voiceName as PodcastVoiceName | undefined) || voiceName
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
    payload.targetPageCount = Math.max(6, Math.floor(generationPayload!.targetPageCount as number));
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
    payload.targetPageCount = Math.max(6, Math.floor(generationPayload!.targetPageCount as number));
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
