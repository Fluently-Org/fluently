/**
 * utils/paths.ts
 *
 * Centralises path resolution for the CLI so every command finds the
 * bundled knowledge directory the same way.
 *
 * The knowledge folder is copied into dist/knowledge at build time, so it
 * lives one level above the compiled JS files in dist/.
 */

import path from "path";

/**
 * Absolute path to the bundled knowledge directory (dist/knowledge).
 * Esbuild copies knowledge/ into dist/knowledge at build time; this file
 * compiles to dist/utils/paths.js, so knowledge is two levels up.
 */
export function knowledgeDir(): string {
  return path.resolve(__dirname, "../../knowledge");
}
