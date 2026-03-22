/**
 * engine.test.ts
 *
 * Unit tests for the scoring engine.
 *
 * `scoreTask` and `scoreCollaboration` are tested in isolation using a
 * temporary knowledge directory built from in-memory YAML — no network or
 * real knowledge files required.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import yaml from "js-yaml";
import { scoreTask, scoreCollaboration } from "../engine.js";
import type { KnowledgeEntry } from "../engine.js";

// ── Test knowledge fixtures ───────────────────────────────────────────────────

const DIM = {
  description: "A well-defined dimension",
  example:     "Human reviews before merge",
  antipattern: "Skipping review entirely",
};

const CODE_REVIEW_ENTRY = {
  id:          "code-review-test",
  title:       "Code Review Test",
  domain:      "coding",
  tags:        ["code-review", "pull-request"],
  contributor: "Test",
  version:     "1.0.0",
  dimensions:  { delegation: DIM, description: DIM, discernment: DIM, diligence: DIM },
  score_hints: { delegation: 0.25, description: 0.25, discernment: 0.25, diligence: 0.25 },
};

const WRITING_ENTRY = {
  id:          "writing-test",
  title:       "Content Writing Test",
  domain:      "writing",
  tags:        ["drafting", "editing"],
  contributor: "Test",
  version:     "1.0.0",
  dimensions:  { delegation: DIM, description: DIM, discernment: DIM, diligence: DIM },
  score_hints: { delegation: 0.25, description: 0.25, discernment: 0.25, diligence: 0.25 },
};

// ── Temp directory setup ──────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fluently-test-"));
  fs.writeFileSync(path.join(tmpDir, "coding-code-review-test.yaml"), yaml.dump(CODE_REVIEW_ENTRY));
  fs.writeFileSync(path.join(tmpDir, "writing-writing-test.yaml"),    yaml.dump(WRITING_ENTRY));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── scoreTask ─────────────────────────────────────────────────────────────────

describe("scoreTask", () => {
  it("returns at most 3 results", () => {
    const results = scoreTask({ description: "anything", delegation_intent: "" }, tmpDir);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("scores a coding task higher for the coding entry", () => {
    const results = scoreTask(
      { description: "AI reviews code pull request for quality", delegation_intent: "augmented" },
      tmpDir
    );
    // The first result should be the code review entry
    expect(results[0].entry.id).toBe("code-review-test");
  });

  it("scores a writing task higher for the writing entry", () => {
    const results = scoreTask(
      { description: "AI drafts content writing blog editing", delegation_intent: "augmented" },
      tmpDir
    );
    expect(results[0].entry.id).toBe("writing-test");
  });

  it("includes all required output fields", () => {
    const results = scoreTask({ description: "test", delegation_intent: "" }, tmpDir);
    const r = results[0];
    expect(r).toHaveProperty("entry");
    expect(r).toHaveProperty("dimensionScores");
    expect(r).toHaveProperty("collaborationScore");
    expect(r).toHaveProperty("collaborationSummary");
    expect(r).toHaveProperty("collaborationInsights");
    expect(r).toHaveProperty("suggestions");
  });

  it("produces dimension scores between 0 and 100", () => {
    const results = scoreTask({ description: "code review pull request", delegation_intent: "" }, tmpDir);
    Object.values(results[0].dimensionScores).forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

// ── scoreCollaboration ────────────────────────────────────────────────────────

describe("scoreCollaboration", () => {
  it("returns score 0 when collaboration block is missing", () => {
    // Cast to satisfy type — collaboration is optional in the real schema
    const entry = CODE_REVIEW_ENTRY as unknown as KnowledgeEntry;
    const result = scoreCollaboration(entry);
    expect(result.score).toBe(0);
    expect(result.insights).toContain("Missing collaboration block");
  });

  it("awards 100 for a perfect linear collaboration block", () => {
    const entry: KnowledgeEntry = {
      ...(CODE_REVIEW_ENTRY as unknown as KnowledgeEntry),
      collaboration: {
        pattern:     "linear",
        description: "Single-pass",
        sequence: [
          { step: 1, d: "delegation",  label: "Define scope",     triggers_next: "Scope agreed" },
          { step: 2, d: "description", label: "Provide context",  triggers_next: "Context ready" },
          { step: 3, d: "discernment", label: "Evaluate output",  triggers_next: "Output accepted" },
          { step: 4, d: "diligence",   label: "Approve and ship", triggers_next: "Done", can_restart: true },
        ],
        transitions: [
          { from: "delegation",  to: "description", trigger: "Scope agreed" },
          { from: "description", to: "discernment", trigger: "Context ready" },
          { from: "discernment", to: "diligence",   trigger: "Output accepted" },
        ],
      },
    };
    const result = scoreCollaboration(entry);
    expect(result.score).toBe(100);
  });

  it("deducts points when a D is missing from the sequence", () => {
    const entry: KnowledgeEntry = {
      ...(CODE_REVIEW_ENTRY as unknown as KnowledgeEntry),
      collaboration: {
        pattern:     "linear",
        description: "Missing diligence",
        sequence: [
          { step: 1, d: "delegation",  label: "x", triggers_next: "y" },
          { step: 2, d: "description", label: "x", triggers_next: "y" },
          { step: 3, d: "discernment", label: "x", triggers_next: "y" },
          // diligence is absent
        ],
        transitions: [
          { from: "delegation", to: "description", trigger: "y" },
          { from: "description", to: "discernment", trigger: "y" },
        ],
      },
    };
    const result = scoreCollaboration(entry);
    expect(result.score).toBeLessThan(100);
    expect(result.insights.some((i) => i.includes("Missing"))).toBe(true);
  });

  it("deducts points for missing loop-backs when pattern is iterative", () => {
    const entry: KnowledgeEntry = {
      ...(CODE_REVIEW_ENTRY as unknown as KnowledgeEntry),
      collaboration: {
        pattern:     "iterative",
        description: "Iterative without loop-backs",
        sequence: [
          { step: 1, d: "delegation",  label: "x", triggers_next: "y" },
          { step: 2, d: "description", label: "x", triggers_next: "y" },
          { step: 3, d: "discernment", label: "x", triggers_next: "y" },
          { step: 4, d: "diligence",   label: "x", triggers_next: "y" },
        ],
        transitions: [
          { from: "delegation",  to: "description", trigger: "y" },
          { from: "description", to: "discernment", trigger: "y" },
          { from: "discernment", to: "diligence",   trigger: "y" },
          // no is_loop_back: true transitions
        ],
      },
    };
    const result = scoreCollaboration(entry);
    expect(result.score).toBeLessThan(100);
    expect(result.insights.some((i) => i.includes("loop-back"))).toBe(true);
  });
});
