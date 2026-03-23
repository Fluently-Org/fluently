/**
 * ranking.ts
 *
 * Keyword-based cosine similarity ranking for Fluently cycles.
 *
 * Why keyword similarity instead of embeddings?
 * - Zero latency, zero API cost, works offline
 * - Transparent — easy to debug when a cycle ranks unexpectedly
 * - Accurate enough for structured 4D content (domain terms are distinctive)
 *
 * Future: swap in vector embeddings here without touching any other file.
 */

import type { KnowledgeEntry } from "./connectors/types.js";

/** Turn text into a lowercase word set, stripping punctuation and short tokens. */
export function keywordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 2));
}

/** Binary cosine similarity between two keyword sets (each word is either 0 or 1). */
export function cosineSimilarity(a: Set<string>, b: Set<string>): number {
  const all = new Set([...a, ...b]);
  let dot = 0, magA = 0, magB = 0;
  for (const w of all) {
    const av = a.has(w) ? 1 : 0;
    const bv = b.has(w) ? 1 : 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

/**
 * Rank knowledge entries by similarity to a task description.
 *
 * Indexes each entry on: title + domain + tags + all four dimension descriptions.
 * Returns at most `limit` entries, sorted by descending similarity.
 */
export function rankCycles(
  task: string,
  entries: KnowledgeEntry[],
  domain?: string,
  limit = 5
): KnowledgeEntry[] {
  const taskSet = keywordSet(task);

  return entries
    .filter(e => !domain || e.domain === domain)
    .map(e => ({
      entry: e,
      sim: cosineSimilarity(
        taskSet,
        keywordSet(
          [
            e.title,
            e.domain,
            e.summary ?? "",
            ...(e.tags ?? []),
            ...Object.values(e.dimensions).map(d => d.description),
          ].join(" ")
        )
      ),
    }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map(r => r.entry);
}
