import { describe, it, expect } from "vitest";
import {
  frameworkDefinitionSchema,
  buildKnowledgeSchemas,
  BUNDLED_4D_FRAMEWORK,
} from "../framework-schema.js";

describe("frameworkDefinitionSchema", () => {
  it("validates the bundled 4D framework", () => {
    expect(() => frameworkDefinitionSchema.parse(BUNDLED_4D_FRAMEWORK)).not.toThrow();
  });

  it("rejects framework with duplicate dimension keys", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "dup-test",
      dimensions: [
        { key: "delegation", label: "A", description: "a", canonical_order: 1 },
        { key: "delegation", label: "B", description: "b", canonical_order: 2 }, // duplicate
      ],
    })).toThrow();
  });

  it("rejects framework with non-kebab-case id", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "My Framework", // spaces not allowed
    })).toThrow();
  });

  it("rejects framework with zero dimensions", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "empty",
      dimensions: [],
    })).toThrow();
  });
});

describe("buildKnowledgeSchemas", () => {
  const threeD = {
    id: "3d-test",
    name: "3D Test",
    version: "1.0.0",
    contributor: "Test",
    description: "A 3-dimension test framework",
    dimensions: [
      { key: "plan",    label: "Plan",    description: "p", canonical_order: 1 },
      { key: "execute", label: "Execute", description: "e", canonical_order: 2 },
      { key: "review",  label: "Review",  description: "r", canonical_order: 3 },
    ],
  };

  const validEntry3D = {
    id: "test-3d-entry",
    framework_id: "3d-test",
    title: "Test 3D Entry",
    domain: "coding",
    dimensions: {
      plan:    { description: "d", example: "e", antipattern: "a" },
      execute: { description: "d", example: "e", antipattern: "a" },
      review:  { description: "d", example: "e", antipattern: "a" },
    },
    score_hints: { plan: 0.34, execute: 0.33, review: 0.33 },
    tags: ["test"],
    contributor: "Test",
    version: "1.0.0",
    collaboration: {
      pattern: "linear",
      description: "Test",
      sequence: [
        { step: 1, d: "plan",    label: "Plan task",     triggers_next: "Ready" },
        { step: 2, d: "execute", label: "Execute task",  triggers_next: "Done" },
      ],
      transitions: [
        { from: "plan", to: "execute", trigger: "Ready" },
      ],
    },
  };

  it("builds a schema that accepts a valid 3D entry", () => {
    const { knowledgeEntrySchema } = buildKnowledgeSchemas(threeD);
    expect(() => knowledgeEntrySchema.parse(validEntry3D)).not.toThrow();
  });

  it("rejects an entry with a dimension key not in the framework", () => {
    const { knowledgeEntrySchema } = buildKnowledgeSchemas(threeD);
    expect(() => knowledgeEntrySchema.parse({
      ...validEntry3D,
      dimensions: {
        ...validEntry3D.dimensions,
        delegation: { description: "d", example: "e", antipattern: "a" }, // not in 3D framework
      },
    })).toThrow();
  });

  it("rejects an entry with a collaboration step using a key not in the framework", () => {
    const { knowledgeEntrySchema } = buildKnowledgeSchemas(threeD);
    expect(() => knowledgeEntrySchema.parse({
      ...validEntry3D,
      collaboration: {
        ...validEntry3D.collaboration,
        sequence: [
          { step: 1, d: "delegation", label: "x", triggers_next: "y" }, // 4D key, not in 3D framework
          { step: 2, d: "plan",       label: "x", triggers_next: "y" },
        ],
      },
    })).toThrow();
  });

  it("returns memoised result for the same framework id", () => {
    const s1 = buildKnowledgeSchemas(threeD);
    const s2 = buildKnowledgeSchemas(threeD);
    expect(s1).toBe(s2); // referential equality (memoised)
  });
});
