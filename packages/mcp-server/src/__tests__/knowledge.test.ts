/**
 * knowledge.test.ts
 *
 * Unit tests for the in-memory knowledge cache.
 *
 * The connector is mocked with a simple in-memory implementation so tests run
 * fast with no network or disk I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getKnowledge, refreshKnowledge, invalidateCache } from "../knowledge.js";
import type { KnowledgeConnector, KnowledgeEntry } from "../connectors/types.js";

// ── Mock connector ────────────────────────────────────────────────────────────

function makeEntry(id: string): KnowledgeEntry {
  const dim = { description: "d", example: "e", antipattern: "a" };
  return {
    id,
    title: `Cycle ${id}`,
    domain: "coding",
    tags: [],
    contributor: "Test",
    version: "1.0.0",
    dimensions: { delegation: dim, description: dim, discernment: dim, diligence: dim },
    score_hints: { delegation: 0.25, description: 0.25, discernment: 0.25, diligence: 0.25 },
  };
}

function makeConnector(entries: KnowledgeEntry[], name = "mock"): KnowledgeConnector {
  return {
    name,
    load: async () => entries,
    contribute: async () => ({ success: true, message: "ok" }),
  };
}

function makeFailingConnector(): KnowledgeConnector {
  return {
    name: "failing",
    load: async () => { throw new Error("Network unavailable"); },
    contribute: async () => { throw new Error("Network unavailable"); },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Reset the module-level cache before each test to ensure isolation.
beforeEach(() => invalidateCache());

describe("getKnowledge", () => {
  it("loads entries from the connector on first call", async () => {
    const connector = makeConnector([makeEntry("a"), makeEntry("b")]);
    const result = await getKnowledge(connector);
    expect(result.entries).toHaveLength(2);
    expect(result.source).toBe("mock");
  });

  it("returns cached result on second call (no reload)", async () => {
    let callCount = 0;
    const connector: KnowledgeConnector = {
      name: "counted",
      load: async () => { callCount++; return [makeEntry("a")]; },
      contribute: async () => ({ success: true, message: "ok" }),
    };
    await getKnowledge(connector);
    await getKnowledge(connector);
    expect(callCount).toBe(1);
  });
});

describe("refreshKnowledge", () => {
  it("reloads even when cache is warm", async () => {
    let callCount = 0;
    const connector: KnowledgeConnector = {
      name: "counted",
      load: async () => { callCount++; return [makeEntry("a")]; },
      contribute: async () => ({ success: true, message: "ok" }),
    };
    await refreshKnowledge(connector);
    await refreshKnowledge(connector);
    expect(callCount).toBe(2);
  });

  it("falls back to stale cache when connector fails after first load", async () => {
    const goodConnector = makeConnector([makeEntry("a")]);
    await refreshKnowledge(goodConnector); // warm cache

    const result = await refreshKnowledge(makeFailingConnector());
    expect(result.entries).toHaveLength(1); // stale cache used
    expect(result.entries[0].id).toBe("a");
  });

  it("throws when connector fails and cache is cold", async () => {
    await expect(
      refreshKnowledge(makeFailingConnector())
    ).rejects.toThrow();
  });
});

describe("invalidateCache", () => {
  it("forces a reload on next getKnowledge call", async () => {
    let callCount = 0;
    const connector: KnowledgeConnector = {
      name: "counted",
      load: async () => { callCount++; return [makeEntry("a")]; },
      contribute: async () => ({ success: true, message: "ok" }),
    };
    await getKnowledge(connector);
    invalidateCache();
    await getKnowledge(connector);
    expect(callCount).toBe(2);
  });
});
