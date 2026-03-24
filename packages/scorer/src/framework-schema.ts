import { z } from "zod";

// ── Sub-schemas for framework standards ───────────────────────────────────────

/**
 * A named relationship between two or more dimensions.
 * type: "synergy"     — dimensions amplify each other; weak one limits the other
 *       "prerequisite"— left dimension must be done before right dimension is meaningful
 *       "tension"     — increasing one dimension naturally reduces the other
 */
export const dimensionCombinationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Combination id must be kebab-case"),
  dimensions: z.array(z.string()).min(2),
  type: z.enum(["synergy", "prerequisite", "tension"]),
  label: z.string(),
  description: z.string(),
  guidance: z.string(),
});

/** An actionable recommendation for applying the framework well. */
export const bestPracticeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Best practice id must be kebab-case"),
  title: z.string(),
  /** Dimension this practice primarily addresses; omit for framework-level practices. */
  dimension: z.string().optional(),
  description: z.string(),
  antipattern: z.string().optional(),
  /** Observable signal that this practice is being followed (natural language). */
  signal: z.string().optional(),
});

/**
 * A machine-checkable criterion for evaluating whether a dimension was followed.
 * The scorer looks for `signals.present` keywords in the collaboration text.
 */
export const evaluationCriterionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Criterion id must be kebab-case"),
  /** Dimension this criterion evaluates; omit for framework-level criteria. */
  dimension: z.string().optional(),
  label: z.string(),
  description: z.string(),
  /** Contribution to the overall compliance score (all weights should sum to 1). */
  weight: z.number().min(0).max(1),
  signals: z.object({
    /** Keywords whose presence indicates compliance. */
    present: z.array(z.string()),
    /** Keywords whose presence indicates a violation (optional). */
    absent: z.array(z.string()).optional(),
  }).optional(),
  /** Minimum number of `signals.present` keywords required to pass (default 1). */
  pass_threshold: z.number().int().nonnegative().optional(),
});

export type DimensionCombination = z.infer<typeof dimensionCombinationSchema>;
export type BestPractice         = z.infer<typeof bestPracticeSchema>;
export type EvaluationCriterion  = z.infer<typeof evaluationCriterionSchema>;

// ── Core framework schemas ─────────────────────────────────────────────────────

export const frameworkDimensionSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/, "Dimension key must be kebab-case"),
  label: z.string(),
  description: z.string(),
  canonical_order: z.number().int().positive(),
});

export const frameworkDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Framework id must be kebab-case"),
  name: z.string(),
  version: z.string(),
  contributor: z.string(),
  description: z.string(),
  dimensions: z.array(frameworkDimensionSchema).min(1).refine(
    dims => new Set(dims.map(d => d.key)).size === dims.length,
    { message: "Dimension keys must be unique within a framework" }
  ),
  tags: z.array(z.string()).optional(),
  reference: z.string().optional(),
  /** How dimensions interact — synergies, prerequisites, and tensions. */
  dimension_combinations: z.array(dimensionCombinationSchema).optional(),
  /** Actionable recommendations for applying this framework well. */
  best_practices: z.array(bestPracticeSchema).optional(),
  /**
   * Machine-checkable criteria for evaluating compliance.
   * Weights should sum to 1 across all criteria for meaningful percentage scores.
   */
  evaluation_criteria: z.array(evaluationCriterionSchema).optional(),
});

export type FrameworkDimension = z.infer<typeof frameworkDimensionSchema>;
export type FrameworkDefinition = z.infer<typeof frameworkDefinitionSchema>;

/** Shape of a single dimension value inside a knowledge entry */
export type DimensionValue = {
  description: string;
  example: string;
  antipattern: string;
};

// The bundled 4D Framework definition
export const BUNDLED_4D_FRAMEWORK: FrameworkDefinition = {
  id: "4d-framework",
  name: "AI Fluency 4D Framework",
  version: "1.0.0",
  contributor: "Dakan & Feller",
  description: "Four dimensions of good human-AI collaboration: Delegation, Description, Discernment, and Diligence.",
  dimensions: [
    { key: "delegation",  label: "Delegation",  description: "Who owns the decision — human, AI, or both? What level of autonomy is appropriate?", canonical_order: 1 },
    { key: "description", label: "Description", description: "How should the task be framed so AI understands context fully?", canonical_order: 2 },
    { key: "discernment", label: "Discernment", description: "How do you evaluate whether the AI output is trustworthy? When do you push back?", canonical_order: 3 },
    { key: "diligence",   label: "Diligence",   description: "What human accountability is required after AI is involved? Who signs off?", canonical_order: 4 },
  ],
  tags: ["human-ai-collaboration", "ai-fluency", "4d"],
};

// Memoised schema cache keyed by framework id.
// Typed as `any` to avoid a circular self-reference (ReturnType<typeof buildKnowledgeSchemas>
// would reference the function that stores into this map, confusing the TS checker).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schemaCache = new Map<string, any>();

/**
 * Build Zod schemas for a specific framework.
 * The returned schemas validate knowledge entries against the framework's dimension keys.
 * Results are memoised by framework id.
 */
export function buildKnowledgeSchemas(framework: FrameworkDefinition) {
  if (schemaCache.has(framework.id)) return schemaCache.get(framework.id)!;

  const keys = framework.dimensions.map(d => d.key) as [string, ...string[]];
  const dimKeyEnum = z.enum(keys);

  const dimensionValueSchema = z.object({
    description: z.string(),
    example: z.string(),
    antipattern: z.string(),
  });

  const promptClusterSchema = z.object({
    step: z.number().int().positive(),
    d: dimKeyEnum,
    label: z.string(),
    example_prompts: z.array(z.object({
      speaker: z.enum(["human", "ai"]),
      text: z.string(),
    })).optional(),
    triggers_next: z.string(),
    loop_back: z.object({
      to: dimKeyEnum,
      condition: z.string(),
      reason: z.string(),
    }).optional(),
    can_restart: z.boolean().optional(),
  });

  const transitionSchema = z.object({
    from: dimKeyEnum,
    to: dimKeyEnum,
    trigger: z.string(),
    is_loop_back: z.boolean().optional(),
    is_cycle_restart: z.boolean().optional(),
  });

  const collaborationSchema = z.object({
    pattern: z.enum(["linear", "linear_with_loops", "cyclic", "iterative", "branching"]),
    description: z.string(),
    sequence: z.array(promptClusterSchema).min(2),
    transitions: z.array(transitionSchema).min(1),
  });

  const domainEnum = z.enum([
    "coding", "writing", "research", "customer-support",
    "education", "legal", "healthcare", "general",
  ]);

  const knowledgeEntrySchema = z.object({
    id: z.string(),
    framework_id: z.string().default(framework.id),
    title: z.string(),
    domain: domainEnum,
    dimensions: z.record(dimKeyEnum, dimensionValueSchema).superRefine((dims, ctx) => {
      for (const key of keys) {
        if (!(key in dims)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing required dimension: ${key}` });
        }
      }
    }),
    score_hints: z.record(dimKeyEnum, z.number().min(0).max(1)).refine(
      obj => Math.abs(Object.values(obj).reduce((a: number, b: number) => a + b, 0) - 1) < 1e-9,
      { message: "Dimension weights must sum to 1" }
    ),
    tags: z.array(z.string()),
    contributor: z.string(),
    reference: z.string().optional(),
    version: z.string(),
    collaboration: collaborationSchema,
  });

  const schemas = { knowledgeEntrySchema, collaborationSchema, promptClusterSchema, transitionSchema };
  schemaCache.set(framework.id, schemas);
  return schemas;
}
