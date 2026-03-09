type PdfMakeDocument = {
  getBlob: () => Promise<Blob>;
};

type PdfMakeStatic = {
  createPdf: (docDefinition: unknown) => PdfMakeDocument;
  vfs?: Record<string, string>;
};

declare global {
  interface Window {
    pdfMake?: PdfMakeStatic;
  }
}

let pdfMakePromise: Promise<PdfMakeStatic> | null = null;

function getAssetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}vendor/${fileName}`;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

export default async function loadPdfMake(): Promise<PdfMakeStatic> {
  if (window.pdfMake?.createPdf) {
    return window.pdfMake;
  }

  if (!pdfMakePromise) {
    pdfMakePromise = (async () => {
      await loadScript(getAssetUrl('pdfmake.min.js'));
      await loadScript(getAssetUrl('vfs_fonts.js'));

      if (!window.pdfMake?.createPdf) {
        throw new Error('pdfMake failed to initialize');
      }

      return window.pdfMake;
    })().catch((error) => {
      pdfMakePromise = null;
      throw error;
    });
  }

  return pdfMakePromise;
}
