import { useEffect, useRef, useState } from 'react';
import type { SourceSpan } from '../types';
import { openPdf } from '../parser/extractPdf';

/** Render the printed section: fraction bars, radicals and symbols stay intact. */
export function QuestionSource({ file, source }: { file: File; source: SourceSpan[] }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading original PDF notation…');
  useEffect(() => {
    let canceled = false;
    let destroy: (() => void) | undefined;
    const container = host.current!;
    container.replaceChildren();
    setStatus('Loading original PDF notation…');
    void (async () => {
      try {
        const pdf = await openPdf(file);
        destroy = () => { void pdf.loadingTask.destroy(); };
        if (canceled) { destroy(); return; }
        for (const span of source) {
          const page = await pdf.getPage(span.page);
          if (canceled) return;
          const viewport = page.getViewport({ scale: 1.6 });
          let left = 0, top = 0, right = viewport.width, bottom = viewport.height;
          if (span.bounds) {
            const [a, b, c, d, e, f] = viewport.transform;
            const [px1, py1, px2, py2] = span.bounds;
            const [x1, y1, x2, y2] = [a * px1 + c * py1 + e, b * px1 + d * py1 + f, a * px2 + c * py2 + e, b * px2 + d * py2 + f];
            left = Math.max(0, Math.floor(Math.min(x1, x2)));
            top = Math.max(0, Math.floor(Math.min(y1, y2)));
            right = Math.min(viewport.width, Math.ceil(Math.max(x1, x2)));
            bottom = Math.min(viewport.height, Math.ceil(Math.max(y1, y2)));
          }
          if (right <= left || bottom <= top) throw new Error('Invalid source crop');
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(right - left); canvas.height = Math.ceil(bottom - top);
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Original question and answer on PDF page ${span.page}`);
          await page.render({ canvas, viewport, transform: [1, 0, 0, 1, -left, -top] }).promise;
          if (canceled) return;
          container.append(canvas);
          page.cleanup();
        }
        if (!canceled) setStatus('');
      } catch {
        if (!canceled) setStatus('Original notation could not be displayed. Use Source PDF (O); extracted text is below.');
      }
    })();
    return () => { canceled = true; destroy?.(); container.replaceChildren(); };
  }, [file, source]);
  return <section className="printed-question" aria-label="Original PDF notation"><p className="muted">Original PDF — question and official answer</p>{status && <p role="status">{status}</p>}<div ref={host} /></section>;
}
