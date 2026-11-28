// Portable build of the server: bundles server/main.ts and all its
// dependencies into dist/server.mjs, and copies server.config.json next to
// it. Together with the client in dist/public, the dist/ folder runs with
// `node server.mjs` and needs no node_modules.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'dist');

await build({
  entryPoints: [resolve(root, 'server/main.ts')],
  outfile: resolve(outDir, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // CommonJS dependencies bundled into an ES module still call require().
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\n" +
      'const require = __createRequire(import.meta.url);',
  },
  define: { __BUNDLED__: 'true' },
  legalComments: 'none',
  logLevel: 'info',
});

// Keep a relative modelDir pointing at the same directory from dist/.
const config = JSON.parse(readFileSync(resolve(root, 'server.config.json'), 'utf8'));
if (typeof config.modelDir === 'string' && !isAbsolute(config.modelDir)) {
  config.modelDir = relative(outDir, resolve(root, config.modelDir)) || '.';
}
writeFileSync(resolve(outDir, 'server.config.json'), JSON.stringify(config, null, 2) + '\n');
console.log(`dist/server.config.json: modelDir = ${config.modelDir}`);
