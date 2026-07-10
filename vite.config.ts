/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // FSEC-M2 — Strip console.* / debugger from PRODUCTION builds only
  // (command === 'build'). Dev serve (command === 'serve') and Vitest (which runs
  // in 'serve' mode) keep console output so the dev-only `logger` util and the
  // logger.test.ts console spies still work.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  resolve: {
    alias: {
      '#': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
    include: [
      'config/**/*.{test,spec}.{ts,tsx}',
      'src/core/**/*.{test,spec}.{ts,tsx}',
      'src/hooks/**/*.{test,spec}.{ts,tsx}',
      'src/machines/**/*.{test,spec}.{ts,tsx}',
      'src/providers/**/*.{test,spec}.{ts,tsx}',
      'src/service/**/*.{test,spec}.{ts,tsx}',
      'src/utils/**/*.{test,spec}.{ts,tsx}',
      'src/App.{test,spec}.{ts,tsx}',
      'src/main.{test,spec}.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        'src/components/',
        'src/assets/',
        'src/models/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        'dist/'
      ]
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
}))
