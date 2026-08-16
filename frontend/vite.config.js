import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@notifications': path.resolve(__dirname, '../notifications/frontend'),
      react: path.resolve(__dirname, 'node_modules/react'),
      firebase: path.resolve(__dirname, 'node_modules/firebase'),
    },
  },
  server: {
    port: 5173,
    historyApiFallback: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
