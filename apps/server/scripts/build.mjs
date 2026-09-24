// Bundles the server (and the workspace-local @trivia/shared source) into
// dist/. Real npm dependencies stay external and are loaded from node_modules.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@trivia/'));

await build({
  entryPoints: ['src/index.ts', 'src/release.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external,
  logLevel: 'info',
});
