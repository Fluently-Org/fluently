import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

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

// Copy package.json so the bundle can read version at runtime
copyFileSync(join(__dirname, 'package.json'), join(__dirname, 'dist', 'package.json'));

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  alias: {
    '@fluently/scorer': resolve(root, 'packages/scorer/src/index.ts'),
    '@fluently/scorer/schema': resolve(root, 'packages/scorer/src/schema.ts'),
  },
  external: ['esbuild'],
};

await build({ ...shared, entryPoints: ['src/index.ts'], outfile: 'dist/index.js' });
await build({ ...shared, entryPoints: ['src/bin.ts'],   outfile: 'dist/bin.js',
  banner: { js: '#!/usr/bin/env node' } });

console.log('Build complete!');
