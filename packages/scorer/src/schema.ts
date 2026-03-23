import { z } from "zod";

export const domainEnum = z.enum([
  "coding",
  "writing",
  "research",
  "customer-support",
  "education",
  "legal",
  "healthcare",
  "general"
]);

export const dEnum = z.enum(["delegation", "description", "discernment", "diligence"]);

export const dimensionSchema = z.object({
  description: z.string(),
  example: z.string(),
  antipattern: z.string()
});

// ── Collaboration sequence schema ────────────────────────────────────────────
// Each step in the sequence is a cluster of prompts classified as one of the 4Ds.
// The cluster captures what kind of conversation is happening between human and AI,
// example prompts, what triggers the transition to the next cluster, and any
// loop-back conditions that send the conversation back to an earlier D.

export const promptClusterSchema = z.object({
  step: z.number().int().positive(),
  d: dEnum,
  label: z.string(),
  // Representative example of the human↔AI prompt exchange in this cluster
  example_prompts: z.array(z.object({
    speaker: z.enum(["human", "ai"]),
    text: z.string(),
  })).optional(),
  triggers_next: z.string(),
  // If poor quality at this step, where does the conversation loop back?
  loop_back: z.object({
    to: dEnum,
    condition: z.string(),
    reason: z.string(),
  }).optional(),
  // True when this step can restart the entire cycle (usually the last Dil step)
  can_restart: z.boolean().optional(),
});

export const transitionSchema = z.object({
  from: dEnum,
  to: dEnum,
  trigger: z.string(),
  is_loop_back: z.boolean().optional(),
  is_cycle_restart: z.boolean().optional(),
});

export const collaborationSchema = z.object({
  // The structural shape of how Ds sequence in this cycle
  pattern: z.enum(["linear", "linear_with_loops", "cyclic", "iterative", "branching"]),
  // Human-readable explanation of the collaboration shape
  description: z.string(),
  // Ordered D-clusters that make up this collaboration pattern
  sequence: z.array(promptClusterSchema).min(2),
  // Explicit transitions between clusters (including loop-backs)
  transitions: z.array(transitionSchema).min(1),
});

export const knowledgeEntrySchema = z.object({
  id: z.string(), // slug
  title: z.string(),
  domain: domainEnum,
  dimensions: z.object({
    delegation: dimensionSchema,
    description: dimensionSchema,
    discernment: dimensionSchema,
    diligence: dimensionSchema
  }),
  score_hints: z.object({
    delegation: z.number().min(0).max(1),
    description: z.number().min(0).max(1),
    discernment: z.number().min(0).max(1),
    diligence: z.number().min(0).max(1)
  }).refine(obj => Math.abs(Object.values(obj).reduce((a, b) => a + b, 0) - 1) < 1e-9, {
    message: "Dimension weights must sum to 1"
  }),
  tags: z.array(z.string()),
  contributor: z.string(),
  reference: z.string().optional(),
  version: z.string(), // semver
  // Required — collaboration block captures how the 4Ds flow as conversation clusters
  collaboration: collaborationSchema,
});
