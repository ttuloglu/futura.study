import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/epub+zip': 'epub',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/x-wav': 'wav',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'text/plain': 'txt'
};
const NATIVE_DOWNLOAD_FOLDER = 'downloads';

function isCapacitorNativeRuntime(): boolean {
  try {
    const viaCore = typeof Capacitor.isNativePlatform === 'function'
      ? Capacitor.isNativePlatform()
      : false;
    if (viaCore) return true;
    const viaWindow = (window as any)?.Capacitor;
    if (viaWindow && typeof viaWindow.getPlatform === 'function') {
      const platform = String(viaWindow.getPlatform() || '').toLowerCase();
      return platform === 'ios' || platform === 'android';
    }
    const platform = typeof Capacitor.getPlatform === 'function'
      ? String(Capacitor.getPlatform() || '').toLowerCase()
      : '';
    return platform === 'ios' || platform === 'android';
  } catch {
    return false;
  }
}

function triggerBrowserDownload(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(String(url || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeFileName(fileName: string): string {
  const normalized = String(fileName || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f]/g, ' ')
    .trim();

  const extensionMatch = normalized.match(/\.([a-z0-9]{1,8})$/i);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '';
  const baseName = (extension ? normalized.slice(0, -extension.length) : normalized)
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .replace(/^[. ]+/g, '')
    .slice(0, 120)
    .trim();

  return `${baseName || 'dosya'}${extension}`;
}

function inferExtensionFromBlob(blob: Blob): string | null {
  const mimeType = String(blob.type || '').split(';')[0].trim().toLowerCase();
  return MIME_EXTENSION_MAP[mimeType] || null;
}

function normalizeFileNameForBlob(fileName: string, blob: Blob): string {
  const sanitized = sanitizeFileName(fileName);
  const blobExtension = inferExtensionFromBlob(blob);
  if (!blobExtension) return sanitized;

  const extensionMatch = sanitized.match(/\.([a-z0-9]{1,8})$/i);
  const currentExtension = extensionMatch?.[1]?.toLowerCase() || '';
  if (currentExtension === blobExtension) return sanitized;

  const baseName = extensionMatch
    ? sanitized.slice(0, -(currentExtension.length + 1))
    : sanitized;

  return `${baseName || 'dosya'}.${blobExtension}`;
}

function blobToBase64Content(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      if (commaIndex < 0) {
        reject(new Error('Dosya encode edilemedi.'));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Dosya encode edilemedi.'));
    reader.readAsDataURL(blob);
  });
}

async function shareNativeFileUri(uri: string): Promise<void> {
  const safeUri = String(uri || '').trim();
  if (!safeUri) throw new Error('Paylaşılacak dosya yolu bulunamadı.');
  try {
    await Share.share({ files: [safeUri] });
    return;
  } catch (fileShareError) {
    try {
      await Share.share({ url: safeUri });
      return;
    } catch (urlShareError) {
      console.warn('Native file share unavailable; file kept in Documents directory.', {
        fileShareError,
        urlShareError
      });
    }
  }
}

async function tryNativeDownloadAndShareFromUrl(url: string, fileName: string): Promise<boolean> {
  if (!isHttpUrl(url)) return false;
  if (typeof Filesystem.downloadFile !== 'function') return false;

  const finalFileName = sanitizeFileName(fileName);
  const targetPath = `${NATIVE_DOWNLOAD_FOLDER}/${Date.now()}-${finalFileName}`;

  try {
    const downloadResult = await Filesystem.downloadFile({
      url,
      path: targetPath,
      directory: Directory.Documents,
      recursive: true
    });

    const resolvedUri = String(downloadResult.path || '').trim().startsWith('file://')
      ? String(downloadResult.path || '').trim()
      : (await Filesystem.getUri({
        path: targetPath,
        directory: Directory.Documents
      })).uri;

    await shareNativeFileUri(resolvedUri);
    return true;
  } catch (error) {
    console.warn('Native URL download fallback to fetch/blob path:', error);
    return false;
  }
}

export async function saveBlobAsFile({
  blob,
  fileName
}: {
  blob: Blob;
  fileName: string;
}): Promise<void> {
  if (!blob) throw new Error('Kaydedilecek dosya bulunamadı.');
  if (!fileName) throw new Error('Dosya adı bulunamadı.');

  const finalFileName = normalizeFileNameForBlob(fileName, blob);
  const isNative = isCapacitorNativeRuntime();

  if (!isNative) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerBrowserDownload(objectUrl, finalFileName);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
    return;
  }

  const encodedData = await blobToBase64Content(blob);
  const targetPath = `${NATIVE_DOWNLOAD_FOLDER}/${Date.now()}-${finalFileName}`;
  const fileWriteResult = await Filesystem.writeFile({
    path: targetPath,
    data: encodedData,
    directory: Directory.Documents,
    recursive: true
  });
  const resolvedUri = String(fileWriteResult.uri || '').trim()
    || (await Filesystem.getUri({
      path: targetPath,
      directory: Directory.Documents
    })).uri;
  await shareNativeFileUri(resolvedUri);
}

export async function downloadFile({
  url,
  fileName
}: {
  url: string;
  fileName: string;
}): Promise<void> {
  if (!url) throw new Error('İndirilecek dosya bulunamadı.');
  if (!fileName) throw new Error('Dosya adı bulunamadı.');
  const finalFileName = sanitizeFileName(fileName);

  const isNative = isCapacitorNativeRuntime();
  if (!isNative) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Dosya indirilemedi (${response.status}).`);
      const blob = await response.blob();
      await saveBlobAsFile({ blob, fileName: finalFileName });
    } catch {
      triggerBrowserDownload(url, finalFileName);
    }
    return;
  }

  const handledViaNativeTransfer = await tryNativeDownloadAndShareFromUrl(url, finalFileName);
  if (handledViaNativeTransfer) return;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Dosya indirilemedi (${response.status}).`);
  }
  const blob = await response.blob();
  await saveBlobAsFile({ blob, fileName: finalFileName });
}
