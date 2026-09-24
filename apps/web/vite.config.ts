import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    // Reachable from phones on the same Wi-Fi.
    host: true,
    proxy: {
      '/socket.io': { target: serverUrl, ws: true },
      '/healthz': serverUrl,
    },
  },
  build: {
    target: 'es2020',
  },
});
