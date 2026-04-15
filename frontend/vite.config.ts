import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    // Serve index.html for every unknown path so React Router handles routing.
    // Without this, a browser refresh on /dashboard returns a 404 from the dev server.
    historyApiFallback: true,
  },
});
