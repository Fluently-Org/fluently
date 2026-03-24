/**
 * knowledge.ts
 *
 * In-memory knowledge cache with connector-backed loading.
 *
 * The cache lives for CACHE_TTL_MS (1 hour by default).
 * On load failure the server falls back in priority order:
 *   1. Stale cache (if available)
 *   2. Bundled YAML files (shipped with the package at build time)
 *   3. Hard error
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { KnowledgeConnector, KnowledgeEntry, FrameworkDefinition } from "./connectors/types.js";

// __dirname is a CJS module variable (available in the compiled esbuild CJS output).
// In ESM contexts (vitest running TypeScript source) it is not defined — catch the
// ReferenceError and fall back to a path relative to process.cwd() (repo root in CI).
let _dirname: string;
try {
  _dirname = __dirname; // works in compiled CJS (Node.js module scope)
} catch {
  _dirname = path.join(process.cwd(), "packages/mcp-server/src");
}

/** Bundled fallback — YAML files copied into dist/knowledge at build time. */
export const BUNDLED_KNOWLEDGE = path.join(_dirname, "../knowledge");

/** How long a successful load is considered fresh. */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface KnowledgeCache {
  entries: KnowledgeEntry[];
  loadedAt: number;
  source: string;
}

export interface FrameworkCache {
  frameworks: FrameworkDefinition[];
  loadedAt: number;
  source: string;
}

let cache: KnowledgeCache | null = null;
let frameworkCache: FrameworkCache | null = null;

/** Return cached entries if still fresh, otherwise reload from the connector. */
export async function getKnowledge(connector: KnowledgeConnector): Promise<KnowledgeCache> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  return refreshKnowledge(connector);
}

/**
 * Force-reload from the connector, bypassing the TTL.
 * Falls back to stale cache → bundled YAML on failure.
 */
export async function refreshKnowledge(connector: KnowledgeConnector): Promise<KnowledgeCache> {
  try {
    const entries = await connector.load();
    cache = { entries, loadedAt: Date.now(), source: connector.name };
    console.error(`[fluently] Loaded ${entries.length} cycles from ${connector.name}`);
    return cache;
  } catch (err: any) {
    console.error(`[fluently] Load failed (${connector.name}): ${err.message}`);

    // Prefer stale cache over bundled — the user's connector data is more accurate
    if (cache) {
      console.error(`[fluently] Using stale cache (${cache.entries.length} entries)`);
      return cache;
    }

    // Last resort: bundled knowledge shipped with the package
    if (fs.existsSync(BUNDLED_KNOWLEDGE)) {
      console.error("[fluently] Falling back to bundled knowledge");
      const files = fs.readdirSync(BUNDLED_KNOWLEDGE).filter(f => f.endsWith(".yaml"));
      const entries = files.map(f =>
        yaml.load(fs.readFileSync(path.join(BUNDLED_KNOWLEDGE, f), "utf8")) as KnowledgeEntry
      );
      cache = { entries, loadedAt: Date.now(), source: "bundled-fallback" };
      return cache;
    }

    throw new Error(`No knowledge available: ${err.message}`);
  }
}

/** Return cached frameworks if still fresh, otherwise reload from the connector. */
export async function getFrameworks(connector: KnowledgeConnector): Promise<FrameworkCache> {
  if (frameworkCache && Date.now() - frameworkCache.loadedAt < CACHE_TTL_MS) return frameworkCache;
  return refreshFrameworks(connector);
}

/**
 * Force-reload frameworks from the connector, bypassing the TTL.
 * Falls back to stale cache on failure.
 */
export async function refreshFrameworks(connector: KnowledgeConnector): Promise<FrameworkCache> {
  if (!connector.loadFrameworks) {
    // Connector does not support frameworks — return stale cache or empty
    if (frameworkCache) return frameworkCache;
    frameworkCache = { frameworks: [], loadedAt: Date.now(), source: connector.name };
    return frameworkCache;
  }

  try {
    const frameworks = await connector.loadFrameworks();
    frameworkCache = { frameworks, loadedAt: Date.now(), source: connector.name };
    console.error(`[fluently] Loaded ${frameworks.length} framework(s) from ${connector.name}`);
    return frameworkCache;
  } catch (err: any) {
    console.error(`[fluently] Framework load failed (${connector.name}): ${err.message}`);

    if (frameworkCache) {
      console.error(`[fluently] Using stale framework cache (${frameworkCache.frameworks.length} framework(s))`);
      return frameworkCache;
    }

    frameworkCache = { frameworks: [], loadedAt: Date.now(), source: "empty-fallback" };
    return frameworkCache;
  }
}

/** Invalidate the cache so the next getKnowledge() call reloads. */
export function invalidateCache(): void {
  cache = null;
  frameworkCache = null;
}
