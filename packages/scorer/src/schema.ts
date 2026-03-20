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

export const dimensionSchema = z.object({
  description: z.string(),
  example: z.string(),
  antipattern: z.string()
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
  version: z.string() // semver
});
