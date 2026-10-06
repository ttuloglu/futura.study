import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { readerHeading } from './readerHeading';
import type { ReadingPosition } from './readingProgressModel';
import type { CourseData, TimelineNode } from '../types';
import { extractMarkdownImageSections } from '../components/StyledMarkdown';

export interface NativeBookPage {
  pageNumber: number;
  chapterTitle?: string;
  title?: string;
  contentHtml: string;
  markdown?: string;
  plainText?: string;
  imageSrc?: string;
  imageAlt?: string;
  audioSrc?: string;
}

export type NativeReaderTheme = 'sepia' | 'light' | 'dark' | 'pink' | 'blue';

export interface OpenBookOptions {
  title: string;
  bookType: string;
  pages: NativeBookPage[];
  initialPageIndex?: number;
  initialSourceIndex?: number;
  initialContentOffset?: number;
  sessionId?: string;
  theme?: NativeReaderTheme;
  autoPlay?: boolean;
  backgroundAudioSrc?: string;
  fontScale?: number;
}

export interface OpenBookResult {
  closed: boolean;
  lastPageIndex: number;
  theme?: NativeReaderTheme;
  fontScale?: number;
  action?: 'close' | 'prepareNarration' | 'downloadPDF' | 'downloadEPUB' | 'readingStats';
}

export interface NativeBookReaderPluginInterface {
  addListener(event: 'readingProgress', listener: (position: ReadingPosition & { sessionId: string }) => void): Promise<PluginListenerHandle>;
  openBook(options: OpenBookOptions): Promise<OpenBookResult>;
  closeBook(): Promise<{ closed: boolean }>;
}

export const NativeBookReader = registerPlugin<NativeBookReaderPluginInterface>('NativeBookReader');

function normalizeInlineHtmlImages(markup: string): string {
  if (!markup || !/<img\b/i.test(markup)) return markup;

  return markup.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch =
      tag.match(/\bsrc\s*=\s*"([^"]+)"/i) ||
      tag.match(/\bsrc\s*=\s*'([^']+)'/i) ||
      tag.match(/\bsrc\s*=\s*([^\s>]+)/i);
    if (!srcMatch?.[1]) return '';
    const altMatch =
      tag.match(/\balt\s*=\s*"([^"]*)"/i) ||
      tag.match(/\balt\s*=\s*'([^']*)'/i) ||
      tag.match(/\balt\s*=\s*([^\s>]+)/i);
    const src = srcMatch[1].replace(/&amp;/gi, '&').trim();
    const alt = (altMatch?.[1] || 'İçerik görseli')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\]/g, '\\]')
      .trim();
    return src ? `![${alt}](${src})` : '';
  });
}

/**
 * Checks if the native book reader plugin can be executed on this device.
 */
export function isNativeBookReaderAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Simple, fast Markdown to semantic HTML converter for book reading.
 */
function markdownToCleanHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown
    // Normalize newlines
    .replace(/\r\n/g, '\n')
    // Remove raw image markdown since images are handled separately
    .replace(/!\[(.*?)\]\((.*?)\)/g, '')
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Unordered Lists
    .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul>$1</ul>');

  // Convert double newlines to paragraphs
  const paragraphs = html
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return paragraphs
    .map((block) => {
      if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<blockquote')) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

/**
 * Transforms book chapters into pages suitable for Apple Books style UIPageViewController.
 */
export function prepareBookPagesForNativeReader(
  courseData: CourseData,
  nodes?: TimelineNode[]
): NativeBookPage[] {
  const pages: NativeBookPage[] = [];
  const targetNodes = (nodes && nodes.length > 0 ? nodes : courseData.nodes || []).filter(
    (node) => Boolean(
      node.content?.trim() ||
      node.pageText?.trim() ||
      node.pageImageUrl?.trim()
    )
  );

  let currentPageNumber = 1;

  for (let idx = 0; idx < targetNodes.length; idx++) {
    const node = targetNodes[idx];
    const title = readerHeading(node.title);
    const heading = title ? `## ${title}\n\n` : '';
    const chapterLabel = node.type === 'retention'
      ? 'Özet'
      : (courseData.bookType === 'story'
          ? `Çalışma Kitabı • Bölüm ${idx + 1}`
          : `Hikaye • Bölüm ${idx + 1}`);

    const rawContent = normalizeInlineHtmlImages(node.pageText?.trim() || node.content || '');
    const explicitImageSrc = node.pageImageUrl?.trim();
    const imageSections = extractMarkdownImageSections(rawContent);

    if (explicitImageSrc) {
      pages.push({
        pageNumber: currentPageNumber++,
        chapterTitle: chapterLabel,
        title,
        contentHtml: markdownToCleanHtml(rawContent),
        markdown: `${heading}${rawContent}`,
        imageSrc: explicitImageSrc,
        imageAlt: node.title || 'İçerik görseli'
      });
    } else if (imageSections.length > 0) {
      for (let sIdx = 0; sIdx < imageSections.length; sIdx++) {
        const section = imageSections[sIdx];
        const contentHtml = markdownToCleanHtml(section.markdown);

        pages.push({
          pageNumber: currentPageNumber++,
          chapterTitle: chapterLabel,
          title: sIdx === 0 ? title : undefined,
          contentHtml,
          markdown: `${sIdx === 0 ? heading : ''}${section.markdown}`,
          imageSrc: section.imageSrc || undefined,
          imageAlt: section.imageAlt || undefined
        });
      }
    } else {
      // Native pagination uses the actual device viewport and current font size.
      // Keep the complete section here so every rendered screen becomes a real curl page.
      pages.push({
        pageNumber: currentPageNumber++,
        chapterTitle: chapterLabel,
        title,
        contentHtml: markdownToCleanHtml(rawContent),
        markdown: `${heading}${rawContent}`
      });
    }
  }

  return pages;
}

/**
 * Opens the native book reader modal if running on iOS/Android native.
 * If running on Web, falls back to the onFallback callback.
 */
export async function openNativeBookReader(
  courseData: CourseData,
  nodes?: TimelineNode[],
  options?: {
    initialPageIndex?: number;
    theme?: NativeReaderTheme;
    onFallback?: () => void;
  }
): Promise<OpenBookResult | null> {
  if (!isNativeBookReaderAvailable()) {
    options?.onFallback?.();
    return null;
  }

  const pages = prepareBookPagesForNativeReader(courseData, nodes);
  if (pages.length === 0) {
    options?.onFallback?.();
    return null;
  }

  try {
    const result = await NativeBookReader.openBook({
      title: courseData.topic || 'Fortale Kitap',
      bookType: courseData.bookType || 'novel',
      pages,
      initialPageIndex: options?.initialPageIndex || 0,
      theme: options?.theme || 'sepia'
    });
    return result;
  } catch (error) {
    console.warn('NativeBookReader.openBook failed, falling back to web reader:', error);
    options?.onFallback?.();
    return null;
  }
}
