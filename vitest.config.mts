import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'src/e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(import.meta.dirname, './src')
    }
  }
})
