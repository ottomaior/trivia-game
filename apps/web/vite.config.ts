import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';

/**
 * The version of the rendered paper art (scripts/art.mjs), appended to every
 * art URL as `?v=` so the server can cache the bitmaps for a year. Code gets
 * it through `art()` (src/ui/art.ts); CSS `url('/art/x.webp')` is rewritten
 * here, because Vite leaves absolute public-dir URLs alone.
 */
function artVersion(): string {
  try {
    return JSON.parse(readFileSync(new URL('./.art/raster-manifest.json', import.meta.url), 'utf8')).version;
  } catch {
    return 'dev'; // tests run without the art
  }
}

function artVersionInCss(version: string): Plugin {
  return {
    name: 'art-version',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.css') || !code.includes('/art/')) return null;
      return { code: code.replace(/\/art\/([\w-]+)\.webp/g, `/art/$1.webp?v=${version}`), map: null };
    },
  };
}

const version = artVersion();

export default defineConfig({
  plugins: [react(), artVersionInCss(version)],
  define: { __ART_VERSION__: JSON.stringify(version) },
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
