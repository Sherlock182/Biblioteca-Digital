import { Asset } from 'expo-asset';
import pdfRuntimeAsset from '../assets/pdfjs/pdf.min.txt';
import pdfWorkerAsset from '../assets/pdfjs/pdf.worker.min.txt';
import { getPDFViewerHTML } from './pdf-viewer-html';
import { readFileAsTextSafe } from './safe-file-reader';

/** A real origin (instead of the opaque one of an inline page) lets the viewer start blob workers. */
export const PDF_VIEWER_BASE_URL = 'https://pdf-viewer.local/';
export type PDFViewerSource = { html: string; baseUrl: string };

export type PDFAnalysis = {
  verdict: 'text' | 'mixed' | 'scanned' | 'garbled';
  numPages: number;
  sampledPages: number;
  textPages: number;
  garbledPages: number;
};

let sourcePromise: Promise<PDFViewerSource> | undefined;
export function loadPDFViewerSource(): Promise<PDFViewerSource> {
  if (!sourcePromise) {
    sourcePromise = Promise.all([pdfRuntimeAsset, pdfWorkerAsset].map(async module => {
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      return readFileAsTextSafe(asset.localUri || asset.uri);
    })).then(([runtime, worker]) => ({ html: getPDFViewerHTML(runtime, worker), baseUrl: PDF_VIEWER_BASE_URL }))
      .catch(error => { sourcePromise = undefined; throw error; });
  }
  return sourcePromise;
}

export function isViewerNavigation(url: string): boolean {
  return url === 'about:blank' || url.startsWith(PDF_VIEWER_BASE_URL) || url.startsWith('data:text/html');
}

// 1 MiB of base64 per injection keeps each evaluateJavascript call small; must be a multiple of 4.
const CHUNK_CHARS = 1 << 20;

/** Streams the document into the viewer. Resolves false if cancelled midway. */
export async function sendPDFData(
  inject: (script: string) => void, base64: string,
  onProgress?: (fraction: number) => void, isCancelled?: () => boolean,
): Promise<boolean> {
  const data = /\s/.test(base64) ? base64.replace(/\s+/g, '') : base64;
  inject('window.beginPDF()');
  for (let start = 0; start < data.length; start += CHUNK_CHARS) {
    if (isCancelled?.()) return false;
    inject("window.appendPDFChunk('" + data.slice(start, start + CHUNK_CHARS) + "')");
    onProgress?.(Math.min(1, (start + CHUNK_CHARS) / data.length));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return !isCancelled?.();
}
