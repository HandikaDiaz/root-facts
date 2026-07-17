import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    // Naikkan batas warning ukuran chunk untuk WASM/TF.js yang besar
    chunkSizeWarningLimit: 30000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'icons/apple-touch-icon.png',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png',
      ],
      includeManifestIcons: true,
      workbox: {
        // Izinkan precaching file besar: model AI weights.bin ~2.16 MB, JS bundle ~2.7 MB
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30 MB untuk WASM + model
        // Precaching aset inti (HTML, CSS, JS, WASM) + model AI
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}',
          'model/**/*.{json,bin}',
        ],
        // Runtime caching untuk resource eksternal (Google Fonts, HuggingFace CDN)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 tahun
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache untuk model Transformers.js dari HuggingFace
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-model-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 hari
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn-lfs.*\.huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 hari
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'RootFacts - AI Vegetable Recognition',
        short_name: 'RootFacts',
        description: 'Aplikasi AI untuk mengenali sayuran dan memberikan fakta menarik menggunakan kamera',
        start_url: '/',
        display: 'standalone',
        background_color: '#f9fafb',
        theme_color: '#10b981',
        orientation: 'portrait',
        lang: 'id',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  server: {
    port: 3001,
    host: true
  }
});
