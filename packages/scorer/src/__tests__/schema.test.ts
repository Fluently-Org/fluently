/**
 * schema.test.ts
 *
 * Unit tests for the Zod schema used to validate 4D knowledge entries.
 *
 * Strategy:
 *   - Build a minimal valid entry and verify it passes.
 *   - Mutate one field at a time to verify each validation rule fires.
 *   - Cover the collaboration block separately (optional but schema-validated).
 */

import { describe, it, expect } from "vitest";
import { knowledgeEntrySchema } from "../schema.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A minimal valid dimension block. */
const validDim = {
  description: "Good description",
  example:     "Concrete example",
  antipattern: "Common mistake",
};

/** A minimal valid knowledge entry — all required fields, no optionals. */
const validEntry = {
  id:          "test-cycle",
  title:       "Test Cycle",
  domain:      "coding",
  tags:        ["testing"],
  contributor: "Test Author",
  version:     "1.0.0",
  dimensions: {
    delegation:  validDim,
    description: validDim,
    discernment: validDim,
    diligence:   validDim,
  },
  score_hints: {
    delegation:  0.25,
    description: 0.25,
    discernment: 0.25,
    diligence:   0.25,
  },
};

// ── Valid entry ───────────────────────────────────────────────────────────────

describe("knowledgeEntrySchema — valid entries", () => {
  it("accepts a complete minimal entry", () => {
    expect(() => knowledgeEntrySchema.parse(validEntry)).not.toThrow();
  });

  it("accepts an entry with optional collaboration block", () => {
    const withCollab = {
      ...validEntry,
      collaboration: {
        pattern:     "linear",
        description: "Single-pass workflow",
        sequence: [
          {
            step: 1, d: "delegation", label: "Define scope",
            triggers_next: "Scope agreed",
          },
          {
            step: 2, d: "description", label: "Provide context",
            triggers_next: "Context provided",
          },
        ],
        transitions: [
          { from: "delegation", to: "description", trigger: "Scope agreed" },
        ],
      },
    };
    expect(() => knowledgeEntrySchema.parse(withCollab)).not.toThrow();
  });

  it("accepts all valid domain values", () => {
    const domains = ["coding", "writing", "research", "customer-support", "education", "legal", "healthcare", "general"];
    domains.forEach((domain) => {
      expect(() => knowledgeEntrySchema.parse({ ...validEntry, domain })).not.toThrow();
    });
  });
});

// ── Invalid entries ───────────────────────────────────────────────────────────

describe("knowledgeEntrySchema — invalid entries", () => {
  it("rejects an unknown domain", () => {
    expect(() =>
      knowledgeEntrySchema.parse({ ...validEntry, domain: "finance" })
    ).toThrow();
  });

  it("rejects when score_hints do not sum to 1", () => {
    expect(() =>
      knowledgeEntrySchema.parse({
        ...validEntry,
        score_hints: { delegation: 0.3, description: 0.3, discernment: 0.3, diligence: 0.3 },
      })
    ).toThrow(/sum to 1/);
  });

  it("rejects when a required dimension field is missing", () => {
    expect(() =>
      knowledgeEntrySchema.parse({
        ...validEntry,
        dimensions: {
          ...validEntry.dimensions,
          delegation: { description: "Only description", example: "x" }, // missing antipattern
        },
      })
    ).toThrow();
  });

  it("rejects when a dimension is missing entirely", () => {
    const { diligence: _, ...noDiligence } = validEntry.dimensions;
    expect(() =>
      knowledgeEntrySchema.parse({ ...validEntry, dimensions: noDiligence })
    ).toThrow();
  });

  it("rejects an invalid collaboration pattern value", () => {
    expect(() =>
      knowledgeEntrySchema.parse({
        ...validEntry,
        collaboration: {
          pattern:     "waterfall", // not in enum
          description: "x",
          sequence: [
            { step: 1, d: "delegation", label: "x", triggers_next: "y" },
            { step: 2, d: "description", label: "x", triggers_next: "y" },
          ],
          transitions: [{ from: "delegation", to: "description", trigger: "y" }],
        },
      })
    ).toThrow();
  });

  it("rejects a collaboration sequence with fewer than 2 steps", () => {
    expect(() =>
      knowledgeEntrySchema.parse({
        ...validEntry,
        collaboration: {
          pattern: "linear",
          description: "x",
          sequence: [{ step: 1, d: "delegation", label: "x", triggers_next: "y" }],
          transitions: [],
        },
      })
    ).toThrow();
  });
});
