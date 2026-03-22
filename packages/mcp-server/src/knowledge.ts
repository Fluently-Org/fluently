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
import type { KnowledgeConnector, KnowledgeEntry } from "./connectors/types.js";

/** Bundled fallback — YAML files copied into dist/knowledge at build time. */
export const BUNDLED_KNOWLEDGE = path.join(__dirname, "../knowledge");

/** How long a successful load is considered fresh. */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface KnowledgeCache {
  entries: KnowledgeEntry[];
  loadedAt: number;
  source: string;
}

let cache: KnowledgeCache | null = null;

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

/** Invalidate the cache so the next getKnowledge() call reloads. */
export function invalidateCache(): void {
  cache = null;
}
