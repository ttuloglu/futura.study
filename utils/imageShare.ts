import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { saveBlobAsFile } from './fileDownload';

export async function prepareImageShare(src: string, title: string, signal?: AbortSignal): Promise<File> {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error('Image unavailable');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Invalid image');
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' } as Record<string, string>)[blob.type] || 'png';
  const name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').trim().slice(0, 100) || 'Fortale';
  return new File([blob], `${name}.${extension}`, { type: blob.type });
}

export async function shareImageFile(file: File, title: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
    } else {
      await saveBlobAsFile({ blob: file, fileName: file.name });
    }
    return;
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const path = `image-share/${crypto.randomUUID()}/${file.name}`;
  const { uri } = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
  try { await Share.share({ title, files: [uri] }); }
  finally { await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {}); }
}
