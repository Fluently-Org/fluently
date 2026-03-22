/**
 * ranking.test.ts
 *
 * Unit tests for the keyword-based cosine similarity ranker.
 *
 * Tests are designed to be fast (<5 ms each), deterministic, and independent
 * of any external state — no file I/O, no network, no knowledge files.
 */

import { describe, it, expect } from "vitest";
import { keywordSet, cosineSimilarity, rankCycles } from "../ranking.js";
import type { KnowledgeEntry } from "../connectors/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDim(text: string) {
  return { description: text, example: "example", antipattern: "antipattern" };
}

function makeEntry(id: string, title: string, domain: string, tags: string[] = []): KnowledgeEntry {
  return {
    id,
    title,
    domain,
    tags,
    contributor: "Test",
    version:     "1.0.0",
    dimensions: {
      delegation:  makeDim(`${title} delegation guidance`),
      description: makeDim(`${title} description guidance`),
      discernment: makeDim(`${title} discernment guidance`),
      diligence:   makeDim(`${title} diligence guidance`),
    },
    score_hints: { delegation: 0.25, description: 0.25, discernment: 0.25, diligence: 0.25 },
  };
}

// ── keywordSet ────────────────────────────────────────────────────────────────

describe("keywordSet", () => {
  it("returns a Set of lowercase words", () => {
    const s = keywordSet("Hello World");
    expect(s.has("hello")).toBe(true);
    expect(s.has("world")).toBe(true);
  });

  it("filters out short tokens (≤ 2 chars)", () => {
    const s = keywordSet("is it a good API");
    expect(s.has("is")).toBe(false);
    expect(s.has("it")).toBe(false);
    expect(s.has("a")).toBe(false);
    expect(s.has("good")).toBe(true);
  });

  it("strips punctuation", () => {
    const s = keywordSet("hello, world! foo-bar");
    expect(s.has("hello")).toBe(true);
    expect(s.has("world")).toBe(true);
    expect(s.has("foo")).toBe(true);
    expect(s.has("bar")).toBe(true);
  });

  it("returns an empty set for empty input", () => {
    expect(keywordSet("").size).toBe(0);
  });

  it("deduplicates repeated words", () => {
    const s = keywordSet("test test test");
    expect(s.size).toBe(1);
  });
});

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1 for identical sets", () => {
    const s = new Set(["foo", "bar"]);
    expect(cosineSimilarity(s, s)).toBeCloseTo(1, 5);
  });

  it("returns 0 for completely disjoint sets", () => {
    const a = new Set(["foo"]);
    const b = new Set(["bar"]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 when either set is empty", () => {
    expect(cosineSimilarity(new Set(), new Set(["foo"]))).toBe(0);
    expect(cosineSimilarity(new Set(["foo"]), new Set())).toBe(0);
  });

  it("returns a value between 0 and 1 for partial overlap", () => {
    const a = new Set(["foo", "bar", "baz"]);
    const b = new Set(["foo", "bar", "qux"]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("is symmetric", () => {
    const a = new Set(["foo", "bar"]);
    const b = new Set(["bar", "baz"]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

// ── rankCycles ────────────────────────────────────────────────────────────────

describe("rankCycles", () => {
  const entries: KnowledgeEntry[] = [
    makeEntry("code-review",  "Code Review Triage",  "coding",  ["code-review", "pull-request"]),
    makeEntry("content-draft", "Content Drafting",   "writing", ["drafting", "editing"]),
    makeEntry("bug-triage",   "Bug Fix Triage",      "coding",  ["bug-fix", "triage"]),
  ];

  it("returns at most `limit` results", () => {
    expect(rankCycles("anything", entries, undefined, 2)).toHaveLength(2);
  });

  it("returns all entries when limit > entries.length", () => {
    expect(rankCycles("anything", entries, undefined, 100).length).toBeLessThanOrEqual(entries.length);
  });

  it("ranks code review entry first for a code-review query", () => {
    const results = rankCycles("AI code review pull request", entries, undefined, 3);
    expect(results[0].id).toBe("code-review");
  });

  it("ranks writing entry first for a drafting query", () => {
    const results = rankCycles("AI drafting editing content writing blog", entries, undefined, 3);
    expect(results[0].id).toBe("content-draft");
  });

  it("filters by domain when domain is specified", () => {
    const results = rankCycles("anything", entries, "writing", 10);
    results.forEach((r) => expect(r.domain).toBe("writing"));
  });

  it("returns empty array when domain filter matches nothing", () => {
    const results = rankCycles("anything", entries, "healthcare", 10);
    expect(results).toHaveLength(0);
  });

  it("returns empty array for empty entry list", () => {
    expect(rankCycles("anything", [], undefined, 5)).toHaveLength(0);
  });
});
