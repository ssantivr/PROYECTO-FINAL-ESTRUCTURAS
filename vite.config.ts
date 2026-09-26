import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': { target: process.env.ARQUILA_API ?? 'http://localhost:4000', changeOrigin: true },
    },
  },
});
