import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
  },
  resolve: {
    alias: {
      '@fluently/scorer': path.resolve(__dirname, 'packages/scorer/src'),
      '@fluently/scorer/': path.resolve(__dirname, 'packages/scorer/src/'),
    },
  },
});
