import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/components/StyledMarkdown.tsx')) return 'markdown';
          if (
            id.includes('/node_modules/react-markdown/') ||
            id.includes('/node_modules/remark-gfm/') ||
            id.includes('/node_modules/remark-math/') ||
            id.includes('/node_modules/rehype-katex/') ||
            id.includes('/node_modules/katex/')
          ) {
            return 'markdown';
          }
          if (id.includes('/node_modules/lucide-react/')) return 'icons';
          if (id.includes('/node_modules/@firebase/auth/') || id.includes('/node_modules/firebase/auth/')) return 'firebase-auth';
          if (id.includes('/node_modules/@firebase/firestore/') || id.includes('/node_modules/firebase/firestore/')) return 'firebase-firestore';
          if (id.includes('/node_modules/@firebase/functions/') || id.includes('/node_modules/firebase/functions/')) return 'firebase-functions';
          if (id.includes('/node_modules/@firebase/storage/') || id.includes('/node_modules/firebase/storage/')) return 'firebase-storage';
          if (id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/')) return 'firebase-core';
          if (
            id.includes('/node_modules/@capacitor/') ||
            id.includes('/node_modules/@capgo/') ||
            id.includes('/node_modules/@revenuecat/')
          ) {
            return 'native';
          }
          if (id.endsWith('/ai.ts')) return 'ai';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) {
            return 'react-vendor';
          }
          return undefined;
        }
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
