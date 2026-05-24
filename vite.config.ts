import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/bkam': {
        target: 'https://www.bkam.ma',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/bkam/, ''),
      },
    },
  },
})
