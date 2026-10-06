/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `vite build --mode native`: bản đóng gói Capacitor (iOS/Android) — không cần service worker PWA,
// mọi file đã nằm sẵn trong app.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode !== 'native' && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PTALK Review',
        short_name: 'PTALK',
        description: 'Ôn luyện tiếng Anh giao tiếp sau mỗi buổi học PTALK',
        theme_color: '#13203f',
        background_color: '#13203f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json,woff2,mp3}'] },
    }),
  ],
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts?(x)'] },
}))
