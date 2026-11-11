import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/        (for Capacitor / web hosting)
// `npm run build:single` -> dist-single/ (one self-contained index.html for quick sharing)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single
      ? [
          // the single-file build has no sibling files, so drop the manifest/icon links
          { name: 'strip-pwa', transformIndexHtml: (html) => html.replace(/<!--pwa-->[\s\S]*?<!--\/pwa-->/, '') },
          viteSingleFile(),
        ]
      : [],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2020',
      assetsInlineLimit: single ? 100000000 : 4096,
      chunkSizeWarningLimit: 1500,
    },
  };
});
