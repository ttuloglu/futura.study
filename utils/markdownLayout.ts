const STRUCTURAL_LINE_RE =
  /^(?:#{1,6}\s+|>\s*|(?:[-*+]|\d+\.)\s+|\|.*\||```|---\s*$|\*\*\*\s*$|___\s*$|\$\$\s*$)/;
const MEDIA_TOKEN_RE = /@@MEDIA_TOKEN_(\d+)@@/g;

type MediaTokenizationResult = {
  text: string;
  mediaTokens: string[];
};

function hasInlineMediaSyntax(value: string): boolean {
  const text = String(value || "");
  return /!\[[^\]]*]\(/.test(text) || /<img\b/i.test(text) || /@@MEDIA_TOKEN_\d+@@/.test(text);
}

function tokenizeMediaBlocks(input: string): MediaTokenizationResult {
  const source = String(input || "");
  if (!source) return { text: "", mediaTokens: [] };

  const mediaTokens: string[] = [];
  const output: string[] = [];
  let index = 0;

  const pushToken = (raw: string) => {
    const tokenIndex = mediaTokens.length;
    mediaTokens.push(raw);
    output.push(`@@MEDIA_TOKEN_${tokenIndex}@@`);
  };

  while (index < source.length) {
    const tail = source.slice(index);

    if (/^<img\b/i.test(tail)) {
      const tagEnd = source.indexOf(">", index + 4);
      if (tagEnd > -1) {
        pushToken(source.slice(index, tagEnd + 1));
        index = tagEnd + 1;
        continue;
      }
    }

    if (tail.startsWith("![")) {
      let cursor = index + 2;
      let escaped = false;
      let altEnd = -1;
      while (cursor < source.length) {
        const char = source[cursor];
        if (escaped) {
          escaped = false;
          cursor += 1;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          cursor += 1;
          continue;
        }
        if (char === "]") {
          altEnd = cursor;
          break;
        }
        cursor += 1;
      }

      if (altEnd > -1) {
        cursor = altEnd + 1;
        while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
        if (source[cursor] === "(") {
          let depth = 0;
          let inEscape = false;
          let linkEnd = -1;
          for (let i = cursor; i < source.length; i += 1) {
            const char = source[i];
            if (inEscape) {
              inEscape = false;
              continue;
            }
            if (char === "\\") {
              inEscape = true;
              continue;
            }
            if (char === "(") {
              depth += 1;
              continue;
            }
            if (char === ")") {
              depth -= 1;
              if (depth === 0) {
                linkEnd = i;
                break;
              }
            }
          }
          if (linkEnd > -1) {
            pushToken(source.slice(index, linkEnd + 1));
            index = linkEnd + 1;
            continue;
          }
        }
      }
    }

    output.push(source[index]);
    index += 1;
  }

  return {
    text: output.join(""),
    mediaTokens
  };
}

function restoreMediaBlocks(input: string, mediaTokens: string[]): string {
  if (!mediaTokens.length) return input;
  return String(input || "").replace(MEDIA_TOKEN_RE, (full, rawIndex) => {
    const tokenIndex = Number.parseInt(String(rawIndex), 10);
    if (!Number.isFinite(tokenIndex) || tokenIndex < 0 || tokenIndex >= mediaTokens.length) return full;
    return mediaTokens[tokenIndex];
  });
}

function parseStandaloneMarkdownImageLine(line: string): { src: string; alt: string } | null {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^!\[([^\]]*)\]\((.+)\)$/);
  if (!match) return null;

  const rawAlt = String(match[1] || "").trim();
  let rawTarget = String(match[2] || "").trim();
  rawTarget = rawTarget
    .replace(/\s+"[^"]*"\s*$/, "")
    .replace(/\s+'[^']*'\s*$/, "")
    .trim();

  if (rawTarget.startsWith("<") && rawTarget.endsWith(">")) {
    rawTarget = rawTarget.slice(1, -1).trim();
  }

  if (!rawTarget) return null;
  return {
    src: rawTarget,
    alt: rawAlt || "İçerik görseli"
  };
}

export function extractStandaloneMarkdownImages(markdown: string): {
  images: Array<{ src: string; alt: string }>;
  markdown: string;
} {
  if (!markdown) {
    return { images: [], markdown: "" };
  }

  const lines = String(markdown || "").split(/\r?\n/);
  const images: Array<{ src: string; alt: string }> = [];
  const contentLines: string[] = [];

  for (const line of lines) {
    const parsedImage = parseStandaloneMarkdownImageLine(line);
    if (!parsedImage) {
      contentLines.push(line);
      continue;
    }
    images.push(parsedImage);
  }

  const remainingMarkdown = contentLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    images,
    markdown: remainingMarkdown ? normalizeMarkdownNarrativeLayout(remainingMarkdown) : ""
  };
}

function isStructuralMarkdownLine(line: string): boolean {
  const trimmed = String(line || "").trim();
  if (!trimmed) return false;
  return STRUCTURAL_LINE_RE.test(trimmed) || hasInlineMediaSyntax(trimmed);
}

function reflowLooseProseLines(markdown: string): string {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let proseBuffer: string[] = [];
  let inCodeFence = false;

  const flushProseBuffer = () => {
    if (!proseBuffer.length) return;
    const merged = proseBuffer.join(" ").replace(/\s+/g, " ").trim();
    proseBuffer = [];
    if (merged) output.push(merged);
  };

  for (const rawLine of lines) {
    const line = String(rawLine || "").replace(/\s+$/g, "");
    const trimmed = line.trim();

    if (/^\s*```/.test(line)) {
      flushProseBuffer();
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }

    if (inCodeFence) {
      output.push(line);
      continue;
    }

    if (!trimmed) {
      flushProseBuffer();
      if (output.length && output[output.length - 1] !== "") {
        output.push("");
      }
      continue;
    }

    if (isStructuralMarkdownLine(trimmed)) {
      flushProseBuffer();
      output.push(line);
      continue;
    }

    proseBuffer.push(trimmed);
  }

  flushProseBuffer();
  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function mergeOrphanedSingleLetterParagraphs(markdown: string): string {
  const paragraphs = String(markdown || "").split(/\n{2,}/);
  if (!paragraphs.length) return "";

  const merged: string[] = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const current = paragraphs[index].trim();
    if (!current) continue;

    const next = paragraphs[index + 1]?.trim() || "";
    if (/^[A-Za-zÇĞİÖŞÜ]$/u.test(current) && /^[a-zçğıöşü]/u.test(next)) {
      paragraphs[index + 1] = `${current}${next}`;
      continue;
    }

    merged.push(current);
  }

  return merged.join("\n\n").trim();
}

function isStructuralParagraph(paragraph: string): boolean {
  const lines = String(paragraph || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return false;
  return lines.some((line) => isStructuralMarkdownLine(line));
}

function hasTerminalSentenceEnding(text: string): boolean {
  return /[.!?…]["')\]]*$/u.test(String(text || "").trim());
}

function startsLikeContinuation(text: string): boolean {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  return (
    /^[a-zçğıöşü]/u.test(trimmed) ||
    /^["'“‘(\[]?[a-zçğıöşü]/u.test(trimmed) ||
    /^[,;:)\]]/.test(trimmed)
  );
}

function startsLikeSentenceFragment(text: string): boolean {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  return /^["'“‘(\[]?[A-Za-zÇĞİÖŞÜçğıöşü]/u.test(trimmed);
}

function joinParagraphBoundary(left: string, right: string): string {
  const prev = String(left || "").trim();
  const next = String(right || "").trim();
  if (!prev) return next;
  if (!next) return prev;

  if (
    /[A-Za-zÇĞİÖŞÜçğıöşü]$/u.test(prev) &&
    /^[a-zçğıöşü]/u.test(next) &&
    prev.length <= 3
  ) {
    return `${prev}${next}`;
  }

  if (prev.endsWith("-")) return `${prev.slice(0, -1)}${next}`;
  return `${prev} ${next}`.replace(/\s+/g, " ").trim();
}

function mergeAccidentallyBrokenParagraphs(markdown: string): string {
  const paragraphs = String(markdown || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) return paragraphs.join("\n\n");

  const merged: string[] = [];
  for (const paragraph of paragraphs) {
    if (!merged.length) {
      merged.push(paragraph);
      continue;
    }

    const previous = merged[merged.length - 1];
    if (isStructuralParagraph(previous) || isStructuralParagraph(paragraph)) {
      merged.push(paragraph);
      continue;
    }

    const previousEndsWithContinuationHint = /[,;:–—-]$/.test(previous.trim());
    const previousLooksIncomplete = !hasTerminalSentenceEnding(previous);
    const continuationStart = startsLikeContinuation(paragraph);
    const sentenceStart = startsLikeSentenceFragment(paragraph);
    const tinyPrefix = previous.trim().length <= 3;
    const shouldMerge =
      (tinyPrefix && continuationStart) ||
      (previousEndsWithContinuationHint && continuationStart) ||
      (previousLooksIncomplete && (continuationStart || sentenceStart));

    if (shouldMerge) {
      merged[merged.length - 1] = joinParagraphBoundary(previous, paragraph);
      continue;
    }

    merged.push(paragraph);
  }

  return merged.join("\n\n").trim();
}

export function normalizeMarkdownNarrativeLayout(input: string): string {
  const source = String(input || "").replace(/\r\n?/g, "\n").trim();
  if (!source) return "";
  const tokenized = tokenizeMediaBlocks(source);

  const dedupedAcrossBreaks = tokenized.text.replace(
    /\b([A-Za-zÇĞİÖŞÜçğıöşü]{3,})\b\s*\n+\s*\1\b/gu,
    "$1"
  );
  const reflowed = reflowLooseProseLines(dedupedAcrossBreaks);
  const mergedOrphans = mergeOrphanedSingleLetterParagraphs(reflowed);
  const mergedBrokenParagraphs = mergeAccidentallyBrokenParagraphs(mergedOrphans);
  const restored = restoreMediaBlocks(mergedBrokenParagraphs, tokenized.mediaTokens);
  return restored.replace(/\n{3,}/g, "\n\n").trim();
}
