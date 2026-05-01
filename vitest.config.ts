import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@lib': resolve(__dirname, './src/lib'),
      '@app': resolve(__dirname, './src/app'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '.next/', 'prisma/', 'e2e/']
    },
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/e2e/**',
      '**/playwright.config.ts',
      'src/app/api/__tests__/**'  // API tests need more complex mocking
    ],
    include: ['src/lib/**/*.{test,spec}.{ts,tsx}']
  }
})
