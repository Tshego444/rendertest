import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js'
  },
  server: {
    port: 5173,
    proxy: {
      // match your backend root routes
      '/jobs': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/users': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/employer': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/auth': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/seekers': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/resume': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/my-applied-jobs': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/me': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/conversation': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false }
    }
  }
})
