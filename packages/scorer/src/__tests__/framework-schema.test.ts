import { describe, it, expect } from "vitest";
import {
  frameworkDefinitionSchema,
  dimensionCombinationSchema,
  bestPracticeSchema,
  evaluationCriterionSchema,
  buildKnowledgeSchemas,
  BUNDLED_4D_FRAMEWORK,
} from "../framework-schema.js";
import { evaluateCompliance } from "../engine.js";

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
        { key: "delegation", label: "B", description: "b", canonical_order: 2 },
      ],
    })).toThrow();
  });

  it("rejects framework with non-kebab-case id", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "My Framework",
    })).toThrow();
  });

  it("rejects framework with zero dimensions", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "empty",
      dimensions: [],
    })).toThrow();
  });

  it("accepts a framework with dimension_combinations", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "with-combos",
      dimension_combinations: [
        {
          id: "del-des-synergy",
          dimensions: ["delegation", "description"],
          type: "synergy",
          label: "Test synergy",
          description: "Test",
          guidance: "Test guidance",
        },
      ],
    })).not.toThrow();
  });

  it("accepts a framework with best_practices", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "with-practices",
      best_practices: [
        {
          id: "bp-test",
          title: "Test practice",
          dimension: "delegation",
          description: "Test description",
          antipattern: "Test antipattern",
          signal: "Test signal",
        },
      ],
    })).not.toThrow();
  });

  it("accepts a framework with evaluation_criteria", () => {
    expect(() => frameworkDefinitionSchema.parse({
      ...BUNDLED_4D_FRAMEWORK,
      id: "with-criteria",
      evaluation_criteria: [
        {
          id: "eval-test",
          dimension: "delegation",
          label: "Test criterion",
          description: "Test",
          weight: 1.0,
          signals: { present: ["automated", "supervised"] },
          pass_threshold: 1,
        },
      ],
    })).not.toThrow();
  });

  it("rejects a combination with a non-kebab-case id", () => {
    expect(() => dimensionCombinationSchema.parse({
      id: "Bad Id",
      dimensions: ["a", "b"],
      type: "synergy",
      label: "x",
      description: "x",
      guidance: "x",
    })).toThrow();
  });

  it("rejects a combination with fewer than 2 dimensions", () => {
    expect(() => dimensionCombinationSchema.parse({
      id: "solo",
      dimensions: ["only-one"],
      type: "synergy",
      label: "x",
      description: "x",
      guidance: "x",
    })).toThrow();
  });

  it("rejects a combination with an invalid type", () => {
    expect(() => dimensionCombinationSchema.parse({
      id: "bad-type",
      dimensions: ["a", "b"],
      type: "conflict",  // not valid
      label: "x",
      description: "x",
      guidance: "x",
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
        delegation: { description: "d", example: "e", antipattern: "a" },
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
          { step: 1, d: "delegation", label: "x", triggers_next: "y" },
          { step: 2, d: "plan",       label: "x", triggers_next: "y" },
        ],
      },
    })).toThrow();
  });

  it("returns memoised result for the same framework id", () => {
    const s1 = buildKnowledgeSchemas(threeD);
    const s2 = buildKnowledgeSchemas(threeD);
    expect(s1).toBe(s2);
  });
});

describe("evaluateCompliance", () => {
  const frameworkWithCriteria = {
    ...BUNDLED_4D_FRAMEWORK,
    id: "eval-test-fw",
    evaluation_criteria: [
      {
        id: "eval-del",
        dimension: "delegation",
        label: "Delegation is explicit",
        description: "Must mention autonomy level",
        weight: 0.5,
        signals: { present: ["automated", "augmented", "supervised"] },
        pass_threshold: 1,
      },
      {
        id: "eval-des",
        dimension: "description",
        label: "Description has constraints",
        description: "Must include constraints",
        weight: 0.5,
        signals: { present: ["constraint", "requirement", "must be", "goal"] },
        pass_threshold: 2,
      },
    ],
  };

  it("returns score 0 when framework has no evaluation_criteria", () => {
    const fw = { ...BUNDLED_4D_FRAMEWORK, id: "no-criteria-fw", evaluation_criteria: undefined };
    const result = evaluateCompliance("any text", fw);
    expect(result.score).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it("returns 100 when all criteria pass", () => {
    const text = "We use augmented delegation. The goal is to meet the constraint that must be satisfied.";
    const result = evaluateCompliance(text, frameworkWithCriteria);
    expect(result.score).toBe(100);
    expect(result.passed).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
  });

  it("returns 0 when no criteria pass", () => {
    const text = "We need to do something with AI.";
    const result = evaluateCompliance(text, frameworkWithCriteria);
    expect(result.score).toBe(0);
    expect(result.failed).toHaveLength(2);
  });

  it("returns partial score when only some criteria pass", () => {
    // Only delegation passes (weight 0.5)
    const text = "We use supervised mode for this task.";
    const result = evaluateCompliance(text, frameworkWithCriteria);
    expect(result.score).toBe(50);
    expect(result.passed).toContain("Delegation is explicit");
    expect(result.failed).toContain("Description has constraints");
  });

  it("includes matched_signals in details", () => {
    const text = "This is an augmented workflow with a clear goal and constraint.";
    const result = evaluateCompliance(text, frameworkWithCriteria);
    const delDetail = result.details.find(d => d.id === "eval-del");
    expect(delDetail?.matched_signals).toContain("augmented");
  });

  it("respects pass_threshold > 1", () => {
    // Description criterion requires 2 signals; only 1 present
    const text = "We use augmented mode. The goal is clear.";
    const result = evaluateCompliance(text, frameworkWithCriteria);
    const desDetail = result.details.find(d => d.id === "eval-des");
    expect(desDetail?.passed).toBe(false);
  });

  it("is case-insensitive for signal matching", () => {
    const text = "AUTOMATED pipeline with CONSTRAINT and GOAL defined.";
    const result = evaluateCompliance(text, frameworkWithCriteria);
    expect(result.score).toBe(100);
  });
});
