import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// All files live in one flat folder (no public/ directory), so add the app icons to the build here.
const ICONS = ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const copyIcons = (): Plugin => ({
  name: 'copy-icons',
  apply: 'build',
  generateBundle() {
    for (const f of ICONS) if (existsSync(f)) this.emitFile({ type: 'asset', fileName: f, source: readFileSync(f) });
  },
});

// `npm run build`        -> static build in dist/ with offline support (PWA) — deploy to GitHub Pages / Vercel / Netlify
// `npm run build:single` -> one self-contained dist-single/index.html (no service worker)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins:
    mode === 'single'
      ? [react(), viteSingleFile()]
      : [
          react(),
          copyIcons(),
          VitePWA({
            registerType: 'autoUpdate',
            injectRegister: null, // registered manually in main.tsx (skipped in the single-file build)
            includeAssets: [],
            manifest: {
              name: 'Decode the Data – اكتشف البيانات واكتشف مسارك',
              short_name: 'Decode the Data',
              description: 'رحلة تفاعلية تعرّفك على مسارات البيانات الست ببناء نظام يتوقع ازدحام مطعم في جدة.',
              lang: 'ar',
              dir: 'rtl',
              start_url: './',
              scope: './',
              display: 'standalone',
              background_color: '#FBFAF7',
              theme_color: '#111833',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png}'],
              navigateFallback: 'index.html',
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
                },
              ],
            },
          }),
        ],
  publicDir: false,
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
