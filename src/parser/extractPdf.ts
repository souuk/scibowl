import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { reconstructLines } from './reconstructLines';
import type { ExtractedDocument, TextItem } from '../types';
GlobalWorkerOptions.workerSrc = workerUrl;

export async function hashFile(file: File): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', iccUrl: '/pdfjs/iccs/' });
  try {
    return await task.promise;
  } catch (e) {
    await task.destroy();
    if (e instanceof Error && e.name === 'PasswordException') throw new Error('Password-protected PDFs are not supported. Choose an unlocked DOE packet.');
    throw new Error('The PDF could not be opened. It may be damaged or not a PDF.');
  }
}
export async function extractPdf(file: File, onProgress: (message: string) => void): Promise<ExtractedDocument> {
  const pdf = await openPdf(file);
  const pages: ExtractedDocument['pages'] = [];
  try {
    for (let page = 1; page <= pdf.numPages; page++) {
      onProgress(`Extracting page ${page} / ${pdf.numPages}`);
      const p = await pdf.getPage(page);
      const content = await p.getTextContent({ disableNormalization: true });
      pages.push(reconstructLines(content.items.filter(i => 'str' in i) as TextItem[], page));
      p.cleanup();
    }
  } finally { await pdf.loadingTask.destroy(); }
  if (!pages.some(p => p.text.trim())) throw new Error('No extractable question text was found. Scanned PDFs require OCR, which this app does not provide.');
  return { pages };
}
