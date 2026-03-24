import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

// Copy knowledge files into packages/cli/knowledge/
function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

const knowledgeSrc = join(root, 'knowledge');
const knowledgeDest = join(__dirname, 'knowledge');
console.log('Copying knowledge base...');
copyDir(knowledgeSrc, knowledgeDest);

// Build with esbuild
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  alias: {
    'fluently-scorer': resolve(root, 'packages/scorer/src/index.ts'),
    'fluently-scorer/schema': resolve(root, 'packages/scorer/src/schema.ts'),
  },
  external: ['esbuild'],
});

console.log('Build complete!');
