import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'stub-pwa-register-for-spck',
      resolveId(id) {
        if (id === 'virtual:pwa-register') {
          return '\0virtual:pwa-register-stub';
        }
      },
      load(id) {
        if (id === '\0virtual:pwa-register-stub') {
          return 'export function registerSW() { return () => {}; }';
        }
      },
    },
    {
      name: 'spck-relative-html-adapter',
      enforce: 'post',
      transformIndexHtml(html) {
        return html
          .replace(/\s+crossorigin(?:="[^"]*")?/g, '')
          .replace(/href="\/(apple-touch-icon\.png|icon\.svg)"/g, 'href="./$1"');
      },
    },
    {
      name: 'copy-unbundled-src-assets-spck',
      apply: 'build',
      closeBundle(error?: Error): void {
        if (error) return;
        const outDir = path.resolve(__dirname, 'spck');
        const srcAssets = path.resolve(__dirname, 'src/assets');
        const outAssets = path.resolve(outDir, 'src/assets');
        if (fs.existsSync(outDir) && fs.existsSync(srcAssets)) {
          fs.cpSync(srcAssets, outAssets, {recursive: true, force: true});
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'spck',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: 'assets/app[extname]',
      },
    },
  },
});
