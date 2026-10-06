import { Directory, Filesystem } from '@capacitor/filesystem';

// WKWebView blob URLs cannot be played by AVPlayer or loaded by UIImage.
// Give each reader session its own temporary files and remove them after closing.
export function createNativeReaderMediaSession() {
  const folder = `reader-media/${crypto.randomUUID()}`;
  const pending = new Map<string, Promise<string>>();
  let disposed = false;
  let wroteFiles = false;
  let count = 0;
  const resolve = (source?: string): Promise<string> => {
    if (!source) return Promise.resolve('');
    if (!source.startsWith('blob:') && !source.startsWith('data:audio/')) return Promise.resolve(source);
    if (disposed) return Promise.reject(new Error('Reader closed'));
    const existing = pending.get(source);
    if (existing) return existing;
    const index = count++;
    const request = (async () => {
      const response = await fetch(source);
      if (!response.ok) throw new Error('Reader media could not be loaded');
      const blob = await response.blob();
      const extensions: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      const extension = extensions[blob.type.split(';')[0]] || 'mp3';
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      wroteFiles = true;
      const result = await Filesystem.writeFile({ path: `${folder}/${index}.${extension}`, data: base64, directory: Directory.Cache, recursive: true });
      return result.uri;
    })();
    pending.set(source, request);
    return request;
  };
  return {
    resolve,
    async dispose() {
      disposed = true;
      await Promise.allSettled(pending.values());
      if (wroteFiles) await Filesystem.rmdir({ path: folder, directory: Directory.Cache, recursive: true }).catch(() => undefined);
    }
  };
}
