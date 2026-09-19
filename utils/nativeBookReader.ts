import { registerPlugin, Capacitor } from '@capacitor/core';
import type { CourseData, TimelineNode } from '../types';
import { extractMarkdownImageSections } from '../components/StyledMarkdown';

export interface NativeBookPage {
  pageNumber: number;
  chapterTitle?: string;
  title?: string;
  contentHtml: string;
  plainText?: string;
  imageSrc?: string;
  imageAlt?: string;
}

export interface OpenBookOptions {
  title: string;
  bookType: string;
  pages: NativeBookPage[];
  initialPageIndex?: number;
  theme?: 'sepia' | 'light' | 'dark';
}

export interface OpenBookResult {
  closed: boolean;
  lastPageIndex: number;
}

export interface NativeBookReaderPluginInterface {
  openBook(options: OpenBookOptions): Promise<OpenBookResult>;
  closeBook(): Promise<{ closed: boolean }>;
}

export const NativeBookReader = registerPlugin<NativeBookReaderPluginInterface>('NativeBookReader');

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
    (node) => Boolean(node.content && node.content.trim())
  );

  let currentPageNumber = 1;

  for (let idx = 0; idx < targetNodes.length; idx++) {
    const node = targetNodes[idx];
    const chapterLabel = node.type === 'retention'
      ? 'Özet'
      : (courseData.bookType === 'story'
          ? `Çalışma Kitabı • Bölüm ${idx + 1}`
          : `Hikaye • Bölüm ${idx + 1}`);

    const rawContent = node.content || '';
    const imageSections = extractMarkdownImageSections(rawContent);

    if (imageSections.length > 0) {
      for (let sIdx = 0; sIdx < imageSections.length; sIdx++) {
        const section = imageSections[sIdx];
        const contentHtml = markdownToCleanHtml(section.markdown);

        pages.push({
          pageNumber: currentPageNumber++,
          chapterTitle: chapterLabel,
          title: sIdx === 0 ? node.title : undefined,
          contentHtml,
          imageSrc: section.imageSrc || undefined,
          imageAlt: section.imageAlt || undefined
        });
      }
    } else {
      // If no standalone images, split long chapters into page-sized chunks if needed
      const paragraphs = rawContent.split(/\n\n+/).filter(Boolean);
      const CHUNK_SIZE = 4; // ~3-4 paragraphs per page fits comfortably on mobile screens

      if (paragraphs.length <= CHUNK_SIZE) {
        pages.push({
          pageNumber: currentPageNumber++,
          chapterTitle: chapterLabel,
          title: node.title,
          contentHtml: markdownToCleanHtml(rawContent)
        });
      } else {
        for (let p = 0; p < paragraphs.length; p += CHUNK_SIZE) {
          const chunk = paragraphs.slice(p, p + CHUNK_SIZE).join('\n\n');
          pages.push({
            pageNumber: currentPageNumber++,
            chapterTitle: chapterLabel,
            title: p === 0 ? node.title : undefined,
            contentHtml: markdownToCleanHtml(chunk)
          });
        }
      }
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
    theme?: 'sepia' | 'light' | 'dark';
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
      title: courseData.title || 'Fortale Kitap',
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
