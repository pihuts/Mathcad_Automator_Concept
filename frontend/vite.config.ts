/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    // Enable CSS code splitting
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Manual chunks for vendor libraries to improve caching and reduce initial load
        manualChunks: {
          // MUI - split into core and icons
          'mui-core': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'mui-icons': ['@mui/icons-material'],
          'mui-charts': ['@mui/x-charts'],

          // Data grid (lazy loaded when user views data tables)
          'ag-grid': ['ag-grid-community', 'ag-grid-react'],

          // Data utilities
          'data-utils': ['axios', '@tanstack/react-query', 'papaparse'],
        },
      },
    },
    // Increase chunk size warning limit since we're splitting manually
    chunkSizeWarningLimit: 600,
  },
})
