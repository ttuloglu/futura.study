import JSZip from 'jszip';
import katex from 'katex';
import { getBlob, getDownloadURL, getStorage, ref as storageRef } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import loadPdfMake from './pdfMakeLoader';
import { app as firebaseApp } from '../firebaseConfig';
import { CourseData, TimelineNode } from '../types';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import { saveBlobAsFile } from './fileDownload';

const EXPORT_ASSET_TIMEOUT_MS = 7000;
const EXPORT_NATIVE_ASSET_TIMEOUT_MS = 15000;
const MAX_PDF_INLINE_IMAGES = 8;
const MAX_EPUB_IMAGE_ASSETS = 10;
const DEFAULT_PDF_PAGE_BACKGROUND_COLOR = '#d9f2ff';
const EXPORT_IMAGE_OPTIMIZE_MAX_DIMENSION_PX = 1800;
const EXPORT_IMAGE_JPEG_QUALITY = 0.9;
const EXPORT_IMAGE_MIN_BYTES_FOR_OPTIMIZATION = 280 * 1024;
const EXPORT_IMAGE_MIN_SAVINGS_RATIO = 0.97;
const PDF_PAGE_WIDTH_PT = 595.28;
const PDF_PAGE_HORIZONTAL_MARGIN_PT = 40;
const PDF_TEXT_BLOCK_WIDTH_PT = PDF_PAGE_WIDTH_PT - PDF_PAGE_HORIZONTAL_MARGIN_PT * 2;
const MIN_PARAGRAPH_BLOCKS_BEFORE_IMAGE = 2;
const PDF_WIDE_IMAGE_MIN_ASPECT_RATIO = 1.3;
const PDF_WIDE_IMAGE_MAX_HEIGHT_PT = 320;
const PDF_COMPACT_IMAGE_MAX_HEIGHT_PT = 260;

type FirebaseStorageObjectReference = {
    bucketUrl?: string;
    objectPath: string;
};

const isDarkPdfBackground = (color: string): boolean => {
    const normalized = String(color || '').trim();
    const hex = normalized.match(/^#([0-9a-f]{6})$/i)?.[1];
    if (!hex) return false;

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.35;
};

const buildReadableBookDownloadFileName = (
    title: string,
    extension: 'pdf' | 'epub',
    fallback = 'kitap'
): string => {
    const normalizedTitle = String(title || '')
        .normalize('NFC')
        .replace(/\s+/g, ' ')
        .trim();
    return `${normalizedTitle || fallback}.${extension}`;
};

const FORTALE_PDF_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4F9B43" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
  <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
  <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
  <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
  <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
  <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
</svg>
`;

const extractMarkdownImageUrl = (rawTarget: string): string => {
    const value = String(rawTarget || '').trim();
    if (!value) return '';

    const angleWrappedMatch = value.match(/^<([^>]+)>(?:\s+["'][^"']*["'])?$/);
    if (angleWrappedMatch?.[1]) return angleWrappedMatch[1].trim();

    const plainWithTitleMatch = value.match(/^(\S+)(?:\s+["'][^"']*["'])?$/);
    if (plainWithTitleMatch?.[1]) return plainWithTitleMatch[1].trim();

    if (value.startsWith('<') && value.endsWith('>')) {
        return value.slice(1, -1).trim();
    }

    return value;
};

const blobToDataUrl = (blob: Blob): Promise<string | null> =>
    new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
    });

const convertImageDataUrlToPng = (dataUrl: string): Promise<string | null> =>
    new Promise<string | null>((resolve) => {
        const image = new Image();
        image.onload = () => {
            try {
                const width = image.naturalWidth || image.width;
                const height = image.naturalHeight || image.height;
                if (!width || !height) {
                    resolve(null);
                    return;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }
                ctx.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            } catch {
                resolve(null);
            }
        };
        image.onerror = () => resolve(null);
        image.src = dataUrl;
    });

const ensurePdfCompatibleImageDataUrl = async (dataUrl: string): Promise<string | null> => {
    const match = String(dataUrl || '').match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if (!match) return null;
    const mimeType = match[1].toLowerCase();
    if (mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        return dataUrl;
    }
    return convertImageDataUrlToPng(dataUrl);
};

const getImageDataUrlDimensions = (dataUrl: string): Promise<{ width: number; height: number } | null> =>
    new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            const width = image.naturalWidth || image.width || 0;
            const height = image.naturalHeight || image.height || 0;
            if (!width || !height) {
                resolve(null);
                return;
            }
            resolve({ width, height });
        };
        image.onerror = () => resolve(null);
        image.src = dataUrl;
    });

// Fetch image as Base64 Data URI
const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
    const normalizedUrl = extractMarkdownImageUrl(url);
    if (!normalizedUrl) return null;

    try {
        if (/^data:image\//i.test(normalizedUrl)) {
            const optimizedInlineImage = await optimizeImageDataUrlForExport(normalizedUrl);
            const candidate = optimizedInlineImage || normalizedUrl;
            return ensurePdfCompatibleImageDataUrl(candidate);
        }

        const blob = await fetchAssetBlob(normalizedUrl);
        if (!blob) {
            throw new Error('Blob could not be loaded');
        }
        const optimizedBlob = await optimizeImageBlobForExport(blob);
        const dataUrl = await blobToDataUrl(optimizedBlob);
        if (!dataUrl) return null;
        const compatibleDataUrl = await ensurePdfCompatibleImageDataUrl(dataUrl);
        if (!compatibleDataUrl) {
            console.warn('Unsupported image format for PDF:', normalizedUrl);
            return null;
        }
        return compatibleDataUrl;
    } catch (e) {
        console.warn('Failed to load image for PDF:', normalizedUrl, e);
        return null;
    }
};

const LATEX_SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
    [/\\sum/g, '∑'],
    [/\\prod/g, '∏'],
    [/\\times/g, '×'],
    [/\\cdot/g, '·'],
    [/\\div/g, '÷'],
    [/\\pm/g, '±'],
    [/\\mp/g, '∓'],
    [/\\neq/g, '≠'],
    [/\\ne/g, '≠'],
    [/\\leq/g, '≤'],
    [/\\geq/g, '≥'],
    [/\\approx/g, '≈'],
    [/\\sim/g, '∼'],
    [/\\to/g, '→'],
    [/\\rightarrow/g, '→'],
    [/\\leftarrow/g, '←'],
    [/\\infty/g, '∞'],
    [/\\in/g, '∈'],
    [/\\notin/g, '∉'],
    [/\\subseteq/g, '⊆'],
    [/\\subset/g, '⊂'],
    [/\\supseteq/g, '⊇'],
    [/\\cup/g, '∪'],
    [/\\cap/g, '∩'],
    [/\\forall/g, '∀'],
    [/\\exists/g, '∃'],
    [/\\therefore/g, '∴'],
    [/\\because/g, '∵'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\delta/g, 'δ'],
    [/\\epsilon/g, 'ε'],
    [/\\theta/g, 'θ'],
    [/\\lambda/g, 'λ'],
    [/\\mu/g, 'μ'],
    [/\\pi/g, 'π'],
    [/\\sigma/g, 'σ'],
    [/\\phi/g, 'φ'],
    [/\\omega/g, 'ω'],
    [/\\Delta/g, 'Δ'],
    [/\\Sigma/g, 'Σ'],
    [/\\Pi/g, 'Π'],
    [/\\Omega/g, 'Ω']
];

const SUPERSCRIPT_MAP: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ'
};

const SUBSCRIPT_MAP: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎'
};

const toSuperScript = (value: string): string =>
    String(value || '').split('').map((ch) => SUPERSCRIPT_MAP[ch] || ch).join('');

const toSubScript = (value: string): string =>
    String(value || '').split('').map((ch) => SUBSCRIPT_MAP[ch] || ch).join('');

const normalizeMathDelimitersForText = (text: string): string =>
    String(text || '')
        .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, expr) => ` $$${String(expr || '').trim()}$$ `)
        .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, expr) => ` $${String(expr || '').trim()}$ `);

const latexExprToReadableText = (expr: string): string => {
    let out = String(expr || '').trim();
    if (!out) return '';

    // Apply nested replacements a few times for simple nested forms.
    for (let i = 0; i < 4; i += 1) {
        const prev = out;
        out = out
            .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1/$2)')
            .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
            .replace(/\\text\s*\{([^{}]+)\}/g, '$1')
            .replace(/\\operatorname\s*\{([^{}]+)\}/g, '$1');
        if (out === prev) break;
    }

    for (const [pattern, value] of LATEX_SYMBOL_REPLACEMENTS) {
        out = out.replace(pattern, value);
    }

    out = out
        .replace(/\\vec\s*\{([^{}]+)\}/g, (_, v) => `${String(v || '').trim()}⃗`)
        .replace(/\\vec\s*([A-Za-z0-9])/g, (_, v) => `${String(v || '').trim()}⃗`)
        .replace(/\\left|\\right/g, '')
        .replace(/\\,/g, ' ')
        .replace(/\\;/g, ' ')
        .replace(/\\:/g, ' ')
        .replace(/\\!/g, '')
        .replace(/\\_/g, '_')
        .replace(/\\%/g, '%')
        .replace(/\\#/g, '#')
        .replace(/\\&/g, '&')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    out = out
        .replace(/\^\{([^{}]+)\}/g, (_, v) => toSuperScript(String(v || '').trim()))
        .replace(/\^([A-Za-z0-9+\-=()])/g, (_, v) => toSuperScript(String(v || '').trim()))
        .replace(/_\{([^{}]+)\}/g, (_, v) => toSubScript(String(v || '').trim()))
        .replace(/_([A-Za-z0-9+\-=()])/g, (_, v) => toSubScript(String(v || '').trim()))
        .replace(/([A-Za-z])([0-9]{1,3})\b/g, (_, a, b) => `${a}${toSubScript(b)}`);

    return out;
};

// Clean complex strings including Math ($, $$, \( \), \[ \]) -> readable plain text fallback
const stripLatex = (text: string): string => {
    const normalized = normalizeMathDelimitersForText(text);
    return normalized
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => ` ${latexExprToReadableText(String(expr || ''))} `)
        .replace(/\$([^$\n]+)\$/g, (_, expr) => ` ${latexExprToReadableText(String(expr || ''))} `)
        .replace(/\\vec\s*([A-Za-z0-9])/g, '\\vec{$1}')
        .replace(/\\sum\\vec/g, '\\sum \\vec')
        .replace(/\\(?:sum|prod|vec|frac|sqrt|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|Delta|Sigma|Pi|Omega|times|cdot|div|pm|mp|neq|ne|leq|geq|approx|sim|to|rightarrow|leftarrow|infty|in|notin|subseteq|subset|supseteq|cup|cap|forall|exists|therefore|because)\b[^\n]*/g, (match) => latexExprToReadableText(match))
        .replace(/([A-Za-z])\^([0-9]+)/g, (_, a, b) => `${a}${toSuperScript(String(b || ''))}`)
        .replace(/([A-Za-z])_([0-9]+)/g, (_, a, b) => `${a}${toSubScript(String(b || ''))}`);
};

const stripStrayMarkdown = (text: string): string => {
    // Remove isolated markdown formatting sequences not properly paired or meant to be parsed
    return text.replace(/\*\*\*\*/g, '')
        .replace(/\*\*\*/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/___/g, '')
        .replace(/__/g, '');
};

// Markdown -> PDF Content Spans
const cleanMarkdownToSpans = (text: string): any[] => {
    const spans: any[] = [];
    const pattern = /(\*\*\*.+?\*\*\*|___.+?___|\*\*.+?\*\*|__.+?__|~~.+?~~|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    let cleanText = stripLatex(text);

    while ((match = pattern.exec(cleanText)) !== null) {
        if (match.index > cursor) {
            spans.push({ text: cleanText.slice(cursor, match.index) });
        }

        const token = match[0];
        if ((token.startsWith('***') && token.endsWith('***')) || (token.startsWith('___') && token.endsWith('___'))) {
            spans.push({ text: token.slice(3, -3), bold: true, italics: true });
        } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
            spans.push({ text: token.slice(2, -2), bold: true });
        } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
            spans.push({ text: token.slice(1, -1), italics: true });
        } else if (token.startsWith('`') && token.endsWith('`')) {
            spans.push({ text: token.slice(1, -1), background: '#f0f0f0', font: 'Courier' }); // Simulate inline code
        } else if (token.startsWith('~~') && token.endsWith('~~')) {
            spans.push({ text: token.slice(2, -2), decoration: 'lineThrough' });
        } else {
            spans.push({ text: token });
        }
        cursor = pattern.lastIndex;
    }

    if (cursor < cleanText.length) {
        spans.push({ text: cleanText.slice(cursor) });
    }

    // Clean remaining stray markers from simple text outputs
    const finalSpans = spans.map(s => {
        if (!s.bold && !s.italics && !s.decoration && !s.background && typeof s.text === 'string') {
            return { ...s, text: stripStrayMarkdown(s.text) };
        }
        return s;
    }).filter(s => s.text !== '');

    return finalSpans.length > 0 ? finalSpans : [{ text: stripLatex(text) }];
};

const getDashedLine = () => ({
    canvas: [{
        type: 'line',
        x1: 0, y1: 0, x2: 510, y2: 0,
        lineWidth: 0.8,
        lineColor: '#6E8D78',
        dash: { length: 4, space: 3 }
    }],
    margin: [0, -1, 0, 10]
});

const getDashedLineCompact = () => ({
    canvas: [{
        type: 'line',
        x1: 0, y1: 0, x2: 510, y2: 0,
        lineWidth: 0.8,
        lineColor: '#6E8D78',
        dash: { length: 4, space: 3 }
    }],
    margin: [0, 3, 0, 6]
});

const getSectionTransitionSeparator = () => ({
    stack: [
        {
            canvas: [{
                type: 'line',
                x1: 0, y1: 0, x2: 510, y2: 0,
                lineWidth: 1,
                lineColor: '#5B7A99'
            }],
            margin: [0, 0, 0, 3]
        },
        {
            canvas: [{
                type: 'line',
                x1: 0, y1: 0, x2: 510, y2: 0,
                lineWidth: 0.7,
                lineColor: '#7F9AB6',
                dash: { length: 2, space: 4 }
            }],
            margin: [0, 0, 0, 0]
        }
    ],
    margin: [0, 0, 0, 7]
});

const PDF_FOOTER_LEFT_TEXT = 'Fortale | Build Your Epic';
const PDF_FOOTER_RIGHT_TEXT = 'Bu içerik yapay zeka tarafından üretilmiştir, hatalı olabilir, kontrol ediniz.';

const bookTypeLabelForExport = (bookType?: CourseData['bookType']): string => {
    if (bookType === 'fairy_tale') return 'Masal';
    if (bookType === 'story') return 'Hikaye';
    if (bookType === 'novel') return 'Roman';
    return 'Akademik';
};

const isAcademicBookForExport = (course: CourseData): boolean =>
    (course.bookType || 'academic') === 'academic';

const parseMarkdownTableCells = (line: string): string[] => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return [];
    return trimmed
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
        .filter((_, index, arr) => index < arr.length);
};

const isMarkdownTableSeparatorRow = (line: string): boolean => {
    const cells = parseMarkdownTableCells(line);
    if (!cells.length) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
};

type ParsedMarkdownTableBlock = {
    headers: string[];
    rows: string[][];
    endIndex: number;
};

const normalizeTableRowToColumnCount = (cells: string[], columnCount: number): string[] => {
    const trimmed = cells.slice(0, columnCount).map((cell) => cell.trim());
    while (trimmed.length < columnCount) trimmed.push('');
    return trimmed;
};

const parseGenericMarkdownTableBlock = (lines: string[], startIndex: number): ParsedMarkdownTableBlock | null => {
    const headerLine = lines[startIndex]?.trim() || '';
    const separatorLine = lines[startIndex + 1]?.trim() || '';
    if (!headerLine.startsWith('|')) return null;
    if (!isMarkdownTableSeparatorRow(separatorLine)) return null;

    const headerCells = parseMarkdownTableCells(headerLine).map((cell) => cell.trim());
    if (!headerCells.length) return null;
    if (headerCells.every((cell) => !cell)) return null;
    // Image table is handled by dedicated logic.
    if (headerCells.some((cell) => /!\[[^\]]*]\(([^)]+)\)/.test(cell))) return null;

    const rows: string[][] = [];
    let idx = startIndex + 2;
    while (idx < lines.length) {
        const rowLine = lines[idx]?.trim() || '';
        if (!rowLine.startsWith('|')) break;
        if (isMarkdownTableSeparatorRow(rowLine)) break;
        const rowCells = parseMarkdownTableCells(rowLine);
        if (!rowCells.length) break;
        rows.push(normalizeTableRowToColumnCount(rowCells, headerCells.length));
        idx += 1;
    }

    if (!rows.length) return null;
    return {
        headers: normalizeTableRowToColumnCount(headerCells, headerCells.length),
        rows,
        endIndex: idx - 1
    };
};

const normalizeBooleanAnswerToken = (value: string): 'true' | 'false' | null => {
    const v = String(value || '').trim().toLocaleLowerCase('tr-TR');
    if (!v) return null;
    if (v === 'doğru' || v === 'dogru' || v === 'true') return 'true';
    if (v === 'yanlış' || v === 'yanlis' || v === 'false') return 'false';
    return null;
};

const isTrueFalseQuestionForExport = (q: TimelineNode['questions'][number]): boolean => {
    const options = Array.isArray(q?.options) ? q.options : [];
    if (options.length !== 2) return false;
    const tokens = options.map(normalizeBooleanAnswerToken);
    return tokens.includes('true') && tokens.includes('false');
};

const deriveCorrectedStatementFromQuestion = (question: string): string => {
    let text = String(question || '')
        .replace(/\((?:\s*doğru\s*\/\s*yanlış\s*|true\s*\/\s*false\s*)\)/gi, ' ')
        .replace(/\b(doğru\s*mu|yanlış\s*mı|true\s*or\s*false)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    text = text.replace(/\s*[?？]\s*$/, '').trim();
    if (!text) return '';

    const before = text;
    text = text
        .replace(/\bdeğildir\b/gi, 'dir')
        .replace(/\bdeğil\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text.endsWith('.')) text += '.';
    if (text.toLocaleLowerCase('tr-TR') === before.toLocaleLowerCase('tr-TR') || text.length < 12) return '';
    return text;
};

const buildAnswerKeyLineForExport = (question: TimelineNode['questions'][number]): { prefix: string; text: string } => {
    if (!isTrueFalseQuestionForExport(question)) {
        const letter = String.fromCharCode(65 + (question.correctAnswer ?? 0));
        const answerText = question.options?.[question.correctAnswer ?? 0] || '';
        return { prefix: 'Cevap', text: `${letter}) ${answerText}` };
    }

    const answerToken = normalizeBooleanAnswerToken(question.options?.[question.correctAnswer ?? 0] || '');
    if (answerToken === 'true') {
        return { prefix: 'Doğrulama', text: 'Bu ifade doğrudur.' };
    }

    const corrected = deriveCorrectedStatementFromQuestion(question.question || '');
    if (corrected) {
        return { prefix: 'Doğru bilgi', text: corrected };
    }
    return { prefix: 'Doğru bilgi', text: 'Bu ifade hatalıdır; doğru bilgi ilgili bölüm açıklamalarında verilmiştir.' };
};

const GENERIC_REMEDIAL_CAPTION_PATTERNS: RegExp[] = [
    /kavramı görselleştiren açıklayıcı bir çizim/i,
    /konunun günlük hayat bağlantısını canlandıran bir görsel/i,
    /kavramını açıklayan bilimsel görselleştirme/i,
    /günlük yaşam uygulamasını gösteren görselleştirme/i,
    /detaylar\s+kavramını\s+açıklayan/i,
    /an explanatory visual illustrating the core concept/i,
    /a visual showing the topic'?s real-life connection/i,
    /scientific visualization explaining the core concept/i,
    /visualization of a practical real-life application scenario/i
];

const isGenericRemedialCaption = (text: string): boolean => {
    const value = String(text || '').trim();
    if (!value) return true;
    return GENERIC_REMEDIAL_CAPTION_PATTERNS.some((pattern) => pattern.test(value));
};

const GENERIC_LECTURE_CAPTION_PATTERNS: RegExp[] = [
    /bilimsel infografik/i,
    /scientific infographic/i,
    /giriş\s*bilimsel\s*infografik/i,
    /lecture\s*scientific\s*infographic/i
];

const isGenericLectureCaption = (text: string): boolean => {
    const value = String(text || '').trim();
    if (!value) return true;
    return GENERIC_LECTURE_CAPTION_PATTERNS.some((pattern) => pattern.test(value));
};

const buildMeaningfulLectureCaption = (topic: string, sectionTitle: string): string => {
    const focus = stripStrayMarkdown(
        stripLatex(
            (sectionTitle || topic || 'Konu')
                .replace(/\s+/g, ' ')
                .trim()
        )
    );
    const normalizedFocus = /^(giriş|introduction)$/i.test(focus) ? (topic || focus) : focus;
    return `${normalizedFocus} konusunun ana kavramlarını ve ilişkilerini açıklayan bilimsel infografik.`;
};

const normalizeRemedialCaptionFocus = (topic: string, sectionTitle: string): string => {
    const raw = stripStrayMarkdown(stripLatex((sectionTitle || topic || 'Konu').replace(/\s+/g, ' ').trim()))
        .replace(/^(?:detaylar|detay|peki[şs]t[iı]rme|pekistirme|reinforcement|details?|geli[şs]me|development)\s*[:\-–]\s*/iu, '')
        .replace(/\s*(?:[-–:]\s*)?(?:detaylar|detay|peki[şs]t[iı]rme|pekistirme|reinforcement|details?|geli[şs]me|development)\s*$/iu, '')
        .trim();

    if (!raw) return stripStrayMarkdown(stripLatex((topic || 'Konu').replace(/\s+/g, ' ').trim())) || 'Konu';
    if (/^(?:detaylar|detay|peki[şs]t[iı]rme|pekistirme|reinforcement|details?|geli[şs]me|development)$/iu.test(raw)) {
        return stripStrayMarkdown(stripLatex((topic || raw).replace(/\s+/g, ' ').trim())) || 'Konu';
    }
    return raw;
};

const buildMeaningfulRemedialCaption = (topic: string, sectionTitle: string, index: number): string => {
    const focus = normalizeRemedialCaptionFocus(topic, sectionTitle);
    if (index <= 0) return `${focus} bağlamında temel süreçler ve kavram ilişkilerini açıklayan bilimsel sahne.`;
    return `${focus} ilkesinin gerçek uygulama koşullarındaki etkisini gösteren bilimsel sahne.`;
};

const stripMarkdownImageCell = (cell: string): { alt: string; url: string } | null => {
    const match = cell.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (!match) return null;
    return { alt: match[1] || '', url: extractMarkdownImageUrl(match[2] || '') };
};

const normalizeHeaderTitle = (title: string, type: TimelineNode['type']): string => {
    const raw = (title || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';

    let cleaned = raw;
    const stripTail = (pattern: RegExp) => {
        cleaned = cleaned.replace(pattern, '').trim();
    };

    if (type === 'quiz') {
        stripTail(/\s*(?:[-–:]\s*)?(?:quiz|test)\s*$/i);
    } else if (type === 'exam') {
        stripTail(/\s*(?:[-–:]\s*)?(?:genel\s*)?(?:sınav|exam|test)\s*$/i);
    } else if (type === 'podcast') {
        stripTail(/\s*(?:[-–:]\s*)?(?:podcast)\s*$/i);
    } else if (type === 'lecture') {
        stripTail(/\s*(?:[-–:]\s*)?(?:giriş|giris|lecture|introduction)\s*$/iu);
    } else if (type === 'reinforce') {
        stripTail(/\s*(?:[-–:]\s*)?(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*$/iu);
    } else if (type === 'retention') {
        stripTail(/\s*(?:[-–:]\s*)?(?:kalıcılık|kalicilik|özet(?:\s*bilgi)?|ozet(?:\s*bilgi)?|summary(?:\s*card)?|sonu[çc]|conclusion)\s*$/iu);
    }

    return cleaned || raw;
};

const normalizeLectureContentHeading = (text: string): string => {
    const raw = (text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return raw;
    return raw
        .replace(/^(?:giriş|giris|lecture|introduction)\s*[:：-]\s*/iu, '')
        .replace(/\s*(?:[-–:]\s*)?(?:giriş|giris|lecture|introduction)\s*$/iu, '')
        .replace(/\s+/g, ' ')
        .trim() || raw;
};

const normalizeReinforceContentHeading = (text: string): string => {
    const raw = (text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return raw;
    return raw
        .replace(/^(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*[:：-]\s*/iu, '')
        .replace(/\s*(?:[-–:]\s*)?(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*$/iu, '')
        .replace(/\s+/g, ' ')
        .trim() || raw;
};

const normalizeExportCompareKey = (text: string): string => {
    const raw = stripStrayMarkdown(stripLatex(String(text || '')))
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s?/, '')
        .replace(/[“”"'`´]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return raw ? raw.toLocaleLowerCase('tr-TR') : '';
};

const getSectionPrefixStripRegex = (type: TimelineNode['type']): RegExp | null => {
    if (type === 'lecture') return /^(\s*#{1,6}\s*)?(?:giriş|giris|introduction|lecture)\s*[:：-]\s*/iu;
    if (type === 'reinforce') return /^(\s*#{1,6}\s*)?(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*[:：-]\s*/iu;
    if (type === 'retention') return /^(\s*#{1,6}\s*)?(?:özet(?:\s*bilgi)?|ozet(?:\s*bilgi)?|summary(?:\s*card)?|kavram\s*haritası|kavram\s*haritasi|sonu[çc]|conclusion)\s*[:：-]\s*/iu;
    if (type === 'podcast') return /^(\s*#{1,6}\s*)?(?:podcast)\s*[:：-]\s*/i;
    return null;
};

const getPlainSectionPrefixStripRegex = (type: TimelineNode['type']): RegExp | null => {
    if (type === 'lecture') return /^(?:giriş|giris|introduction|lecture)\s*[:：-]\s*/iu;
    if (type === 'reinforce') return /^(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*[:：-]\s*/iu;
    if (type === 'retention') return /^(?:özet(?:\s*bilgi)?|ozet(?:\s*bilgi)?|summary(?:\s*card)?|kavram\s*haritası|kavram\s*haritasi|sonu[çc]|conclusion)\s*[:：-]\s*/iu;
    if (type === 'podcast') return /^(?:podcast)\s*[:：-]\s*/i;
    return null;
};

const stripSectionPrefixFromRawLine = (line: string, type: TimelineNode['type']): string => {
    const pattern = getSectionPrefixStripRegex(type);
    if (!pattern) return line;
    return line.replace(pattern, '$1');
};

const stripSectionPrefixFromPlainText = (text: string, type: TimelineNode['type']): string => {
    const pattern = getPlainSectionPrefixStripRegex(type);
    if (!pattern) return text;
    return text.replace(pattern, '').trim();
};

const isGenericSectionHeadingForType = (text: string, type: TimelineNode['type']): boolean => {
    const normalized = normalizeExportCompareKey(text);
    if (!normalized) return true;
    if (type === 'lecture') return /^(giriş|giris|introduction|lecture)$/.test(normalized);
    if (type === 'reinforce') return /^(pekiştirme|pekistirme|detaylar|detay|details?|reinforcement|gelişme|gelisme|development)$/.test(normalized);
    if (type === 'retention') return /^(özet|ozet|özet bilgi|ozet bilgi|summary|summary card|kavram haritası|kavram haritasi|sonuç|sonuc|conclusion)$/.test(normalized);
    if (type === 'podcast') return /^podcast$/.test(normalized);
    return false;
};

const isGenericNodeTitleForType = (text: string, type: TimelineNode['type']): boolean => {
    const normalized = normalizeExportCompareKey(text);
    if (!normalized) return true;
    if (type === 'quiz') {
        return /^(quiz|test|kısa quiz|kisa quiz|mini quiz|soru seti)$/.test(normalized);
    }
    if (type === 'exam') {
        return /^(sınav|sinav|exam|test|ana sınav|ana sinav|genel sınav|genel sinav)$/.test(normalized);
    }
    return isGenericSectionHeadingForType(text, type);
};

type ExportNodeSanitizeContext = {
    nodeType: TimelineNode['type'];
    courseTopic: string;
    nodeTitle: string;
    contentTitle: string;
};

const buildDuplicateHeadingKeySet = (context: ExportNodeSanitizeContext): Set<string> => {
    const candidates = [
        context.courseTopic,
        normalizeHeaderTitle(context.nodeTitle, context.nodeType),
        context.contentTitle
    ]
        .map((value) => normalizeExportCompareKey(value))
        .filter(Boolean);
    return new Set(candidates);
};

const isDuplicateHeadingText = (text: string, duplicateKeys: Set<string>): boolean => {
    const key = normalizeExportCompareKey(text);
    return Boolean(key) && duplicateKeys.has(key);
};

const EXPORT_SYSTEM_IMAGE_LINE_RE = /^\s*[*_~`]*\s*g[öo]rsel\s+\d+\s*\/\s*\d+\s*(?:-\s*.+)?\s*[*_~`]*\s*$/iu;
const EXPORT_SYSTEM_META_LINE_RE =
    /^\s*[*_~`]*\s*(?:global sequence index|scene excerpt for this specific image|previous scene cue|narrative timeline lock|visual structure requirement|panel-to-grid mapping)\b/iu;

const stripExportSystemLines = (rawText: string): string => {
    const cleanedLines = String(rawText || '')
        .split('\n')
        .filter((line) => {
            const plain = stripStrayMarkdown(stripLatex(line)).trim();
            if (!plain) return true;
            if (EXPORT_SYSTEM_IMAGE_LINE_RE.test(plain)) return false;
            if (EXPORT_SYSTEM_META_LINE_RE.test(plain)) return false;
            return true;
        });

    return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const sanitizeNodeBodyLeadingDuplicates = (rawText: string, context: ExportNodeSanitizeContext): string => {
    const lines = stripExportSystemLines(rawText).split('\n');
    if (!lines.length) return '';

    const duplicateKeys = buildDuplicateHeadingKeySet(context);
    if (duplicateKeys.size === 0) return lines.join('\n');

    let nonEmptyScanned = 0;
    let idx = 0;
    while (idx < lines.length && nonEmptyScanned < 10) {
        const current = lines[idx];
        const trimmed = current.trim();
        if (!trimmed) {
            idx += 1;
            continue;
        }

        nonEmptyScanned += 1;
        const plain = trimmed.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').trim();
        const strippedPlain = stripSectionPrefixFromPlainText(plain, context.nodeType);

        if (
            isGenericSectionHeadingForType(plain, context.nodeType) ||
            isDuplicateHeadingText(plain, duplicateKeys) ||
            (strippedPlain !== plain && isDuplicateHeadingText(strippedPlain, duplicateKeys))
        ) {
            lines.splice(idx, 1);
            continue;
        }

        if (strippedPlain !== plain && strippedPlain) {
            lines[idx] = stripSectionPrefixFromRawLine(current, context.nodeType);
        }
        break;
    }

    return lines.join('\n');
};

export const exportCourseToPdf = async (
    course: CourseData,
    options?: {
        backgroundColor?: string;
    }
) => {
    const preparedCourse = await prepareCourseForRichExport(course);
    const isNarrativeBook =
        preparedCourse.bookType === 'fairy_tale' ||
        preparedCourse.bookType === 'story' ||
        preparedCourse.bookType === 'novel';
    const pdfContent: any[] = [];
    const pdfPageBackgroundColor = options?.backgroundColor?.trim() || DEFAULT_PDF_PAGE_BACKGROUND_COLOR;
    const isDarkPdfTheme = isDarkPdfBackground(pdfPageBackgroundColor);
    const pdfTitleColor = isDarkPdfTheme ? '#F8FAFC' : '#1F2937';
    const pdfSecondaryTextColor = isDarkPdfTheme ? '#D8E3F0' : '#4B5563';
    const pdfMutedTextColor = isDarkPdfTheme ? '#BCC9D8' : '#6B7280';
    const pdfBrandTextColor = isDarkPdfTheme ? '#FFFFFF' : '#1F4D7A';
    const pdfBodyTextColor = isDarkPdfTheme ? '#F4F7FB' : '#1F2937';
    const pdfSoftBodyTextColor = isDarkPdfTheme ? '#DCE5EF' : '#334155';
    const pdfHeadingTextColor = isDarkPdfTheme ? '#FFFFFF' : '#1A1A1A';
    const pdfTableHeaderTextColor = isDarkPdfTheme ? '#F8FAFC' : '#0F172A';
    const pdfTableHeaderFillColor = isDarkPdfTheme ? '#334155' : '#E8EEF8';
    const pdfTableEvenFillColor = isDarkPdfTheme ? '#1F2937' : '#F8FAFC';
    const pdfTableOddFillColor = isDarkPdfTheme ? '#111827' : '#FFFFFF';
    const pdfTableGridColor = isDarkPdfTheme ? '#64748B' : '#A8B8CC';
    const pdfQuoteFillColor = isDarkPdfTheme ? '#1F2937' : '#F8FAFC';
    const pdfQuoteAccentColor = isDarkPdfTheme ? '#E5EEF9' : '#334155';
    const pdfImportantColor = isDarkPdfTheme ? '#BFDBFE' : '#0F3C72';
    const pdfWarningColor = isDarkPdfTheme ? '#BBF7D0' : '#14532D';
    const PDF_FONT_BUMP = preparedCourse.bookType === 'fairy_tale' ? 2 : 1;
    const PDF_FONT_BUMP_MAX = preparedCourse.bookType === 'fairy_tale' ? 64 : 14;
    const buildPdfParagraphBlock = (text: string, margin: [number, number, number, number] = [0, 2, 0, 6]) => ({
        text: cleanMarkdownToSpans(text),
        fontSize: 11,
        lineHeight: 1.4,
        margin,
        alignment: 'justify' as const,
        color: pdfBodyTextColor
    });
    const buildAdaptiveFullWidthPdfImageBlock = async (imageData: string) => {
        const dimensions = await getImageDataUrlDimensions(imageData);
        const aspectRatio = dimensions && dimensions.height > 0 ? dimensions.width / dimensions.height : null;
        if (aspectRatio && aspectRatio >= PDF_WIDE_IMAGE_MIN_ASPECT_RATIO) {
            return {
                image: imageData,
                width: PDF_TEXT_BLOCK_WIDTH_PT,
                margin: [0, 8, 0, 8],
                alignment: 'center' as const
            };
        }

        return {
            image: imageData,
            fit: [PDF_TEXT_BLOCK_WIDTH_PT, isNarrativeBook ? PDF_COMPACT_IMAGE_MAX_HEIGHT_PT : PDF_WIDE_IMAGE_MAX_HEIGHT_PT],
            margin: [0, 8, 0, 8],
            alignment: 'center' as const
        };
    };
    const bumpPdfFontSizes = (value: any): any => {
        if (Array.isArray(value)) {
            return value.map((item) => bumpPdfFontSizes(item));
        }
        if (!value || typeof value !== 'object') {
            return value;
        }
        const next: Record<string, any> = {};
        for (const [key, item] of Object.entries(value)) {
            if (key === 'fontSize' && typeof item === 'number' && Number.isFinite(item)) {
                next[key] = item <= PDF_FONT_BUMP_MAX ? Math.round((item + PDF_FONT_BUMP) * 10) / 10 : item;
                continue;
            }
            next[key] = bumpPdfFontSizes(item);
        }
        return next;
    };
    const coverImageBase64 = preparedCourse.coverImageUrl ? await fetchImageAsBase64(preparedCourse.coverImageUrl) : null;
    const headerDate = new Date(preparedCourse.createdAt || new Date()).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const ageLabel = getSmartBookAgeGroupLabel(preparedCourse.ageGroup);
    const typeLabel = bookTypeLabelForExport(preparedCourse.bookType);
    const subGenreLabel = (preparedCourse.subGenre || '').trim() || 'Belirtilmedi';
    const categoryLabel = (preparedCourse.category || 'Belirtilmedi').trim();
    const creatorLabel = (preparedCourse.creatorName || 'Anonim').trim();

    const fallbackHue = Math.abs((preparedCourse.topic || '').split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0)) % 360;
    const fallbackCoverColor = `hsl(${fallbackHue}, 42%, 28%)`;
    let embeddedPdfImageCount = 0;

    const coverBlock = coverImageBase64
        ? { image: coverImageBase64, fit: [78, 104], alignment: 'left' as const }
        : {
            stack: [
                { canvas: [{ type: 'rect', x: 0, y: 0, w: 78, h: 104, r: 2, color: fallbackCoverColor }] },
                {
                    columns: [
                        { width: 10, svg: FORTALE_PDF_LOGO_SVG, margin: [10, -62, 2, 0] },
                        { width: '*', text: 'Fortale', color: '#ffffff', fontSize: 10, bold: true, margin: [0, -62, 0, 0] }
                    ],
                    columnGap: 0
                }
            ]
        };

    pdfContent.push({
        columns: [
            { width: 86, stack: [coverBlock] },
            {
                width: '*',
                stack: [
                    { text: preparedCourse.topic, fontSize: 18, bold: true, color: pdfTitleColor, margin: [0, 2, 0, 8] },
                    { text: `Tür: ${typeLabel} • Alt Tür: ${subGenreLabel} • ${ageLabel} • Kategori: ${categoryLabel}`, fontSize: 10.5, color: pdfSecondaryTextColor, margin: [0, 0, 0, 6] },
                    {
                        columns: [
                            {
                                width: 'auto',
                                text: `Kurgulayan: ${creatorLabel} | ${headerDate} |`,
                                fontSize: 10,
                                color: pdfMutedTextColor
                            },
                            {
                                width: 11,
                                svg: FORTALE_PDF_LOGO_SVG,
                                margin: [0, 0.6, 0, 0]
                            },
                            { width: 'auto', text: 'Fortale I Build Your Epic', fontSize: 10.2, bold: true, color: pdfBrandTextColor }
                        ],
                        columnGap: 2
                    }
                ]
            }
        ],
        columnGap: 14,
        margin: [0, 0, 0, 12]
    });
    pdfContent.push(getDashedLine());
    pdfContent.push({ text: ' ', fontSize: 10, margin: [0, 0, 0, 6] }); // spacer

    for (let nodeIndex = 0; nodeIndex < preparedCourse.nodes.length; nodeIndex++) {
        const node = preparedCourse.nodes[nodeIndex];
        const normalizedTitle = normalizeHeaderTitle(node.title, node.type);
        const contentTitle = buildNodeContentTitle(preparedCourse, node);
        const duplicateHeadingKeys = buildDuplicateHeadingKeySet({
            nodeType: node.type,
            courseTopic: preparedCourse.topic,
            nodeTitle: node.title,
            contentTitle
        });
        let nodeHeader = normalizedTitle;
        if (node.type === 'lecture' && !isNarrativeBook) nodeHeader = `GİRİŞ`;
        else if (node.type === 'podcast') nodeHeader = `PODCAST: ${normalizedTitle}`;
        else if (node.type === 'quiz') {
            const questionSuffix = node.questions ? ` • ${node.questions.length} Soru` : '';
            nodeHeader = isGenericNodeTitleForType(normalizedTitle, 'quiz')
                ? `QUİZ${questionSuffix}`
                : `QUİZ: ${normalizedTitle}${questionSuffix}`;
        }
        else if (node.type === 'reinforce') nodeHeader = isNarrativeBook ? `GELİŞME` : `DETAYLAR`;
        else if (node.type === 'exam') {
            const questionSuffix = node.questions ? ` • ${node.questions.length} Soru` : '';
            nodeHeader = isGenericNodeTitleForType(normalizedTitle, 'exam')
                ? `GENEL SINAV${questionSuffix}`
                : `GENEL SINAV: ${normalizedTitle}${questionSuffix}`;
        }
        else if (node.type === 'retention') nodeHeader = isNarrativeBook ? `SONUÇ` : `ÖZET`;

        // Keep sections in continuous flow; use a simple dashed line before the new heading.
        if (nodeIndex > 0) {
            pdfContent.push(getDashedLineCompact());
        }
        pdfContent.push({
            text: nodeHeader,
            fontSize: 14,
            bold: true,
            margin: [0, nodeIndex === 0 ? 0 : 5, 0, 5],
            color: pdfTitleColor
        });
        // Under heading: render the emphasized (solid + dashed) separator pair.
        pdfContent.push(getSectionTransitionSeparator());

        let rawText = '';
        const isQuiz = node.type === 'quiz' || node.type === 'exam' || node.type === 'retention';

        if (node.type === 'podcast' && node.podcastScript) {
            rawText = node.podcastScript;
        } else if (isQuiz && node.questions && node.questions.length > 0) {
            rawText = node.questions.map((q, i) => {
                const optionsStr = q.options.map((o, idx) => `${String.fromCharCode(65 + idx)}) ${o}`).join('\n');
                const separator = i < node.questions!.length - 1 ? '\n---\n' : '';
                return `**Soru ${i + 1}:** ${q.question}\n${optionsStr}${separator}\n`; // Correct answer handled later
            }).join('\n');
        } else if (node.content) {
            rawText = node.content;
        } else {
            rawText = '_Henüz içerik oluşturulmamış._';
        }

        if (node.type !== 'quiz' && node.type !== 'exam') {
            rawText = sanitizeNodeBodyLeadingDuplicates(rawText, {
                nodeType: node.type,
                courseTopic: preparedCourse.topic,
                nodeTitle: node.title,
                contentTitle
            });
        }

        const lines = rawText.split('\n');
        let inList = false;
        let listItems: any[] = [];
        let firstLectureParagraphRendered = false;
        let lastRenderedNoticeQuote = false;
        const isSectionTitleBullet = (value: string): boolean => {
            const clean = stripStrayMarkdown(stripLatex(value)).trim();
            if (!clean.endsWith(':')) return false;
            const body = clean.slice(0, -1).trim();
            if (!body) return false;
            const wordCount = body.split(/\s+/).filter(Boolean).length;
            return wordCount <= 6;
        };
        let paragraphBlocksSinceLastHeading = 0;
        let pendingImageBlocks: any[] = [];
        const flushPendingImageBlocks = (force = false) => {
            if (!pendingImageBlocks.length) return;
            if (force || paragraphBlocksSinceLastHeading >= MIN_PARAGRAPH_BLOCKS_BEFORE_IMAGE) {
                pdfContent.push(...pendingImageBlocks);
                pendingImageBlocks = [];
            }
        };
        const registerParagraphBlock = (count = 1) => {
            paragraphBlocksSinceLastHeading += count;
            flushPendingImageBlocks();
        };
        const queueOrRenderImageBlock = (block: any) => {
            if (paragraphBlocksSinceLastHeading >= MIN_PARAGRAPH_BLOCKS_BEFORE_IMAGE) {
                pdfContent.push(block);
                return;
            }
            pendingImageBlocks.push(block);
        };
        // Push accumulated list before switching context.
        const flushList = () => {
            if (inList) {
                pdfContent.push({ ul: listItems, margin: [0, 2, 0, 6], fontSize: 11 });
                listItems = [];
                inList = false;
                registerParagraphBlock();
            }
        };

        // Image Regex ![alt](url)
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            let lineContent = line;
            const getNextNonEmptyLine = (): string | null => {
                for (let idx = lineIndex + 1; idx < lines.length; idx++) {
                    const candidate = lines[idx].trim();
                    if (!candidate || candidate === '---' || candidate === '--') continue;
                    return candidate;
                }
                return null;
            };

            const trimmed = lineContent.trim();
            if (!trimmed) {
                flushList();
                continue;
            }

            if (trimmed === '---' || trimmed === '--') {
                flushList();
                if (isQuiz) {
                    pdfContent.push(getDashedLineCompact());
                }
                continue;
            }

            // Two-image markdown table (used for remedial visuals)
            if (trimmed.startsWith('|')) {
                const separatorLine = lines[lineIndex + 1]?.trim() || '';
                const captionLine = lines[lineIndex + 2]?.trim() || '';
                if (isMarkdownTableSeparatorRow(separatorLine) && captionLine.startsWith('|')) {
                    const rawCells = parseMarkdownTableCells(trimmed);
                    const imageCells = rawCells
                        .map(stripMarkdownImageCell)
                        .filter((item): item is { alt: string; url: string } => Boolean(item));

                    if (imageCells.length >= 2) {
                        flushList();
                        lastRenderedNoticeQuote = false;
                        const remainingSlots = Math.max(0, MAX_PDF_INLINE_IMAGES - embeddedPdfImageCount);
                        const pair = imageCells.slice(0, Math.min(2, remainingSlots));
                        if (pair.length === 0) {
                            lineIndex += 2;
                            continue;
                        }
                        const imageDataList = await Promise.all(
                            pair.map(async (cell) => {
                                const cleanUrl = extractMarkdownImageUrl(cell.url);
                                const base64Data = await fetchImageAsBase64(cleanUrl);
                                const imageBlock = base64Data ? await buildAdaptiveFullWidthPdfImageBlock(base64Data) : null;
                                return { ...cell, base64Data, imageBlock };
                            })
                        );
                        embeddedPdfImageCount += imageDataList.filter((item) => Boolean(item.base64Data)).length;

                        imageDataList.forEach((item) => {
                            if (item.imageBlock) {
                                queueOrRenderImageBlock(item.imageBlock);
                                return;
                            }

                            queueOrRenderImageBlock({
                                text: `[Görsel İndirilemedi]`,
                                color: '#999999',
                                italics: true,
                                alignment: 'center',
                                margin: [0, 20, 0, 8]
                            });
                        });

                        lineIndex += 2;
                        continue;
                    }

                    // Cloud fallback may leave an empty image row like "| |" and only captions.
                    // Skip this table block to avoid raw markdown leaking into the export.
                    if (rawCells.length >= 2 && rawCells.slice(0, 2).every((cell) => !cell.trim())) {
                        flushList();
                        lastRenderedNoticeQuote = false;
                        lineIndex += 2;
                        continue;
                    }
                }

                const genericTable = parseGenericMarkdownTableBlock(lines, lineIndex);
                if (genericTable) {
                    flushList();
                    lastRenderedNoticeQuote = false;
                    const body = [
                        genericTable.headers.map((cell) => ({
                            text: cleanMarkdownToSpans(stripLatex(stripStrayMarkdown(cell))),
                            bold: true,
                            color: pdfTableHeaderTextColor,
                            margin: [6, 5, 6, 5]
                        })),
                        ...genericTable.rows.map((row) =>
                            row.map((cell) => ({
                                text: cleanMarkdownToSpans(stripLatex(stripStrayMarkdown(cell))),
                                color: pdfBodyTextColor,
                                margin: [6, 5, 6, 5]
                            }))
                        )
                    ];

                    pdfContent.push({
                        table: {
                            headerRows: 1,
                            widths: Array(genericTable.headers.length).fill('*'),
                            body
                        },
                        layout: {
                            fillColor: (rowIndex: number) => (rowIndex === 0 ? pdfTableHeaderFillColor : rowIndex % 2 === 0 ? pdfTableEvenFillColor : pdfTableOddFillColor),
                            hLineColor: () => pdfTableGridColor,
                            vLineColor: () => pdfTableGridColor,
                            hLineWidth: () => 0.8,
                            vLineWidth: () => 0.8
                        },
                        margin: [0, 8, 0, 10]
                    });
                    registerParagraphBlock();
                    lineIndex = genericTable.endIndex;
                    continue;
                }
            }

            // Image Parsing
            imageRegex.lastIndex = 0;
            let imgMatch = imageRegex.exec(trimmed);
            if (imgMatch) {
                flushList();
                if (embeddedPdfImageCount >= MAX_PDF_INLINE_IMAGES) {
                    lastRenderedNoticeQuote = false;
                    continue;
                }
                const url = imgMatch[2];
                const cleanUrl = extractMarkdownImageUrl(url);
                const base64Data = await fetchImageAsBase64(cleanUrl);
                if (base64Data) {
                    lastRenderedNoticeQuote = false;
                    embeddedPdfImageCount += 1;
                    const imageBlock = await buildAdaptiveFullWidthPdfImageBlock(base64Data);
                    queueOrRenderImageBlock(imageBlock);
                } else {
                    lastRenderedNoticeQuote = false;
                    queueOrRenderImageBlock({
                        text: `[Görsel İndirilemedi: ${cleanUrl}]`,
                        color: '#999999',
                        italics: true
                    });
                }
                continue;
            }

            // Headers - dynamically strip any number of hashes
            const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
            if (headerMatch) {
                flushList();
                const level = headerMatch[1].length;
                const text = node.type === 'lecture'
                    ? normalizeLectureContentHeading(headerMatch[2])
                    : node.type === 'reinforce'
                        ? normalizeReinforceContentHeading(headerMatch[2])
                        : headerMatch[2];
                if (node.type === 'lecture' || node.type === 'reinforce') {
                    const normalized = String(text || '').trim();
                    const genericPattern = node.type === 'lecture'
                        ? /^(giriş|introduction)$/i
                        : /^(pekiştirme|detaylar|details?|reinforcement)$/i;
                    if (!normalized || genericPattern.test(normalized)) {
                        continue;
                    }
                }
                if (isDuplicateHeadingText(text, duplicateHeadingKeys)) {
                    continue;
                }
                flushPendingImageBlocks(true);
                paragraphBlocksSinceLastHeading = 0;
                const headingPlain = stripStrayMarkdown(stripLatex(text));
                const headingKey = headingPlain.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
                const isDidYouKnowHeading = headingKey.includes('bunlarıbiliyormuydunuz') || headingKey.includes('didyouknow');
                const sizes = [18, 16, 14, 12, 11, 10]; // Map H1->H6 font sizes
                lastRenderedNoticeQuote = false;
                // Use dark grey for literary books
                pdfContent.push({
                    text: headingPlain,
                    fontSize: sizes[level - 1] || 12,
                    bold: true,
                    margin: [0, 12, 0, 6],
                    color: pdfHeadingTextColor
                });
                continue;
            }

            // Lists
            if (trimmed.match(/^[-*+]\s/)) {
                const listBody = trimmed.replace(/^[-*+]\s+/, '').trim();
                const nextLine = getNextNonEmptyLine();
                const nextIsList = nextLine ? /^[-*+]\s|^\d+\.\s/.test(nextLine) : false;
                if (isSectionTitleBullet(listBody) && nextIsList) {
                    flushList();
                    lastRenderedNoticeQuote = false;
                    pdfContent.push({
                        text: cleanMarkdownToSpans(listBody),
                        fontSize: 12,
                        bold: true,
                        margin: [0, 10, 0, 4],
                        color: pdfTitleColor
                    });
                    continue;
                }
                inList = true;
                lastRenderedNoticeQuote = false;
                listItems.push({ text: cleanMarkdownToSpans(listBody), lineHeight: 1.4 });
                continue;
            } else if (trimmed.match(/^\d+\.\s/)) {
                const orderedBody = trimmed.replace(/^\d+\.\s+/, '').trim();
                const nextLine = getNextNonEmptyLine();
                const nextIsList = nextLine ? /^[-*+]\s|^\d+\.\s/.test(nextLine) : false;
                if (isSectionTitleBullet(orderedBody) && nextIsList) {
                    flushList();
                    lastRenderedNoticeQuote = false;
                    pdfContent.push({
                        text: cleanMarkdownToSpans(orderedBody),
                        fontSize: 12,
                        bold: true,
                        margin: [0, 10, 0, 4],
                        color: pdfTitleColor
                    });
                    continue;
                }
                // Ordered Lists parsed as plain text spans for simplicity
                flushList();
                lastRenderedNoticeQuote = false;
                pdfContent.push({ text: cleanMarkdownToSpans(trimmed), margin: [15, 2, 0, 6], fontSize: 11, lineHeight: 1.4 });
                registerParagraphBlock();
                continue;
            }

            if (trimmed.startsWith('>')) {
                flushList();
                const quoteLines: string[] = [];
                let quoteIndex = lineIndex;
                while (quoteIndex < lines.length && lines[quoteIndex].trim().startsWith('>')) {
                    quoteLines.push(lines[quoteIndex].trim().replace(/^>\s?/, '').trim());
                    quoteIndex += 1;
                }
                lineIndex = quoteIndex - 1;
                const quoteText = quoteLines.join(' ').trim();
                const quoteLower = quoteText.toLocaleLowerCase('tr-TR');
                const quoteCompact = quoteLower.replace(/\s+/g, '');
                const isImportant = /^önemli\s*[:：]?/i.test(quoteText) || quoteLower.includes('önemli');
                const isWarning = /^(dikkat|sık hata)\s*[:：]?/i.test(quoteText) || quoteLower.includes('dikkat') || quoteLower.includes('sık hata');
                if (isImportant || isWarning) {
                    const normalizedQuote = stripLatex(stripStrayMarkdown(quoteText))
                        .replace(/^(önemli|dikkat|sık hata)\s*[:：-]?\s*/iu, '')
                        .trim();
                    const quoteSpans = cleanMarkdownToSpans(normalizedQuote || quoteText).map((span) => ({
                        ...span,
                        italics: true
                    }));
                    pdfContent.push({
                        text: [{ text: '“', italics: true }, ...quoteSpans, { text: '”', italics: true }],
                        fontSize: 11.2,
                        lineHeight: 1.48,
                        alignment: 'center',
                        color: isImportant ? pdfImportantColor : pdfWarningColor,
                        margin: [12, lastRenderedNoticeQuote ? 14 : 8, 12, 10]
                    });
                    registerParagraphBlock();
                    lastRenderedNoticeQuote = true;
                    continue;
                }

                pdfContent.push({
                    table: {
                        widths: ['*'],
                        body: [[{
                            text: cleanMarkdownToSpans(stripLatex(stripStrayMarkdown(quoteText))),
                            color: pdfQuoteAccentColor,
                            margin: [8, 7, 8, 7]
                        }]]
                    },
                    layout: {
                        fillColor: () => pdfQuoteFillColor,
                        hLineColor: () => pdfQuoteFillColor,
                        vLineColor: () => pdfQuoteFillColor,
                        hLineWidth: () => 0,
                        vLineWidth: () => 0
                    },
                    margin: [0, 6, 0, 9]
                });
                registerParagraphBlock();
                lastRenderedNoticeQuote = false;
                continue;
            }

            if (node.type === 'lecture' && !firstLectureParagraphRendered && !isNarrativeBook) {
                const introSpans = cleanMarkdownToSpans(trimmed).map((span) => ({ ...span, italics: true }));
                lastRenderedNoticeQuote = false;
                pdfContent.push({
                    text: [{ text: '“', italics: true }, ...introSpans, { text: '”', italics: true }],
                    fontSize: 11.3,
                    lineHeight: 1.5,
                    margin: [12, 4, 12, 10],
                    alignment: 'center',
                    color: pdfQuoteAccentColor
                });
                registerParagraphBlock();
                firstLectureParagraphRendered = true;
                continue;
            }

            lastRenderedNoticeQuote = false;
            pdfContent.push(buildPdfParagraphBlock(trimmed));
            registerParagraphBlock();
        }

        // Final flush if list ended stream.
        flushList();
        flushPendingImageBlocks(true);

        // Add Answer Key at the end of quiz sections
        if (isQuiz && node.questions && node.questions.length > 0) {
            pdfContent.push({ text: 'Cevap Anahtarı', fontSize: 12, bold: true, margin: [0, 15, 0, 5], color: '#E53935' });
            pdfContent.push(getDashedLineCompact());

            for (let i = 0; i < node.questions.length; i++) {
                const q = node.questions[i];
                const answerLine = buildAnswerKeyLineForExport(q as any);

                pdfContent.push({
                    stack: [
                        {
                            columns: [
                                {
                                    width: 'auto',
                                    text: `${i + 1}.`,
                                    color: '#2563EB',
                                    bold: true,
                                    fontSize: 10,
                                    margin: [0, 0, 8, 0]
                                },
                                {
                                    width: '*',
                                    text: [
                                        { text: 'Soru: ', bold: true, color: pdfTitleColor },
                                        ...cleanMarkdownToSpans(q.question || '')
                                    ],
                                    fontSize: 10.5,
                                    lineHeight: 1.35,
                                    color: pdfBodyTextColor
                                }
                            ],
                            columnGap: 6
                        },
                        {
                            text: [
                                { text: `${answerLine.prefix}: `, bold: true, color: '#15803D' },
                                ...cleanMarkdownToSpans(answerLine.text)
                            ],
                            fontSize: 10.5,
                            lineHeight: 1.35,
                            margin: [22, 4, 0, 0],
                            color: pdfSoftBodyTextColor
                        }
                    ],
                    margin: [0, 2, 0, 6]
                });

                if (i < node.questions.length - 1) {
                    pdfContent.push(getDashedLineCompact());
                }
            }
        }
    }

    const docDefinition: any = {
        content: bumpPdfFontSizes(pdfContent),
        pageMargins: [PDF_PAGE_HORIZONTAL_MARGIN_PT, 50, PDF_PAGE_HORIZONTAL_MARGIN_PT, 72],
        background: () => ({
            canvas: [
                {
                    type: 'rect',
                    x: 0,
                    y: 0,
                    w: PDF_PAGE_WIDTH_PT,
                    h: 841.89,
                    color: pdfPageBackgroundColor
                }
            ]
        }),
        footer: (currentPage: number, pageCount: number) => ({
            margin: [PDF_PAGE_HORIZONTAL_MARGIN_PT, 6, PDF_PAGE_HORIZONTAL_MARGIN_PT, 10],
            stack: [
                {
                    text: `${currentPage} / ${pageCount}`,
                    alignment: 'center',
                    fontSize: 9,
                    color: pdfMutedTextColor
                }
            ]
        }),
        defaultStyle: { font: 'Roboto', color: pdfBodyTextColor }
    };

    try {
        const pdfMake = await loadPdfMake();
        const pdfDoc = pdfMake.createPdf(docDefinition);
        const pdfBlob = await pdfDoc.getBlob();
        await saveBlobAsFile({
            blob: pdfBlob,
            fileName: buildReadableBookDownloadFileName(preparedCourse.topic, 'pdf')
        });
    } catch (e) {
        console.error("PDF Export error:", e);
        alert("PDF oluşturulamadı!");
    }
};

export const exportNodeToPdf = async (course: CourseData, node: TimelineNode) => {
    const singleNodeCourse: CourseData = {
        ...course,
        topic: `${course.topic} - ${node.title}`,
        nodes: [node]
    };

    return exportCourseToPdf(singleNodeCourse);
};

type EpubAssetKind = 'image' | 'audio';

type EpubCollectedAsset = {
    id: string;
    href: string;
    mediaType: string;
    bytes: Uint8Array;
    kind: EpubAssetKind;
    sourceKey?: string;
};

type EpubAssetRef = Pick<EpubCollectedAsset, 'id' | 'href' | 'mediaType' | 'kind'>;

const escapeHtml = (value: string): string =>
    (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const escapeXml = (value: string): string =>
    (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const slugifyFileName = (value: string, fallback = 'smartbook'): string => {
    const normalized = (value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
    return normalized || fallback;
};

const detectMediaTypeFromBytes = (bytes: Uint8Array): string | null => {
    if (!bytes.length) return null;

    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        return 'image/png';
    }

    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    if (
        bytes.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61
    ) {
        return 'image/gif';
    }

    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'image/webp';
    }

    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x41 &&
        bytes[10] === 0x56 &&
        bytes[11] === 0x45
    ) {
        return 'audio/wav';
    }

    if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        return 'audio/ogg';
    }

    if (
        bytes.length >= 4 &&
        ((bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) || (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33))
    ) {
        return 'audio/mpeg';
    }

    if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
        return 'audio/webm';
    }

    if (
        bytes.length >= 12 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70
    ) {
        return 'audio/mp4';
    }

    try {
        const snippet = new TextDecoder('utf-8').decode(bytes.slice(0, 512)).trimStart().toLowerCase();
        if (snippet.startsWith('<svg') || (snippet.startsWith('<?xml') && snippet.includes('<svg'))) {
            return 'image/svg+xml';
        }
    } catch {
        // Ignore text decode errors; binary sniffing already handled.
    }

    return null;
};

const parseDataUrlMimeType = (value: string): string | null => {
    const match = String(value || '').match(/^data:([^;,]+)(?:;|,)/i);
    if (!match?.[1]) return null;
    return match[1].trim().toLowerCase();
};

const isInlineDataUrl = (value: string): boolean => /^data:/i.test(String(value || '').trim());

const inferMediaType = (blob: Blob, url?: string): string => {
    const explicit = (blob.type || '').split(';')[0].trim().toLowerCase();
    if (explicit && explicit !== 'application/octet-stream') return explicit;
    const path = (url || '').split('?')[0].toLowerCase();
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.gif')) return 'image/gif';
    if (path.endsWith('.svg')) return 'image/svg+xml';
    if (path.endsWith('.wav')) return 'audio/wav';
    if (path.endsWith('.mp3')) return 'audio/mpeg';
    if (path.endsWith('.m4a')) return 'audio/mp4';
    if (path.endsWith('.ogg')) return 'audio/ogg';
    if (path.endsWith('.webm')) return 'audio/webm';
    if (explicit) return explicit;
    return 'application/octet-stream';
};

const inferMediaTypeFromUrl = (url: string): string => {
    const dataUrlMimeType = parseDataUrlMimeType(url);
    if (dataUrlMimeType) return dataUrlMimeType;

    const path = String(url || '').split('?')[0].toLowerCase();
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.gif')) return 'image/gif';
    if (path.endsWith('.svg')) return 'image/svg+xml';
    if (path.endsWith('.wav')) return 'audio/wav';
    if (path.endsWith('.mp3')) return 'audio/mpeg';
    if (path.endsWith('.m4a')) return 'audio/mp4';
    if (path.endsWith('.ogg')) return 'audio/ogg';
    if (path.endsWith('.webm')) return 'audio/webm';
    return 'application/octet-stream';
};

const extensionForMediaType = (mediaType: string, fallback = 'bin'): string => {
    const type = (mediaType || '').toLowerCase();
    if (type === 'image/png') return 'png';
    if (type === 'image/jpeg') return 'jpg';
    if (type === 'image/webp') return 'webp';
    if (type === 'image/gif') return 'gif';
    if (type === 'image/svg+xml') return 'svg';
    if (type === 'audio/wav' || type === 'audio/x-wav') return 'wav';
    if (type === 'audio/mpeg') return 'mp3';
    if (type === 'audio/mp4') return 'm4a';
    if (type === 'audio/ogg') return 'ogg';
    if (type === 'audio/webm') return 'webm';
    return fallback;
};

const isLikelyWavMedia = (mediaType: string, url?: string): boolean => {
    const type = (mediaType || '').toLowerCase();
    if (type === 'audio/wav' || type === 'audio/x-wav') return true;
    return (url || '').split('?')[0].toLowerCase().endsWith('.wav');
};

const blobToBytes = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

const withTimeout = async <T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
    try {
        return await new Promise<T>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
            task
                .then((value) => {
                    window.clearTimeout(timer);
                    resolve(value);
                })
                .catch((error) => {
                    window.clearTimeout(timer);
                    reject(error);
                });
        });
    } catch {
        return fallback;
    }
};

const isNativeExportRuntime = (): boolean => {
    try {
        if (typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) return true;
        const platform = typeof Capacitor.getPlatform === 'function'
            ? String(Capacitor.getPlatform() || '').toLowerCase()
            : '';
        return platform === 'ios' || platform === 'android';
    } catch {
        return false;
    }
};

const base64ToBlob = (rawData: string, mimeType: string): Blob | null => {
    const data = String(rawData || '').trim();
    if (!data) return null;
    const declaredMimeType = parseDataUrlMimeType(data) || String(mimeType || '').trim().toLowerCase();
    const base64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        const sniffedMimeType = detectMediaTypeFromBytes(bytes);
        const resolvedMimeType =
            declaredMimeType && declaredMimeType !== 'application/octet-stream'
                ? declaredMimeType
                : sniffedMimeType || declaredMimeType || 'application/octet-stream';
        return new Blob([bytes], { type: resolvedMimeType });
    } catch {
        return null;
    }
};

const dataUrlToBlob = (rawData: string): Blob | null => {
    const data = String(rawData || '').trim();
    if (!isInlineDataUrl(data)) return null;

    const mimeType = parseDataUrlMimeType(data) || 'application/octet-stream';
    if (/;base64,/i.test(data)) {
        return base64ToBlob(data, mimeType);
    }

    const commaIndex = data.indexOf(',');
    if (commaIndex < 0) return null;

    try {
        const decoded = decodeURIComponent(data.slice(commaIndex + 1));
        return new Blob([decoded], { type: mimeType });
    } catch {
        return null;
    }
};

const ensureBlobMediaType = async (blob: Blob, url?: string): Promise<Blob> => {
    const explicit = (blob.type || '').split(';')[0].trim().toLowerCase();
    if (explicit && explicit !== 'application/octet-stream') return blob;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sniffedMimeType = detectMediaTypeFromBytes(bytes);
    if (sniffedMimeType) {
        return new Blob([bytes], { type: sniffedMimeType });
    }

    const urlMimeType = inferMediaTypeFromUrl(String(url || ''));
    if (urlMimeType !== 'application/octet-stream') {
        return new Blob([bytes], { type: urlMimeType });
    }

    return blob;
};

const isOptimizableImageMediaType = (mediaType: string): boolean => {
    const normalized = String(mediaType || '').toLowerCase();
    return normalized === 'image/jpeg'
        || normalized === 'image/jpg'
        || normalized === 'image/png'
        || normalized === 'image/webp';
};

const loadImageFromBlob = (blob: Blob): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
        if (typeof document === 'undefined' || typeof URL === 'undefined') {
            resolve(null);
            return;
        }
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        image.src = objectUrl;
    });

const optimizeImageBlobForExport = async (blob: Blob): Promise<Blob> => {
    if (typeof document === 'undefined') return blob;

    const sourceType = String(blob.type || '').split(';')[0].trim().toLowerCase();
    if (!isOptimizableImageMediaType(sourceType)) return blob;

    const image = await loadImageFromBlob(blob);
    if (!image) return blob;

    const sourceWidth = image.naturalWidth || image.width || 0;
    const sourceHeight = image.naturalHeight || image.height || 0;
    if (!sourceWidth || !sourceHeight) return blob;

    const longestSide = Math.max(sourceWidth, sourceHeight);
    const shouldResize = longestSide > EXPORT_IMAGE_OPTIMIZE_MAX_DIMENSION_PX;
    const shouldReencode = shouldResize || blob.size >= EXPORT_IMAGE_MIN_BYTES_FOR_OPTIMIZATION || sourceType !== 'image/jpeg';
    if (!shouldReencode) return blob;

    const scale = shouldResize ? (EXPORT_IMAGE_OPTIMIZE_MAX_DIMENSION_PX / longestSide) : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    // Flatten image onto white to safely convert png/webp inputs into compact jpeg output.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const optimizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
            (result) => resolve(result),
            'image/jpeg',
            EXPORT_IMAGE_JPEG_QUALITY
        );
    });
    if (!optimizedBlob) return blob;

    if (!shouldResize && sourceType === 'image/jpeg' && optimizedBlob.size >= blob.size * EXPORT_IMAGE_MIN_SAVINGS_RATIO) {
        return blob;
    }
    if (!shouldResize && optimizedBlob.size >= blob.size) {
        return blob;
    }
    return optimizedBlob;
};

const optimizeImageDataUrlForExport = async (dataUrl: string): Promise<string | null> => {
    const inlineBlob = dataUrlToBlob(dataUrl);
    if (!inlineBlob) return null;
    const normalizedBlob = await ensureBlobMediaType(inlineBlob, dataUrl);
    const optimizedBlob = await optimizeImageBlobForExport(normalizedBlob);
    return blobToDataUrl(optimizedBlob);
};

const fetchAssetBlobViaNativeFilesystem = async (url: string): Promise<Blob | null> => {
    if (!isNativeExportRuntime()) return null;
    if (!/^https?:\/\//i.test(String(url || '').trim())) return null;
    if (typeof Filesystem.downloadFile !== 'function') return null;

    const ext = extensionForMediaType(inferMediaTypeFromUrl(url), 'bin');
    const tempPath = `export-assets/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    let downloadedPath = tempPath;
    let downloadedPathIsAbsolute = false;

    try {
        const downloadResult = await Filesystem.downloadFile({
            url,
            path: tempPath,
            directory: Directory.Temporary,
            recursive: true
        });
        const resolvedDownloadPath = String(downloadResult.path || '').trim();
        if (resolvedDownloadPath) {
            downloadedPath = resolvedDownloadPath;
            downloadedPathIsAbsolute = resolvedDownloadPath.startsWith('file://') || resolvedDownloadPath.startsWith('/');
        }

        const readResult = downloadedPathIsAbsolute
            ? await Filesystem.readFile({ path: downloadedPath })
            : await Filesystem.readFile({
                path: downloadedPath,
                directory: Directory.Temporary
            });

        if (readResult.data instanceof Blob) {
            return await ensureBlobMediaType(readResult.data, url);
        }
        if (typeof readResult.data === 'string') {
            const blob = base64ToBlob(readResult.data, inferMediaTypeFromUrl(url));
            if (!blob) return null;
            return await ensureBlobMediaType(blob, url);
        }
        return null;
    } catch (error) {
        console.warn('Native filesystem asset fetch failed:', url, error);
        return null;
    } finally {
        await (
            downloadedPathIsAbsolute
                ? Filesystem.deleteFile({ path: downloadedPath })
                : Filesystem.deleteFile({
                    path: downloadedPath,
                    directory: Directory.Temporary
                })
        ).catch(() => undefined);
    }
};

const fetchAssetBlob = async (url: string): Promise<Blob | null> => {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) return null;

    const inlineBlob = dataUrlToBlob(normalizedUrl);
    if (inlineBlob) return await ensureBlobMediaType(inlineBlob, normalizedUrl);

    const nativeBlob = await withTimeout(
        fetchAssetBlobViaNativeFilesystem(normalizedUrl),
        EXPORT_NATIVE_ASSET_TIMEOUT_MS,
        null
    );
    if (nativeBlob) return await ensureBlobMediaType(nativeBlob, normalizedUrl);

    const firebaseBlob = await withTimeout(getFirebaseStorageBlobFromUrl(normalizedUrl), EXPORT_ASSET_TIMEOUT_MS, null);
    if (firebaseBlob) return await ensureBlobMediaType(firebaseBlob, normalizedUrl);

    try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), EXPORT_ASSET_TIMEOUT_MS);
        const response = await fetch(normalizedUrl, { signal: controller.signal });
        window.clearTimeout(timer);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await ensureBlobMediaType(blob, normalizedUrl);
    } catch (error) {
        console.warn('Failed to load asset for EPUB:', normalizedUrl, error);
        return null;
    }
};

const isFirebaseStorageDownloadUrlForSdk = (url: string): boolean => (
    /https?:\/\/firebasestorage\.googleapis\.com\//i.test(url) ||
    /https?:\/\/[^/]*firebasestorage\.app\//i.test(url) ||
    /https?:\/\/storage\.googleapis\.com\//i.test(url)
);

const tryResolveFirebaseStorageReference = (url: string): FirebaseStorageObjectReference | null => {
    const safeDecode = (value: string): string => {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    };

    const normalized = String(url || '').trim();
    if (!normalized) return null;

    const gsMatch = normalized.match(/^gs:\/\/([^/]+)\/(.+)$/i);
    if (gsMatch?.[1] && gsMatch?.[2]) {
        return {
            bucketUrl: `gs://${gsMatch[1]}`,
            objectPath: safeDecode(gsMatch[2])
        };
    }

    if (!/^https?:\/\//i.test(normalized)) {
        return { objectPath: normalized.replace(/^\/+/, '') };
    }

    try {
        const parsed = new URL(normalized);
        const pathname = parsed.pathname || '';

        // New download endpoint styles:
        // /v0/b/<bucket>/o/<encodedPath>
        // /download/storage/v1/b/<bucket>/o/<encodedPath>
        const v0Match = pathname.match(/\/(?:v0|download\/storage\/v1)\/b\/([^/]+)\/o\/(.+)$/i);
        if (v0Match?.[1] && v0Match?.[2]) {
            return {
                bucketUrl: `gs://${safeDecode(v0Match[1])}`,
                objectPath: safeDecode(v0Match[2])
            };
        }

        // v0 API style: .../o/<encodedPath>?alt=media...
        const objectMatch = pathname.match(/\/o\/(.+)$/);
        if (objectMatch?.[1]) {
            const hostBucketMatch = parsed.hostname.match(/^([^.]+)\.firebasestorage\.app$/i);
            return {
                bucketUrl: hostBucketMatch?.[1] ? `gs://${safeDecode(hostBucketMatch[1])}` : undefined,
                objectPath: safeDecode(objectMatch[1])
            };
        }

        // storage.googleapis.com/<bucket>/<path>
        if (/^storage\.googleapis\.com$/i.test(parsed.hostname)) {
            const parts = pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
                return {
                    bucketUrl: `gs://${safeDecode(parts[0])}`,
                    objectPath: safeDecode(parts.slice(1).join('/'))
                };
            }
        }

        return null;
    } catch {
        return null;
    }
};

const getFirebaseStorageBlobFromUrl = async (url: string): Promise<Blob | null> => {
    const normalized = String(url || '').trim();
    if (!normalized) return null;
    if (isInlineDataUrl(normalized) || /^blob:/i.test(normalized)) return null;

    const reference = isFirebaseStorageDownloadUrlForSdk(normalized) || /^gs:\/\//i.test(normalized) || !/^https?:\/\//i.test(normalized)
        ? tryResolveFirebaseStorageReference(normalized)
        : null;
    if (!reference?.objectPath) return null;

    try {
        const storage = reference.bucketUrl
            ? getStorage(firebaseApp, reference.bucketUrl)
            : getStorage(firebaseApp);
        const ref = storageRef(storage, reference.objectPath);
        return await getBlob(ref);
    } catch (error) {
        // Fall back to native/browser fetch below; some URLs may still require public token access.
        console.warn('Firebase Storage SDK blob fetch failed for export asset, falling back to URL fetch:', reference.objectPath, error);
        return null;
    }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const encodeWavPcm16 = (mono: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + mono.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + mono.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits/sample
    writeString(36, 'data');
    view.setUint32(40, mono.length * 2, true);

    let offset = 44;
    for (let i = 0; i < mono.length; i++) {
        const s = clamp(mono[i], -1, 1);
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
};

const mixToMono = (audioBuffer: AudioBuffer): Float32Array => {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    if (channels <= 1) {
        mono.set(audioBuffer.getChannelData(0));
        return mono;
    }
    for (let ch = 0; ch < channels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }
    return mono;
};

const resampleMonoLinear = (source: Float32Array, sourceRate: number, targetRate: number): Float32Array => {
    if (!source.length || sourceRate <= 0 || targetRate <= 0 || sourceRate === targetRate) return source;
    const ratio = sourceRate / targetRate;
    const outLength = Math.max(1, Math.round(source.length / ratio));
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
        const pos = i * ratio;
        const left = Math.floor(pos);
        const right = Math.min(source.length - 1, left + 1);
        const t = pos - left;
        out[i] = source[left] * (1 - t) + source[right] * t;
    }
    return out;
};

const maybeCompressAudioForEpub = async (blob: Blob, sourceUrl?: string): Promise<Blob> => {
    const mediaType = inferMediaType(blob, sourceUrl);
    if (!isLikelyWavMedia(mediaType, sourceUrl)) return blob;
    const originalSize = blob.size || 0;
    if (!originalSize) return blob;

    try {
        const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextCtor) return blob;

        const ctx = new AudioContextCtor();
        try {
            const sourceBuffer = await blob.arrayBuffer();
            const decoded: AudioBuffer = await ctx.decodeAudioData(sourceBuffer.slice(0));
            const mono = mixToMono(decoded);
            const targetSampleRate = decoded.sampleRate > 22050 ? 22050 : decoded.sampleRate;
            const resampled = resampleMonoLinear(mono, decoded.sampleRate, targetSampleRate);
            const compressed = encodeWavPcm16(resampled, targetSampleRate);
            if (compressed.size > 0 && compressed.size < originalSize * 0.97) {
                return compressed;
            }
            return blob;
        } finally {
            try {
                await ctx.close();
            } catch {
                // ignore close failures
            }
        }
    } catch (error) {
        console.warn('EPUB audio compression failed, using original audio.', error);
        return blob;
    }
};

class EpubAssetCollector {
    private assets: EpubCollectedAsset[] = [];
    private bySource = new Map<string, EpubAssetRef>();
    private counters: Record<EpubAssetKind, number> = { image: 0, audio: 0 };

    getAll(): EpubCollectedAsset[] {
        return this.assets;
    }

    async addRemoteAsset(url: string, kind: EpubAssetKind, baseName?: string): Promise<EpubAssetRef | null> {
        if (!url) return null;
        if (kind === 'image' && this.counters.image >= MAX_EPUB_IMAGE_ASSETS) return null;
        const sourceKey = `${kind}:${url}`;
        const existing = this.bySource.get(sourceKey);
        if (existing) return existing;

        const rawBlob = await fetchAssetBlob(url);
        if (!rawBlob) return null;

        let blob = rawBlob;
        if (kind === 'audio') {
            blob = await maybeCompressAudioForEpub(rawBlob, url);
        } else if (kind === 'image') {
            blob = await optimizeImageBlobForExport(rawBlob);
        }

        const mediaType = inferMediaType(blob, url);
        const ext = extensionForMediaType(mediaType, kind === 'image' ? 'png' : 'wav');
        const count = ++this.counters[kind];
        const safeBase = slugifyFileName(baseName || `${kind}_${count}`, kind);
        const folder = kind === 'image' ? 'assets/images' : 'assets/audio';
        const idPrefix = kind === 'image' ? 'img' : 'aud';
        const href = `${folder}/${safeBase}_${count}.${ext}`;
        const id = `${idPrefix}_${count}`;
        const bytes = await blobToBytes(blob);

        const ref: EpubAssetRef = { id, href, mediaType, kind };
        this.assets.push({ ...ref, bytes, sourceKey });
        this.bySource.set(sourceKey, ref);
        return ref;
    }

}

const renderMathFragmentForEpub = (math: string, displayMode: boolean): string => {
    const trimmed = (math || '').trim();
    if (!trimmed) return '';
    try {
        const mathml = katex.renderToString(trimmed, {
            throwOnError: false,
            displayMode,
            output: 'mathml'
        });
        return `<${displayMode ? 'div' : 'span'} class="${displayMode ? 'math-display' : 'math-inline'}">${mathml}</${displayMode ? 'div' : 'span'}>`;
    } catch {
        return `<${displayMode ? 'div' : 'span'} class="${displayMode ? 'math-display' : 'math-inline'} math-fallback">${escapeHtml(trimmed)}</${displayMode ? 'div' : 'span'}>`;
    }
};

const renderInlineMarkdownToEpubHtml = (text: string): string => {
    if (!text) return '';

    let working = text;
    const tokens: string[] = [];
    const capture = (html: string) => {
        const idx = tokens.push(html) - 1;
        return `@@EPUBTOK${idx}@@`;
    };

    working = working.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => capture(renderMathFragmentForEpub(expr, true)));
    working = working.replace(/(^|[^\\])\$([^$\n]+)\$/g, (match, prefix, expr) => `${prefix}${capture(renderMathFragmentForEpub(expr, false))}`);

    let html = escapeHtml(working);
    html = html
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/~~([^~]+)~~/g, '<del>$1</del>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');

    html = html.replace(/@@EPUBTOK(\d+)@@/g, (_, n) => tokens[Number(n)] || '');
    return stripStrayMarkdown(html);
};

const buildQuizOrExamHtml = (node: TimelineNode): string => {
    const questions = Array.isArray(node.questions) ? node.questions : [];
    if (!questions.length) {
        return `<p class="body-text muted">Bu bölüm için soru seti henüz hazır değil.</p>`;
    }

    const cards = questions.map((q, index) => {
        const options = (q.options || []).map((option, optionIndex) => (
            `<li><span class="option-key">${String.fromCharCode(65 + optionIndex)})</span> <span>${renderInlineMarkdownToEpubHtml(option)}</span></li>`
        )).join('');
        return `
          <article class="qa-card">
            <h3 class="qa-title">Soru ${index + 1}</h3>
            <p class="qa-question">${renderInlineMarkdownToEpubHtml(q.question)}</p>
            <ol class="qa-options" type="A">${options}</ol>
          </article>
        `;
    }).join('');

    const answerRows = questions.map((q, index) => {
        const answerLine = buildAnswerKeyLineForExport(q as any);
        return `
          <div class="answer-row">
            <div class="answer-num">${index + 1}</div>
            <div class="answer-main">
              <div class="answer-question"><span class="answer-label">Soru:</span> ${renderInlineMarkdownToEpubHtml(q.question || '')}</div>
              <div class="answer-text"><span class="answer-label answer-label-green">${escapeHtml(answerLine.prefix)}:</span> ${renderInlineMarkdownToEpubHtml(answerLine.text)}</div>
            </div>
          </div>
        `;
    }).join('');

    return `
      <section class="quiz-wrap">
        ${cards}
      </section>
      <section class="answer-key-wrap">
        <h3 class="subheading red">Cevap Anahtarı</h3>
        <div class="answer-key-grid">${answerRows}</div>
      </section>
    `;
};

const toTextSectionRelativeHref = (href: string): string => `../${(href || '').replace(/^\/+/, '')}`;

type RenderMarkdownEpubOptions = {
    nodeType: TimelineNode['type'];
    sectionBaseName: string;
    collector: EpubAssetCollector;
    topic: string;
    sectionTitle: string;
    contentTitle: string;
};

const renderMarkdownToEpubHtml = async (rawText: string, options: RenderMarkdownEpubOptions): Promise<string> => {
    const normalizedText = sanitizeNodeBodyLeadingDuplicates(rawText || '', {
        nodeType: options.nodeType,
        courseTopic: options.topic,
        nodeTitle: options.sectionTitle,
        contentTitle: options.contentTitle
    });
    const duplicateHeadingKeys = buildDuplicateHeadingKeySet({
        nodeType: options.nodeType,
        courseTopic: options.topic,
        nodeTitle: options.sectionTitle,
        contentTitle: options.contentTitle
    });
    const lines = normalizedText.split('\n');
    const htmlParts: string[] = [];
    let inCodeFence = false;
    let codeFenceLines: string[] = [];
    let currentListType: 'ul' | 'ol' | null = null;
    let currentListItems: string[] = [];
    let paragraphBlocksSinceLastHeading = 0;
    let pendingImageHtmlBlocks: string[] = [];
    const flushPendingImageHtmlBlocks = (force = false) => {
        if (!pendingImageHtmlBlocks.length) return;
        if (force || paragraphBlocksSinceLastHeading >= MIN_PARAGRAPH_BLOCKS_BEFORE_IMAGE) {
            htmlParts.push(...pendingImageHtmlBlocks);
            pendingImageHtmlBlocks = [];
        }
    };
    const registerParagraphBlock = () => {
        paragraphBlocksSinceLastHeading += 1;
        flushPendingImageHtmlBlocks();
    };
    const queueOrRenderImageHtml = (html: string) => {
        if (paragraphBlocksSinceLastHeading >= MIN_PARAGRAPH_BLOCKS_BEFORE_IMAGE) {
            htmlParts.push(html);
            return;
        }
        pendingImageHtmlBlocks.push(html);
    };

    const flushList = () => {
        if (!currentListType || !currentListItems.length) return;
        htmlParts.push(`<${currentListType} class="content-list">${currentListItems.join('')}</${currentListType}>`);
        currentListType = null;
        currentListItems = [];
        registerParagraphBlock();
    };

    const flushCodeFence = () => {
        if (!inCodeFence) return;
        htmlParts.push(`<pre class="code-block"><code>${escapeHtml(codeFenceLines.join('\n'))}</code></pre>`);
        inCodeFence = false;
        codeFenceLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            flushList();
            if (inCodeFence) {
                flushCodeFence();
            } else {
                inCodeFence = true;
                codeFenceLines = [];
            }
            continue;
        }

        if (inCodeFence) {
            codeFenceLines.push(line);
            continue;
        }

        if (!trimmed) {
            flushList();
            continue;
        }

        if (trimmed === '---' || trimmed === '--') {
            flushList();
            htmlParts.push('<hr class="dashed-sep" />');
            continue;
        }

        // Two-image markdown table for remedial visuals
        if (trimmed.startsWith('|')) {
            const separatorLine = lines[i + 1]?.trim() || '';
            const captionLine = lines[i + 2]?.trim() || '';
            if (isMarkdownTableSeparatorRow(separatorLine) && captionLine.startsWith('|')) {
                flushList();
                const rawCells = parseMarkdownTableCells(trimmed);
                const imageCells = rawCells
                    .map(stripMarkdownImageCell)
                    .filter((item): item is { alt: string; url: string } => Boolean(item))
                    .slice(0, 2);

                if (imageCells.length >= 2) {
                    const figures: string[] = [];
                    for (let j = 0; j < imageCells.length; j++) {
                        const cell = imageCells[j];
                        const cleanUrl = extractMarkdownImageUrl(cell.url || '');
                        const assetRef = await options.collector.addRemoteAsset(cleanUrl, 'image', `${options.sectionBaseName}_remedial_${j + 1}`);
                        figures.push(`
                          <figure class="image-grid-item">
                            ${assetRef ? `<img src="${escapeXml(toTextSectionRelativeHref(assetRef.href))}" alt="${escapeXml(cell.alt || 'Görsel')}" loading="lazy" />` : '<div class="asset-missing">Görsel yüklenemedi</div>'}
                          </figure>
                        `);
                    }
                    queueOrRenderImageHtml(`<section class="image-grid">${figures.join('')}</section>`);
                    i += 2;
                    continue;
                }

                // Empty image row fallback (e.g. "| |") should not render as raw markdown in EPUB.
                if (rawCells.length >= 2 && rawCells.slice(0, 2).every((cell) => !cell.trim())) {
                    i += 2;
                    continue;
                }
            }

            const genericTable = parseGenericMarkdownTableBlock(lines, i);
            if (genericTable) {
                flushList();
                const headerHtml = genericTable.headers
                    .map((cell) => `<th>${renderInlineMarkdownToEpubHtml(cell)}</th>`)
                    .join('');
                const bodyHtml = genericTable.rows
                    .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdownToEpubHtml(cell)}</td>`).join('')}</tr>`)
                    .join('');
                htmlParts.push(`
                  <div class="table-wrap">
                    <table class="content-table">
                      <thead><tr>${headerHtml}</tr></thead>
                      <tbody>${bodyHtml}</tbody>
                    </table>
                  </div>
                `);
                registerParagraphBlock();
                i = genericTable.endIndex;
                continue;
            }
        }

        // Standalone image markdown
        const imageOnlyMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
        if (imageOnlyMatch) {
            flushList();
            const alt = imageOnlyMatch[1] || '';
            const normalizedAlt = stripStrayMarkdown(stripLatex(alt));
            const cleanUrl = extractMarkdownImageUrl(imageOnlyMatch[2] || '');
            const assetRef = await options.collector.addRemoteAsset(cleanUrl, 'image', `${options.sectionBaseName}_img`);
            if (assetRef) {
                queueOrRenderImageHtml(`
                  <figure class="hero-image">
                    <img src="${escapeXml(toTextSectionRelativeHref(assetRef.href))}" alt="${escapeXml(normalizedAlt || 'Görsel')}" loading="lazy" />
                  </figure>
                `);
            } else {
                queueOrRenderImageHtml('<p class="body-text muted">[Görsel yüklenemedi]</p>');
            }
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushList();
            const level = Math.min(6, headingMatch[1].length + 1); // keep section title as top-level, content starts from h2+
            const rawHeading = options.nodeType === 'lecture'
                ? normalizeLectureContentHeading(headingMatch[2])
                : options.nodeType === 'reinforce'
                    ? normalizeReinforceContentHeading(headingMatch[2])
                    : headingMatch[2];
            if (isGenericSectionHeadingForType(rawHeading, options.nodeType) || isDuplicateHeadingText(rawHeading, duplicateHeadingKeys)) {
                continue;
            }
            flushPendingImageHtmlBlocks(true);
            paragraphBlocksSinceLastHeading = 0;
            htmlParts.push(`<h${level} class="content-heading level-${level}">${renderInlineMarkdownToEpubHtml(rawHeading)}</h${level}>`);
            continue;
        }

        const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
        if (unorderedMatch) {
            const itemBody = unorderedMatch[1].trim();
            if (currentListType !== 'ul') flushList();
            currentListType = 'ul';
            currentListItems.push(`<li>${renderInlineMarkdownToEpubHtml(itemBody)}</li>`);
            continue;
        }

        const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            const itemBody = orderedMatch[1].trim();
            if (currentListType !== 'ol') flushList();
            currentListType = 'ol';
            currentListItems.push(`<li>${renderInlineMarkdownToEpubHtml(itemBody)}</li>`);
            continue;
        }

        const quoteMatch = trimmed.match(/^>\s?(.*)$/);
        if (quoteMatch) {
            flushList();
            const quoteText = quoteMatch[1] || '';
            const quoteLower = quoteText.toLocaleLowerCase('tr-TR');
            const isImportant = /^önemli\s*[:：]?/i.test(quoteText) || quoteLower.includes('önemli');
            const isWarning = /^(dikkat|sık hata)\s*[:：]?/i.test(quoteText) || quoteLower.includes('dikkat') || quoteLower.includes('sık hata');
            const quoteClass = isImportant
                ? 'content-quote content-quote-important'
                : isWarning
                    ? 'content-quote content-quote-warning'
                    : 'content-quote';
            htmlParts.push(`<blockquote class="${quoteClass}">${renderInlineMarkdownToEpubHtml(quoteText)}</blockquote>`);
            registerParagraphBlock();
            continue;
        }

        flushList();
        htmlParts.push(`<p class="body-text">${renderInlineMarkdownToEpubHtml(trimmed)}</p>`);
        registerParagraphBlock();
    }

    flushCodeFence();
    flushList();
    flushPendingImageHtmlBlocks(true);
    return htmlParts.join('\n');
};

const buildNodeTabLabel = (course: CourseData, node: TimelineNode): string => {
    const normalizedTitle = normalizeHeaderTitle(node.title, node.type);
    const isNarrativeBook =
        course.bookType === 'fairy_tale' ||
        course.bookType === 'story' ||
        course.bookType === 'novel';
    if (node.type === 'lecture') return isNarrativeBook ? (normalizedTitle || course.topic) : 'GİRİŞ';
    if (node.type === 'podcast') return 'PODCAST';
    if (node.type === 'quiz') return `QUİZ${node.questions ? ` • ${node.questions.length} Soru` : ''}`;
    if (node.type === 'reinforce') return isNarrativeBook ? (normalizedTitle || course.topic) : 'DETAYLAR';
    if (node.type === 'exam') return `ANA SINAV${node.questions ? ` • ${node.questions.length} Soru` : ''}`;
    if (node.type === 'retention') return isNarrativeBook ? (normalizedTitle || course.topic) : 'ÖZET';
    return normalizedTitle;
};

const buildNodeContentTitle = (course: CourseData, node: TimelineNode): string => {
    const normalizedTitle = normalizeHeaderTitle(node.title, node.type);
    if (node.type === 'lecture') {
        const cleaned = normalizeLectureContentHeading(normalizedTitle || '').trim();
        if (!cleaned || /^(giriş|introduction)$/i.test(cleaned)) return course.topic;
        return cleaned;
    }
    if (node.type === 'podcast') {
        const generic = (normalizedTitle || '').trim().toLocaleLowerCase('tr-TR');
        if (!generic || generic === 'podcast') return 'Sesli Anlatım';
    }
    if (node.type === 'reinforce') {
        const cleaned = normalizeReinforceContentHeading(normalizedTitle || '').trim();
        if (!cleaned || /^(peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement)$/iu.test(cleaned)) return course.topic;
        return cleaned;
    }
    if (node.type === 'retention') return course.topic;
    if (node.type === 'quiz') {
        if (isGenericNodeTitleForType(normalizedTitle, 'quiz')) return course.topic;
        return normalizedTitle || course.topic;
    }
    if (node.type === 'exam') {
        if (isGenericNodeTitleForType(normalizedTitle, 'exam')) return course.topic;
        return normalizedTitle || course.topic;
    }
    return normalizedTitle || course.topic;
};

const epubStylesCss = `
html, body {
  margin: 0;
  padding: 0;
  color: #18212d;
  background: #ffffff;
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Times New Roman", Georgia, serif;
  line-height: 1.62;
}
body { padding: 1.05rem 1rem 1.25rem; }
h1, h2, h3, h4, h5, h6 { margin: 0; line-height: 1.28; }
p { margin: 0; }
.cover-page { min-height: 95vh; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.cover-top { display: block; width: 100%; }
.cover-image-wrap { width: 100%; max-width: 24rem; margin: 0 auto; }
.cover-image-wrap img {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 0.65rem;
  display: block;
  background: #11161d;
  box-shadow: 0 1rem 2rem rgba(17, 22, 29, 0.16);
}
.cover-meta { margin-top: 1rem; text-align: center; }
.cover-meta h1 { font-size: 1.2rem; font-weight: 800; color: #1f2937; margin-top: 0.1rem; }
.cover-meta .meta-line { color: #4b5563; font-size: 0.8rem; margin-top: 0.28rem; }
.brand-line { color: #6b7280; font-size: 0.72rem; margin-top: 0.4rem; }
.cover-divider, .dashed-sep {
  border: 0;
  border-top: 1px dashed #6e8d78;
  margin: 0.7rem 0;
}
.section-shell { }
.tab-header-row { margin-bottom: 0.45rem; }
.tab-label {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 800;
  color: #e53935;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.section-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #2563eb;
  margin-top: 0.2rem;
}
.body-text {
  font-size: 0.95rem;
  color: #18212d;
  margin: 0.3rem 0 0.42rem;
  text-align: justify;
}
.body-text-intro-quote {
  text-align: center;
  font-style: italic;
  color: #334155;
  margin: 0.38rem 0 0.6rem;
}
.intro-quote-mark {
  opacity: 0.85;
}
.body-text.muted { color: #6b7280; font-style: italic; }
.content-heading { margin: 0.8rem 0 0.35rem; font-weight: 800; color: #2563eb; }
.content-heading.level-2 { font-size: 1rem; }
.content-heading.level-3 { font-size: 0.94rem; }
.content-heading.level-4 { font-size: 0.9rem; }
.content-heading.level-5, .content-heading.level-6 { font-size: 0.86rem; }
.content-list {
  margin: 0.25rem 0 0.45rem 1.05rem;
  padding: 0;
  color: #18212d;
}
.content-list li {
  margin: 0.18rem 0;
  line-height: 1.5;
}
.content-list li::marker { color: #6e8d78; }
.content-quote {
  margin: 0.4rem 0 0.55rem;
  padding: 0.55rem 0.7rem;
  border-left: 3px solid #6e8d78;
  background: rgba(17,22,29,0.03);
  color: #334155;
}
.content-quote-important {
  border-left-color: #fb923c;
  background: #fff7ed;
  color: #7c2d12;
}
.content-quote-warning {
  border-left-color: #f87171;
  background: #fef2f2;
  color: #7f1d1d;
}
.table-wrap {
  margin: 0.5rem 0 0.7rem;
  overflow-x: auto;
}
.content-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.84rem;
}
.content-table th,
.content-table td {
  border: 1px solid #a8b8cc;
  padding: 0.32rem 0.36rem;
  vertical-align: top;
  line-height: 1.38;
}
.content-table th {
  background: #e8eef8;
  color: #0f172a;
  font-weight: 800;
  text-align: left;
}
.content-table tbody tr:nth-child(even) td {
  background: #f8fafc;
}
code {
  background: rgba(59,130,246,0.08);
  color: #1d4ed8;
  padding: 0.06rem 0.25rem;
  border-radius: 0.2rem;
  font-size: 0.88em;
}
.code-block {
  background: rgba(17,22,29,0.04);
  border: 1px dashed rgba(110,141,120,0.35);
  border-radius: 0.4rem;
  padding: 0.65rem 0.7rem;
  overflow-x: auto;
  margin: 0.45rem 0 0.6rem;
}
.code-block code {
  background: transparent;
  color: #1f2937;
  padding: 0;
}
.hero-image { margin: 0.65rem 0 0.65rem; }
.hero-image img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 0.22rem;
  background: #11161d;
}
.hero-image figcaption {
  margin-top: 0.25rem;
  font-size: 0.74rem;
  color: #6b7280;
  font-style: italic;
  text-align: center;
}
.image-grid {
  display: table;
  width: 100%;
  table-layout: fixed;
  border-spacing: 0.45rem 0;
  margin: 0.55rem 0 0.7rem;
}
.image-grid-item {
  display: table-cell;
  vertical-align: top;
  width: 50%;
}
.image-grid-item img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.22rem;
  background: #11161d;
}
.image-grid-item figcaption {
  margin-top: 0.25rem;
  font-size: 0.72rem;
  color: #6b7280;
  font-style: italic;
  text-align: center;
  line-height: 1.35;
}
.asset-missing {
  border: 1px dashed rgba(110,141,120,0.35);
  border-radius: 0.3rem;
  padding: 2rem 0.8rem;
  color: #6b7280;
  text-align: center;
  font-size: 0.8rem;
}
.quiz-wrap { margin-top: 0.3rem; }
.qa-card {
  border: 1px dashed rgba(110,141,120,0.35);
  background: rgba(17,22,29,0.02);
  border-radius: 0.42rem;
  padding: 0.65rem 0.7rem;
  margin: 0.45rem 0;
}
.qa-title {
  color: #e53935;
  font-size: 0.82rem;
  font-weight: 800;
}
.qa-question {
  margin: 0.22rem 0 0.35rem;
  color: #18212d;
  font-size: 0.9rem;
  line-height: 1.45;
}
.qa-options {
  margin: 0 0 0 1.1rem;
  padding: 0;
}
.qa-options li {
  margin: 0.18rem 0;
  font-size: 0.88rem;
}
.option-key { color: #2563eb; font-weight: 700; }
.answer-key-wrap { margin-top: 0.8rem; }
.subheading {
  font-size: 0.86rem;
  font-weight: 800;
  margin: 0.2rem 0 0.4rem;
}
.subheading.red { color: #e53935; }
.subheading.blue { color: #2563eb; }
.answer-key-grid { display: block; }
.answer-row {
  display: table;
  width: 100%;
  table-layout: fixed;
  border: 1px dashed rgba(110,141,120,0.28);
  border-radius: 0.35rem;
  margin: 0.28rem 0;
  background: rgba(17,22,29,0.018);
}
.answer-num, .answer-main {
  display: table-cell;
  vertical-align: middle;
}
.answer-num {
  width: 2rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: #64748b;
  border-right: 1px dashed rgba(110,141,120,0.22);
}
.answer-main {
  padding: 0.35rem 0.5rem;
}
.answer-letter {
  font-weight: 800;
  color: #15803d;
  font-size: 0.78rem;
}
.answer-question {
  color: #1f2937;
  font-size: 0.78rem;
  line-height: 1.35;
}
.answer-text {
  margin-top: 0.05rem;
  color: #334155;
  font-size: 0.78rem;
  line-height: 1.35;
}
.answer-label {
  font-weight: 800;
  color: #2563eb;
}
.answer-label-green {
  color: #15803d;
}
.podcast-block {
  border: 1px dashed rgba(110,141,120,0.3);
  border-radius: 0.45rem;
  padding: 0.7rem;
  background: rgba(17,22,29,0.02);
  margin: 0.35rem 0 0.65rem;
}
audio {
  display: block;
  width: 100%;
  margin-top: 0.35rem;
}
.podcast-note {
  margin-top: 0.3rem;
  color: #6b7280;
  font-size: 0.72rem;
}
.math-inline {
  color: #8b1d9a;
  font-weight: 600;
}
.math-display {
  color: #8b1d9a;
  margin: 0.35rem 0;
  padding: 0.35rem 0.45rem;
  background: rgba(139,29,154,0.04);
  border: 1px dashed rgba(139,29,154,0.16);
  border-radius: 0.35rem;
  overflow-x: auto;
}
.math-display math, .math-inline math { color: inherit; }
`;

const wrapSectionXhtml = (title: string, bodyHtml: string, lang: string, stylesheetHref = 'styles.css'): string => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" type="text/css" href="${escapeXml(stylesheetHref)}" />
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;

const createDownload = async (blob: Blob, fileName: string) => {
    await saveBlobAsFile({ blob, fileName });
};

const formatEpubDate = (value: Date | string | undefined): string => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
};

const buildNodeSectionBodyHtml = async (
    course: CourseData,
    node: TimelineNode,
    collector: EpubAssetCollector
): Promise<{ bodyHtml: string }> => {
    const tabLabel = buildNodeTabLabel(course, node);
    const contentTitle = buildNodeContentTitle(course, node);
    const showTabLabel = normalizeExportCompareKey(tabLabel) !== normalizeExportCompareKey(contentTitle);
    const sectionBaseName = `${slugifyFileName(course.topic)}_${node.type}_${slugifyFileName(node.id)}`;
    let bodyParts: string[] = [];

    if (node.type === 'podcast') {
        const scriptHtml = await renderMarkdownToEpubHtml(node.podcastScript || node.content || '_Podcast metni hazır değil._', {
            nodeType: node.type,
            sectionBaseName,
            collector,
            topic: course.topic,
            sectionTitle: node.title,
            contentTitle
        });
        bodyParts.push(scriptHtml);
    } else if (node.type === 'quiz' || node.type === 'exam') {
        bodyParts.push(buildQuizOrExamHtml(node));
    } else {
        const sourceText = node.content || '_Henüz içerik oluşturulmamış._';
        bodyParts.push(await renderMarkdownToEpubHtml(sourceText, {
            nodeType: node.type,
            sectionBaseName,
            collector,
            topic: course.topic,
            sectionTitle: node.title,
            contentTitle
        }));
    }

    const bodyHtml = `
      <article class="section-shell">
        <header class="tab-header-row">
          ${showTabLabel ? `<div class="tab-label">${escapeHtml(tabLabel)}</div>` : ''}
          <h1 class="section-title">${escapeHtml(contentTitle)}</h1>
        </header>
        <hr class="dashed-sep" />
        ${bodyParts.join('\n')}
      </article>
    `;

    return { bodyHtml };
};

const buildCoverSectionHtml = async (course: CourseData, collector: EpubAssetCollector): Promise<{ xhtml: string; coverImageRef: EpubAssetRef | null }> => {
    let coverImageRef: EpubAssetRef | null = null;
    if (course.coverImageUrl) {
        coverImageRef = await collector.addRemoteAsset(course.coverImageUrl, 'image', `${slugifyFileName(course.topic)}_cover`);
    }

    const headerDate = new Date(course.createdAt || new Date()).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const ageLabel = getSmartBookAgeGroupLabel(course.ageGroup);
    const typeLabel = bookTypeLabelForExport(course.bookType);
    const subGenreLabel = (course.subGenre || '').trim() || 'Belirtilmedi';
    const categoryLabel = (course.category || 'Belirtilmedi').trim();
    const creatorLabel = (course.creatorName || 'Anonim').trim();

    const coverImageHtml = coverImageRef
        ? `<img src="${escapeXml(toTextSectionRelativeHref(coverImageRef.href))}" alt="${escapeXml(`${course.topic} Fortale kapağı`)}" />`
        : `<div class="asset-missing">Kapak görseli yok</div>`;

    const coverBody = `
      <section class="cover-page">
        <div class="cover-top">
          <div class="cover-image-wrap">${coverImageHtml}</div>
          <div class="cover-meta">
            <h1>${escapeHtml(course.topic)}</h1>
            <div class="meta-line">Tür: ${escapeHtml(typeLabel)} • Alt Tür: ${escapeHtml(subGenreLabel)} • ${escapeHtml(ageLabel)} • Kategori: ${escapeHtml(categoryLabel)}</div>
            <div class="brand-line">Kurgulayan: ${escapeHtml(creatorLabel)} | ${escapeHtml(headerDate)} | Fortale I Build Your Epic</div>
          </div>
        </div>
        <hr class="cover-divider" />
        <p class="body-text">${escapeHtml(course.description || 'Fortale içeriği bölümler halinde düzenlenmiş öğrenme akışını içerir.')}</p>
      </section>
    `;

    return { xhtml: wrapSectionXhtml(course.topic, coverBody, (course.language || 'tr').toLowerCase(), '../styles.css'), coverImageRef };
};

type EpubSectionFile = {
    id: string;
    href: string;
    title: string;
    xhtml: string;
};

const buildEpub = async (course: CourseData, fileNameBase?: string) => {
    const preparedCourse = await prepareCourseForRichExport(course);
    const collector = new EpubAssetCollector();
    const language = (preparedCourse.language || 'tr').toLowerCase();
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const zip = new JSZip();

    const sections: EpubSectionFile[] = [];
    const { xhtml: coverXhtml, coverImageRef } = await buildCoverSectionHtml(preparedCourse, collector);
    sections.push({
        id: 'cover_xhtml',
        href: 'text/cover.xhtml',
        title: preparedCourse.topic,
        xhtml: coverXhtml
    });

    for (let index = 0; index < preparedCourse.nodes.length; index++) {
        const node = preparedCourse.nodes[index];
        const { bodyHtml } = await buildNodeSectionBodyHtml(preparedCourse, node, collector);
        const title = buildNodeContentTitle(preparedCourse, node);
        sections.push({
            id: `sec_${index + 1}`,
            href: `text/section_${index + 1}.xhtml`,
            title,
            xhtml: wrapSectionXhtml(title, bodyHtml, language, '../styles.css')
        });
    }

    const navXhtml = wrapSectionXhtml(
        `${preparedCourse.topic} - İçindekiler`,
        `
          <nav epub:type="toc" id="toc">
            <h1 class="section-title">${escapeHtml(preparedCourse.topic)}</h1>
            <hr class="dashed-sep" />
            <ol class="content-list">
              ${sections.map((section) => `<li><a href="${escapeXml(section.href)}">${escapeHtml(section.title)}</a></li>`).join('')}
            </ol>
          </nav>
        `,
        language
    ).replace('<html ', '<html xmlns:epub="http://www.idpf.org/2007/ops" ');

    const manifestItems: Array<{ id: string; href: string; mediaType: string; properties?: string }> = [
        { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
        { id: 'css', href: 'styles.css', mediaType: 'text/css' }
    ];

    sections.forEach((section) => {
        manifestItems.push({ id: section.id, href: section.href, mediaType: 'application/xhtml+xml' });
    });

    collector.getAll().forEach((asset) => {
        manifestItems.push({
            id: asset.id,
            href: asset.href,
            mediaType: asset.mediaType,
            properties: coverImageRef && asset.id === coverImageRef.id ? 'cover-image' : undefined
        });
    });

    const spineItems = sections.map((section) => `<itemref idref="${escapeXml(section.id)}" />`).join('\n    ');
    const manifestXml = manifestItems.map((item) => (
        `<item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${item.properties ? ` properties="${escapeXml(item.properties)}"` : ''} />`
    )).join('\n    ');

    const coverMeta = coverImageRef
        ? `\n    <meta name="cover" content="${escapeXml(coverImageRef.id)}" />`
        : '';

    const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(preparedCourse.id || slugifyFileName(preparedCourse.topic))}</dc:identifier>
    <dc:title>${escapeXml(preparedCourse.topic)}</dc:title>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:creator>Fortale</dc:creator>
    <dc:publisher>Fortale</dc:publisher>
    <dc:description>${escapeXml(preparedCourse.description || '')}</dc:description>
    ${coverMeta}
    <meta property="dcterms:modified">${nowIso}</meta>
  </metadata>
  <manifest>
    ${manifestXml}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`;

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;

    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', containerXml);
    zip.file('META-INF/com.apple.ibooks.display-options.xml', `<?xml version="1.0" encoding="UTF-8"?>
<display_options>
  <platform name="*">
    <option name="specified-fonts">true</option>
  </platform>
</display_options>`);

    zip.file('OEBPS/styles.css', epubStylesCss);
    zip.file('OEBPS/nav.xhtml', navXhtml);
    zip.file('OEBPS/package.opf', opf);
    sections.forEach((section) => {
        zip.file(`OEBPS/${section.href}`, section.xhtml);
    });
    collector.getAll().forEach((asset) => {
        zip.file(`OEBPS/${asset.href}`, asset.bytes);
    });

    const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    await createDownload(blob, buildReadableBookDownloadFileName(fileNameBase || preparedCourse.topic, 'epub'));
};

export const exportCourseToEpub = async (course: CourseData) => {
    try {
        await buildEpub(course, course.topic);
    } catch (error) {
        console.error('EPUB Export error:', error);
        alert('EPUB oluşturulamadı!');
    }
};

export const exportNodeToEpub = async (course: CourseData, node: TimelineNode) => {
    const singleNodeCourse: CourseData = {
        ...course,
        topic: `${course.topic} - ${node.title}`,
        nodes: [node]
    };

    return exportCourseToEpub(singleNodeCourse);
};

const buildCoverPathCandidatesForExport = (course: CourseData): string[] => {
    const COVER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;
    const candidates: string[] = [];
    const pushCandidate = (value: string | null | undefined) => {
        const normalized = String(value || '').trim().replace(/^\/+/, '');
        if (!normalized || candidates.includes(normalized)) return;
        candidates.push(normalized);
    };

    const pushCoverVariantsForBasePath = (basePath: string | null | undefined) => {
        const normalizedBase = String(basePath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
        if (!normalizedBase) return;
        for (const ext of COVER_EXTENSIONS) {
            pushCandidate(`${normalizedBase}.${ext}`);
        }
    };

    const normalizedCoverUrl = String(course.coverImageUrl || '').trim();
    const coverRef = tryResolveFirebaseStorageReference(normalizedCoverUrl);
    if (coverRef?.objectPath) {
        const normalizedCoverPath = coverRef.objectPath.trim().replace(/^\/+/, '');
        if (normalizedCoverPath) {
            pushCandidate(normalizedCoverPath);
            const withoutExtension = normalizedCoverPath.replace(/\.(?:jpe?g|png|webp|gif)$/i, '');
            if (withoutExtension !== normalizedCoverPath) {
                pushCoverVariantsForBasePath(withoutExtension);
            }
        }
    }

    const packageBasePath = String(course.contentPackagePath || '').trim().replace(/\/package\.json$/i, '');
    if (packageBasePath) {
        pushCoverVariantsForBasePath(`${packageBasePath}/cover`);
    }

    const packageRef = tryResolveFirebaseStorageReference(String(course.contentPackageUrl || '').trim());
    const packageBasePathFromUrl = String(packageRef?.objectPath || '').trim().replace(/\/package\.json$/i, '');
    if (packageBasePathFromUrl) {
        pushCoverVariantsForBasePath(`${packageBasePathFromUrl}/cover`);
    }

    const safeCourseId = String(course.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
    const safeOwnerId = String(course.userId || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
    if (safeCourseId) {
        pushCoverVariantsForBasePath(`smartbooks/${safeCourseId}/cover`);
        if (safeOwnerId) {
            pushCoverVariantsForBasePath(`smartbooks/${safeOwnerId}/${safeCourseId}/cover`);
        }
    }

    return candidates;
};

const resolveExistingCoverLocationForExport = async (course: CourseData): Promise<string | undefined> => {
    const resolveExportStorageObjectPath = (value: string): string | null => {
        const reference = tryResolveFirebaseStorageReference(value);
        if (!reference?.objectPath) return null;
        return reference.objectPath.trim().replace(/^\/+/, '') || null;
    };

    const ensureFirebaseStorageObjectDownloadUrl = async (value: string): Promise<string | null> => {
        const objectPath = resolveExportStorageObjectPath(value);
        if (!objectPath) return null;
        try {
            return await getDownloadURL(storageRef(getStorage(firebaseApp), objectPath));
        } catch {
            return null;
        }
    };

    const normalizedCoverUrl = String(course.coverImageUrl || '').trim();
    if (/^data:image\//i.test(normalizedCoverUrl)) return normalizedCoverUrl;

    if (normalizedCoverUrl) {
        if (/^https?:\/\//i.test(normalizedCoverUrl) && !isFirebaseStorageDownloadUrlForSdk(normalizedCoverUrl)) {
            return normalizedCoverUrl;
        }
        const existingStorageDownloadUrl = await ensureFirebaseStorageObjectDownloadUrl(normalizedCoverUrl);
        if (existingStorageDownloadUrl) return existingStorageDownloadUrl;
        if (/^https?:\/\//i.test(normalizedCoverUrl)) {
            return normalizedCoverUrl;
        }
    }

    for (const path of buildCoverPathCandidatesForExport(course)) {
        const existingStorageDownloadUrl = await ensureFirebaseStorageObjectDownloadUrl(path);
        if (existingStorageDownloadUrl) return existingStorageDownloadUrl;
    }

    return undefined;
};

const prepareCourseForRichExport = async (course: CourseData): Promise<CourseData> => {
    // Hard rule: export never triggers AI generation/repair.
    // Export may only resolve already-existing packaged assets like the saved cover.
    const resolvedCoverImageUrl = await resolveExistingCoverLocationForExport(course);
    if (!resolvedCoverImageUrl || resolvedCoverImageUrl === course.coverImageUrl) {
        return course;
    }

    return {
        ...course,
        coverImageUrl: resolvedCoverImageUrl
    };
};
