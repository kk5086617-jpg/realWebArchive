import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/covers': 'http://localhost:3001',
      '/games': 'http://localhost:3001',
    },
  },
})
