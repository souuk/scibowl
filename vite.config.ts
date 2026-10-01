import { defineConfig } from 'vitest/config';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// PDF.js auxiliary files are served from this origin, including offline use.
const assets = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
export default defineConfig({
  plugins: [{ name: 'local-pdf-assets', buildStart() {
    mkdirSync('public/pdfjs', { recursive: true });
    for (const asset of assets) {
      try { cpSync(resolve('node_modules/pdfjs-dist', asset), resolve('public/pdfjs', asset), { recursive: true }); }
      catch (error) { if (asset !== 'iccs') throw error; }
    }
  } }],
  test: { include: ['tests/**/*.test.ts'] },
});
