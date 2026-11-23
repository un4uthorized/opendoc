import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The build script sets NODE_ENV=production: the project's .env (meant for the API server) sets
// NODE_ENV, and Vite would otherwise ship React's development build. See package.json.
// The API (apps/api) runs apart; the dev and preview servers forward /api to it, so the session
// cookie stays first-party and no CORS is needed.
const apiTarget = process.env.API_URL ?? 'http://127.0.0.1:4173';
const proxy = { '/api': { target: apiTarget, changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  // 4173 (Vite's default preview port) is the API's port.
  preview: { port: 4174, proxy },
  build: {
    rolldownOptions: {
      output: {
        // React in its own chunk: it changes far less often than the app code, so browsers keep it
        // cached across deploys. Markdown (only on pages that render guides) gets one too. Radix and
        // the icons stay split per page on purpose: one chunk for all of them would make the home
        // page download the docs' menus, selects and dialogs.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
            { name: 'markdown', test: /node_modules[\\/](markdown-it|entities|linkify-it|mdurl|uc\.micro|punycode\.js)[\\/]/, priority: 2 },
          ],
        },
      },
    },
  },
});
