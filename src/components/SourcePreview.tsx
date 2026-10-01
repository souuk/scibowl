import { useEffect, useRef, useState } from 'react';
import { openPdf } from '../parser/extractPdf';
export function SourcePreview({ file, pages, onClose, onAttach }: { file: File | null; pages: number[]; onClose: () => void; onAttach: (file: File) => void }) {
  const [index, setIndex] = useState(0), [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const unique = [...new Set(pages)].sort((a, b) => a - b);
  const pageNumber = unique[Math.min(index, unique.length - 1)] || 1;
  useEffect(() => {
    let canceled = false;
    let destroy: (() => void) | undefined;
    setError('');
    if (file) void (async () => {
      try {
        const pdf = await openPdf(file); destroy = () => { void pdf.loadingTask.destroy(); };
        if (canceled) { destroy(); return; }
        const page = await pdf.getPage(pageNumber);
        if (canceled || !canvas.current) return;
        const viewport = page.getViewport({ scale: 1.4 });
        canvas.current.width = viewport.width; canvas.current.height = viewport.height;
        await page.render({ canvas: canvas.current, viewport }).promise;
      } catch (e) { if (!canceled) setError(e instanceof Error ? e.message : 'Source could not be displayed.'); }
    })();
    return () => { canceled = true; destroy?.(); };
  }, [file, pageNumber]);
  return <section className="source" aria-label="Source PDF"><h2>Source PDF — page {pageNumber}</h2><p>Gameplay is paused. Close this view, then press Space to resume a countdown.</p><button autoFocus onClick={onClose}>Close source (O / Escape)</button>
    {!file && <label>Reselect the original PDF to view its pages<input type="file" accept="application/pdf,.pdf" onChange={e => { if (e.target.files?.[0]) onAttach(e.target.files[0]); }} /></label>}
    {error && <p role="alert">{error}</p>}
    {file && <><div><button disabled={index <= 0} onClick={() => setIndex(i => i - 1)}>Previous source page</button><button disabled={index >= unique.length - 1} onClick={() => setIndex(i => i + 1)}>Next source page</button></div><canvas ref={canvas} /></>}
  </section>;
}
