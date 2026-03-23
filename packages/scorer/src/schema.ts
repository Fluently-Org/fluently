import { z } from "zod";
import {
  BUNDLED_4D_FRAMEWORK,
  buildKnowledgeSchemas,
  frameworkDefinitionSchema,
  frameworkDimensionSchema,
} from "./framework-schema.js";

export {
  frameworkDefinitionSchema,
  frameworkDimensionSchema,
  buildKnowledgeSchemas,
  BUNDLED_4D_FRAMEWORK,
} from "./framework-schema.js";

export type {
  FrameworkDefinition,
  FrameworkDimension,
  DimensionValue,
  DimensionCombination,
  BestPractice,
  EvaluationCriterion,
} from "./framework-schema.js";

// ── Legacy 4D-specific exports (backward compatible) ─────────────────────────
// These remain the same shape for any existing code that imports them directly.

export const domainEnum = z.enum([
  "coding", "writing", "research", "customer-support",
  "education", "legal", "healthcare", "general",
]);

export const dEnum = z.enum(["delegation", "description", "discernment", "diligence"]);

export const dimensionSchema = z.object({
  description: z.string(),
  example: z.string(),
  antipattern: z.string(),
});

// Build schemas from the bundled 4D framework
const _4dSchemas = buildKnowledgeSchemas(BUNDLED_4D_FRAMEWORK);

// Re-export the 4D-specific schemas as named exports (backward compat)
export const promptClusterSchema = _4dSchemas.promptClusterSchema;
export const transitionSchema = _4dSchemas.transitionSchema;
export const collaborationSchema = _4dSchemas.collaborationSchema;

// The main schema — backward compat, framework_id defaults to "4d-framework"
export const knowledgeEntrySchema = _4dSchemas.knowledgeEntrySchema;
