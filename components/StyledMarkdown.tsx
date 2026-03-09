import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Download, X } from 'lucide-react';
import { downloadFile } from '../utils/fileDownload';
import 'katex/dist/katex.min.css';

interface StyledMarkdownProps {
  content: string;
  className?: string;
  variant?: 'card' | 'inline';
  quoteFirstParagraph?: boolean;
  enableImageLightbox?: boolean;
  readerMode?: 'default' | 'fairytale-fullscreen';
}

const MATH_COMMAND_RE = /\\(?:sum|prod|vec|frac|sqrt|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|Delta|Sigma|Pi|Omega|times|cdot|div|pm|mp|neq|ne|leq|geq|approx|sim|to|rightarrow|leftarrow|infty|in|notin|subseteq|subset|supseteq|cup|cap|forall|exists|therefore|because)\b/;
const LIGHTBOX_ACTION_TOP = 'calc(env(safe-area-inset-top, 0px) + 76px)';

function normalizeLatexSnippet(input: string): string {
  let out = String(input || '');
  out = out
    .replace(/\\vec\s*([A-Za-z0-9])/g, '\\vec{$1}')
    .replace(/\\sum\\vec/g, '\\sum \\vec')
    .replace(/([A-Za-z])([0-9]{1,3})\b/g, '$1_{$2}');
  return out;
}

function normalizeMathMarkdownInput(markdown: string): string {
  if (!markdown) return '';

  const normalizedDelimiters = markdown
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, expr) => `\n$$\n${normalizeLatexSnippet(String(expr || '').trim())}\n$$\n`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, expr) => `$${normalizeLatexSnippet(String(expr || '').trim())}$`);

  const lines = normalizedDelimiters.split(/\r?\n/);
  const out: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (/!\[[^\]]*]\([^)]*\)|<img\b/i.test(line)) {
      out.push(line);
      continue;
    }
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      out.push(line);
      continue;
    }
    if (inCodeFence) {
      out.push(line);
      continue;
    }

    const match = line.match(/^(\s*(?:[-*+]\s+|\d+\.\s+|>\s*)?)(.*)$/);
    if (!match) {
      out.push(line);
      continue;
    }
    const prefix = match[1] || '';
    const body = match[2] || '';
    const trimmedBody = body.trim();
    if (!trimmedBody || trimmedBody.includes('$') || !MATH_COMMAND_RE.test(trimmedBody)) {
      out.push(line);
      continue;
    }

    const looksMathLike =
      /[=^_+\-*/()]/.test(trimmedBody) ||
      /\b\d+\b/.test(trimmedBody) ||
      /\\frac|\\sqrt|\\vec|\\sum|\\prod/.test(trimmedBody);

    if (!looksMathLike) {
      out.push(line);
      continue;
    }

    out.push(`${prefix}$${normalizeLatexSnippet(trimmedBody)}$`);
  }

  return out.join('\n');
}

function escapeFalseOrderedListMarkers(markdown: string): string {
  if (!markdown) return '';

  const temporalLeadRe =
    /^(\s*)(\d{1,4})\.\s+((?:yüzyıl(?:da|ın|ın sonlarında|ın başlarında)?|yıl(?:ında|larında)?|yy|asır|century|centuries|jahrhundert|siglo|siècle|secolo)\b.*)$/i;

  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(temporalLeadRe);
      if (!match) return line;
      const [, indent, number, rest] = match;
      return `${indent}${number}\\. ${rest}`;
    })
    .join('\n');
}

function deindentAccidentalProseBlocks(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }
    if (/!\[[^\]]*]\([^)]*\)|<img\b/i.test(line)) {
      output.push(line);
      continue;
    }

    if (inCodeFence) {
      output.push(line);
      continue;
    }

    const match = line.match(/^( {2,}|\t+)(\S.*)$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const body = match[2];
    const looksLikeMarkdownControl = /^([#>*-]|\d+\.)\s/.test(body);
    const looksCodeLike = /[{};=<>]/.test(body) && /[A-Za-z_]/.test(body);
    const looksLikeProse =
      /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(body) &&
      /\s/.test(body) &&
      !/^`/.test(body);

    if (looksLikeMarkdownControl || looksCodeLike || !looksLikeProse) {
      output.push(line);
      continue;
    }

    output.push(body);
  }

  return output.join('\n');
}

function normalizeStrayMarkdownMarkers(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }
    if (/!\[[^\]]*]\([^)]*\)|<img\b/i.test(line)) {
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

  return output.join('\n');
}

function isMarkdownTableSeparatorLine(line: string): boolean {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|')) return false;
  const cells = trimmed
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function stripImageTableCaptionRows(markdown: string): string {
  if (!markdown) return '';
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const currentLine = lines[i] || '';
    const nextLine = lines[i + 1] || '';
    const thirdLine = lines[i + 2] || '';
    const hasImageCells = /!\[[^\]]*]\([^)]*\)/.test(currentLine);
    const hasCaptionRow = thirdLine.trim().startsWith('|') && !/!\[[^\]]*]\([^)]*\)/.test(thirdLine);

    if (
      currentLine.trim().startsWith('|') &&
      hasImageCells &&
      isMarkdownTableSeparatorLine(nextLine) &&
      hasCaptionRow
    ) {
      output.push(currentLine);
      output.push(nextLine);
      i += 2; // Skip caption row.
      continue;
    }

    output.push(currentLine);
  }

  return output.join('\n');
}

function sanitizeVisualCaptionSubject(raw: string, fallback: string): string {
  const cleaned = String(raw || '')
    .replace(/^(?:detaylar|detay|details?|reinforcement)\s*/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function decodeBasicHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeHtmlImagesToMarkdown(markdown: string): string {
  if (!markdown || !/<img\b/i.test(markdown)) return markdown;

  const imgTagRe = /<img\b[^>]*>/gi;
  return markdown.replace(imgTagRe, (tag) => {
    const srcMatch =
      tag.match(/\bsrc\s*=\s*"([^"]+)"/i) ||
      tag.match(/\bsrc\s*=\s*'([^']+)'/i) ||
      tag.match(/\bsrc\s*=\s*([^\s>]+)/i);
    if (!srcMatch || !srcMatch[1]) return '';

    const altMatch =
      tag.match(/\balt\s*=\s*"([^"]*)"/i) ||
      tag.match(/\balt\s*=\s*'([^']*)'/i) ||
      tag.match(/\balt\s*=\s*([^\s>]+)/i);

    const src = decodeBasicHtmlEntities(String(srcMatch[1] || '').trim());
    if (!src) return '';
    const alt = decodeBasicHtmlEntities(String(altMatch?.[1] || 'İçerik görseli').trim()).replace(/\]/g, '\\]');
    return `![${alt}](${src})`;
  });
}

function normalizeGenericVisualCaptions(markdown: string): string {
  if (!markdown) return '';

  const replaceCoreTr = (_match: string, subject: string) => {
    const focus = sanitizeVisualCaptionSubject(subject, 'Konu');
    return `${focus} kavramının temel süreç ve ilişkilerini gösteren bilimsel sahne.`;
  };

  const replaceApplicationTr = (_match: string, subject: string) => {
    const focus = sanitizeVisualCaptionSubject(subject, 'Konu');
    return `${focus} konusunun gerçek uygulama bağlamını gösteren bilimsel sahne.`;
  };

  return markdown
    .replace(/(^|[\s|])Detaylar kavramını açıklayan bilimsel görselleştirme\./giu, '$1Konuya ait temel süreçleri ve kavram ilişkilerini gösteren bilimsel sahne.')
    .replace(/(^|[\s|])([^\n|.]{2,90}?)\s+kavramını açıklayan bilimsel görselleştirme\./giu, (m, p1, p2) => `${p1}${replaceCoreTr(m, p2)}`)
    .replace(/(^|[\s|])([^\n|.]{2,120}?)\s+konusunun günlük yaşam uygulamasını gösteren görselleştirme\./giu, (m, p1, p2) => `${p1}${replaceApplicationTr(m, p2)}`)
    .replace(/an explanatory visual illustrating the core concept\./gi, 'A scientific scene showing the core concept and its key relations.')
    .replace(/a visual showing the topic'?s real-life connection\./gi, 'A scientific scene showing the topic in a realistic application context.')
    .replace(/scientific visualization explaining the core concept\./gi, 'Scientific scene explaining the core concept and component relations.')
    .replace(/visualization of a practical real-life application scenario\./gi, 'Scientific scene depicting a realistic practical application context.');
}

const SYSTEM_IMAGE_CAPTION_LINE_RE = /^\s*[*_~`]*\s*g[öo]rsel\s+\d+\s*\/\s*\d+\s*(?:-\s*.+?)?\s*[*_~`]*\s*$/iu;
const SYSTEM_IMAGE_META_LINE_RE = /^\s*[*_~`]*\s*(?:global sequence index|scene excerpt for this specific image|previous scene cue|narrative timeline lock|visual structure requirement|panel-to-grid mapping)\b.*$/iu;

type MarkdownImageSection = {
  imageSrc: string;
  imageAlt: string;
  markdown: string;
};

function stripSystemImageCaptionLines(markdown: string): string {
  if (!markdown) return '';
  return markdown
    .split(/\r?\n/)
    .filter((line) => {
      const plain = String(line || '').trim();
      if (!plain) return true;
      if (SYSTEM_IMAGE_CAPTION_LINE_RE.test(plain)) return false;
      if (SYSTEM_IMAGE_META_LINE_RE.test(plain)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseStandaloneMarkdownImageLine(line: string): { src: string; alt: string } | null {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^!\[([^\]]*)\]\((.+)\)$/);
  if (!match) return null;
  const rawAlt = String(match[1] || '').trim();
  let rawTarget = String(match[2] || '').trim();
  rawTarget = rawTarget
    .replace(/\s+"[^"]*"\s*$/, '')
    .replace(/\s+'[^']*'\s*$/, '')
    .trim();
  if (rawTarget.startsWith('<') && rawTarget.endsWith('>')) {
    rawTarget = rawTarget.slice(1, -1).trim();
  }
  if (!rawTarget) return null;
  return {
    src: rawTarget,
    alt: rawAlt || 'İçerik görseli'
  };
}

function extractMarkdownImageSections(markdown: string): MarkdownImageSection[] {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const sections: MarkdownImageSection[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    const parsedImage = parseStandaloneMarkdownImageLine(line);
    if (!parsedImage) {
      buffer.push(line);
      continue;
    }

    const bufferedMarkdown = buffer.join('\n').trim();
    buffer = [];

    if (!sections.length) {
      sections.push({
        imageSrc: parsedImage.src,
        imageAlt: parsedImage.alt,
        markdown: bufferedMarkdown
      });
      continue;
    }

    const previousSection = sections[sections.length - 1];
    previousSection.markdown = [previousSection.markdown, bufferedMarkdown].filter(Boolean).join('\n\n').trim();
    sections.push({
      imageSrc: parsedImage.src,
      imageAlt: parsedImage.alt,
      markdown: ''
    });
  }

  if (!sections.length) return [];

  const trailingMarkdown = buffer.join('\n').trim();
  const lastSection = sections[sections.length - 1];
  lastSection.markdown = [lastSection.markdown, trailingMarkdown].filter(Boolean).join('\n\n').trim();
  return sections;
}

export default function StyledMarkdown({
  content,
  className = '',
  variant = 'card',
  quoteFirstParagraph = false,
  enableImageLightbox = true,
  readerMode = 'default'
}: StyledMarkdownProps) {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [lightboxOffset, setLightboxOffset] = useState({ x: 0, y: 0 });
  const lightboxImageRef = useRef<HTMLImageElement | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const pinchStartRef = useRef<{
    distance: number;
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const wrapperClass =
    variant === 'inline'
      ? 'bg-transparent text-white/90'
      : 'glass-panel bg-white/5 border-white/5 px-4 py-5 text-white/90 shadow-2xl rounded-2xl';
  const safeContent = useMemo(
    () => normalizeStrayMarkdownMarkers(
      deindentAccidentalProseBlocks(
        normalizeMathMarkdownInput(
          stripImageTableCaptionRows(
            normalizeGenericVisualCaptions(
              normalizeHtmlImagesToMarkdown(
                stripSystemImageCaptionLines(
                  escapeFalseOrderedListMarkers(content)
                )
              )
            )
          )
        )
      )
    ),
    [content]
  );
  const imageSections = useMemo(
    () => (readerMode === 'fairytale-fullscreen' ? extractMarkdownImageSections(safeContent) : []),
    [readerMode, safeContent]
  );

  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxImage(null);
    };
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxImage]);

  useEffect(() => {
    if (!lightboxImage) {
      setLightboxScale(1);
      setLightboxOffset({ x: 0, y: 0 });
      activePointersRef.current.clear();
      panStartRef.current = null;
      pinchStartRef.current = null;
      return;
    }
    setLightboxScale(1);
    setLightboxOffset({ x: 0, y: 0 });
    activePointersRef.current.clear();
    panStartRef.current = null;
    pinchStartRef.current = null;
  }, [lightboxImage]);

  const clampScale = (value: number) => Math.max(1, Math.min(5, value));

  const clampOffset = (x: number, y: number, scale: number): { x: number; y: number } => {
    const rect = lightboxImageRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    if (scale <= 1) return { x: 0, y: 0 };
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  };

  const applyScaleAroundPoint = (
    targetScaleRaw: number,
    clientX: number,
    clientY: number,
    baseScale = lightboxScale,
    baseOffset = lightboxOffset
  ) => {
    const targetScale = clampScale(targetScaleRaw);
    if (targetScale === 1) {
      setLightboxScale(1);
      setLightboxOffset({ x: 0, y: 0 });
      return;
    }
    const rect = lightboxImageRef.current?.getBoundingClientRect();
    if (!rect || baseScale <= 0) {
      setLightboxScale(targetScale);
      return;
    }
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const ux = (clientX - centerX - baseOffset.x) / baseScale;
    const uy = (clientY - centerY - baseOffset.y) / baseScale;
    const nextX = clientX - centerX - ux * targetScale;
    const nextY = clientY - centerY - uy * targetScale;
    const clamped = clampOffset(nextX, nextY, targetScale);
    setLightboxScale(targetScale);
    setLightboxOffset(clamped);
  };

  const handleLightboxPointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore pointer capture errors on unsupported browsers.
    }
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const active = Array.from(activePointersRef.current.values());
    if (event.pointerType === 'touch' && active.length === 1) {
      const now = Date.now();
      const previousTap = lastTapRef.current;
      if (
        previousTap &&
        now - previousTap.time < 300 &&
        Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) < 24
      ) {
        if (lightboxScale > 1) {
          setLightboxScale(1);
          setLightboxOffset({ x: 0, y: 0 });
        } else {
          applyScaleAroundPoint(2, event.clientX, event.clientY, 1, { x: 0, y: 0 });
        }
        lastTapRef.current = null;
        return;
      }
      lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
    }

    if (active.length === 2) {
      const [p1, p2] = active;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchStartRef.current = {
        distance: Math.max(dist, 1),
        scale: lightboxScale,
        offsetX: lightboxOffset.x,
        offsetY: lightboxOffset.y
      };
      panStartRef.current = null;
      return;
    }

    if (active.length === 1 && lightboxScale > 1) {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: lightboxOffset.x,
        offsetY: lightboxOffset.y
      };
    }
  };

  const handleLightboxPointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;
    event.stopPropagation();
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = Array.from(activePointersRef.current.values());

    if (active.length === 2 && pinchStartRef.current) {
      const [p1, p2] = active;
      const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midpointX = (p1.x + p2.x) / 2;
      const midpointY = (p1.y + p2.y) / 2;
      const nextScale = clampScale((currentDistance / pinchStartRef.current.distance) * pinchStartRef.current.scale);
      applyScaleAroundPoint(
        nextScale,
        midpointX,
        midpointY,
        pinchStartRef.current.scale,
        { x: pinchStartRef.current.offsetX, y: pinchStartRef.current.offsetY }
      );
      return;
    }

    if (active.length === 1 && panStartRef.current && lightboxScale > 1) {
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      const clamped = clampOffset(
        panStartRef.current.offsetX + dx,
        panStartRef.current.offsetY + dy,
        lightboxScale
      );
      setLightboxOffset(clamped);
    }
  };

  const handleLightboxPointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.delete(event.pointerId);
    }
    event.stopPropagation();
    const active = Array.from(activePointersRef.current.values());
    if (active.length < 2) {
      pinchStartRef.current = null;
    }
    if (active.length === 1 && lightboxScale > 1) {
      panStartRef.current = {
        x: active[0].x,
        y: active[0].y,
        offsetX: lightboxOffset.x,
        offsetY: lightboxOffset.y
      };
    } else if (active.length === 0) {
      panStartRef.current = null;
    }
  };

  const downloadLightboxImage = async () => {
    if (!lightboxImage?.src) return;
    const base = (lightboxImage.alt || 'fortale-gorsel')
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48);
    const fileName = `${base || 'fortale-gorsel'}.jpg`;
    await downloadFile({ url: lightboxImage.src, fileName });
  };

  const renderMarkdownBlock = (markdown: string, shouldQuoteFirstParagraph: boolean) => {
    let paragraphRenderCount = 0;
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(rawUrl) => {
          const url = String(rawUrl || '').trim();
          if (!url) return '';
          if (/^data:image\//i.test(url)) return url;
          if (/^https?:\/\//i.test(url)) return url;
          if (/^blob:/i.test(url)) return url;
          if (/^(\/|\.{1,2}\/)/.test(url)) return url;
          return '';
        }}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-5 border-b border-dashed border-white/20 pb-3 text-[22px] font-extrabold tracking-tight text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-8 border-b border-dashed border-white/10 pb-2 text-[18px] font-bold tracking-tight text-white/95">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-6 border-b border-dashed border-white/5 pb-1.5 text-[15px] font-bold text-white/90">
              {children}
            </h3>
          ),
          p: ({ children }) => {
            const isFirstParagraph = paragraphRenderCount === 0;
            paragraphRenderCount += 1;
            if (shouldQuoteFirstParagraph && isFirstParagraph) {
              return (
                <p className="my-4 text-[14px] leading-[1.8] tracking-wide text-white/85 italic text-center first:mt-0">
                  <span aria-hidden className="opacity-85">“</span>
                  {children}
                  <span aria-hidden className="opacity-85">”</span>
                </p>
              );
            }
            return <p className="my-3 text-[14px] leading-[1.7] tracking-wide text-white/75 first:mt-0">{children}</p>;
          },
          strong: ({ children }) => (
            <strong className="font-extrabold text-white/95">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-white/80">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-4 list-none space-y-2 pl-2 text-[14px] leading-[1.6] text-white/75">
              {React.Children.map(children, child => {
                if (!React.isValidElement(child)) return child;
                return React.cloneElement(child, {
                  className: "relative pl-5 before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-accent-green/60"
                } as React.HTMLAttributes<HTMLElement>);
              })}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              {...props}
              className="my-4 list-decimal space-y-2 pl-6 text-[14px] leading-[1.6] text-white/75"
            >
              {children}
            </ol>
          ),
          li: ({ children, className }) => <li className={className || ''}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-accent-green/40 bg-transparent px-4 py-2 text-white/70 italic rounded-r-lg">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) =>
            inline ? (
              <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-accent-green">
                {children}
              </code>
            ) : (
              <code className="block overflow-x-auto rounded-none border-0 bg-transparent p-0 font-mono text-[11px] leading-relaxed text-white/80">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto whitespace-pre-wrap break-words rounded-none border-0 bg-transparent p-0 text-white/80">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-6 border-white/10" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-white/10 bg-transparent">
              <table className="min-w-full text-left text-[11px] text-white/70">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/10 bg-transparent px-3 py-2 font-bold text-white">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-white/5 px-3 py-2">{children}</td>,
          img: ({ src, alt }) => {
            const safeSrc = src || '';
            const safeAlt = alt || 'İçerik görseli';
            if (!safeSrc) return null;
            return (
              <img
                src={safeSrc}
                alt={safeAlt}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onClick={() => {
                  if (!enableImageLightbox) return;
                  setLightboxImage({ src: safeSrc, alt: safeAlt });
                }}
                title={enableImageLightbox ? 'Tam ekran aç' : undefined}
                className={`my-4 w-full rounded-xl border border-white/10 bg-black/20 object-cover transition-opacity ${
                  enableImageLightbox ? 'cursor-zoom-in hover:opacity-95' : ''
                }`}
              />
            );
          }
        }}
      >
        {markdown}
      </ReactMarkdown>
    );
  };

  const renderInlineImage = (src: string, alt: string, heightClass: string, options?: { bare?: boolean }) => (
    <div className={options?.bare ? '' : 'overflow-hidden rounded-[24px] border border-white/10 bg-black/20 shadow-[0_18px_40px_rgba(0,0,0,0.24)]'}>
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onClick={() => {
          if (!enableImageLightbox) return;
          setLightboxImage({ src, alt });
        }}
        title={enableImageLightbox ? 'Tam ekran aç' : undefined}
        className={`w-full object-contain ${options?.bare ? '' : 'bg-black/20'} ${heightClass} transition-opacity ${
          enableImageLightbox ? 'cursor-zoom-in hover:opacity-95' : ''
        }`}
      />
    </div>
  );

  const markdownContent = useMemo(() => {
    if (readerMode === 'fairytale-fullscreen' && imageSections.length > 0) {
      let didQuoteLeadParagraph = false;
      return (
        <div className="space-y-8">
          {imageSections.map((section, index) => {
            const hasMarkdown = Boolean(section.markdown.trim());
            const shouldQuoteLeadParagraph = quoteFirstParagraph && hasMarkdown && !didQuoteLeadParagraph;
            if (shouldQuoteLeadParagraph) didQuoteLeadParagraph = true;
            return (
              <section key={`${section.imageSrc}-${index}`} className="relative">
                <div
                  className="sticky z-10 pb-2"
                  style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}
                >
                  {renderInlineImage(section.imageSrc, section.imageAlt, 'h-[30vh] min-h-[220px] max-h-[360px]', { bare: true })}
                </div>
                {hasMarkdown ? (
                  <div className="px-0.5">
                    {renderMarkdownBlock(section.markdown, shouldQuoteLeadParagraph)}
                  </div>
                ) : (
                  <div className="h-2" />
                )}
              </section>
            );
          })}
        </div>
      );
    }

    return renderMarkdownBlock(safeContent, quoteFirstParagraph);
  }, [readerMode, imageSections, quoteFirstParagraph, safeContent]);

  return (
    <article
      data-no-ui-translate="true"
      className={`${wrapperClass} ${className} prose-invert smartbook-markdown-plain`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
    >
      {markdownContent}
      {enableImageLightbox && lightboxImage && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1200] bg-black/55 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="absolute right-4 flex items-center gap-2"
            style={{ top: LIGHTBOX_ACTION_TOP }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  try {
                    await downloadLightboxImage();
                  } catch (error) {
                    console.error('Image download failed:', error);
                    alert('Görsel indirilemedi.');
                  }
                })();
              }}
              className="h-10 w-10 rounded-xl border border-dashed border-white/30 bg-black/65 text-white/90 inline-flex items-center justify-center active:scale-95"
              aria-label="Görseli indir"
              title="Görseli indir"
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="h-10 w-10 rounded-xl border border-dashed border-white/30 bg-black/65 text-white/90 inline-flex items-center justify-center active:scale-95"
              aria-label="Kapat"
              title="Kapat"
            >
              <X size={18} />
            </button>
          </div>
          <img
            ref={lightboxImageRef}
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            className={`max-h-[98vh] max-w-[98vw] object-contain select-none ${lightboxScale > 1 ? 'cursor-move' : 'cursor-zoom-in'}`}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (lightboxScale > 1) {
                setLightboxScale(1);
                setLightboxOffset({ x: 0, y: 0 });
                return;
              }
              applyScaleAroundPoint(2, event.clientX, event.clientY, 1, { x: 0, y: 0 });
            }}
            onPointerDown={handleLightboxPointerDown}
            onPointerMove={handleLightboxPointerMove}
            onPointerUp={handleLightboxPointerUp}
            onPointerCancel={handleLightboxPointerUp}
            onPointerLeave={handleLightboxPointerUp}
            style={{
              touchAction: 'none',
              transform: `translate(${lightboxOffset.x}px, ${lightboxOffset.y}px) scale(${lightboxScale})`,
              transformOrigin: 'center center',
              transition: activePointersRef.current.size > 0 ? 'none' : 'transform 120ms ease-out'
            }}
            draggable={false}
          />
        </div>,
        document.body
      )}
    </article>
  );
}
