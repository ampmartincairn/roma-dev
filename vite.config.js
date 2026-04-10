import path from 'path';
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Use repository subpath in production so assets resolve on GitHub Pages.
  base: process.env.NODE_ENV === 'production' ? '/roma-dev/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    middlewareMode: false,
    hmr: true
  },
  plugins: [
    react(),
  ]
});