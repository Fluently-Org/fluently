export { loadKnowledgeEntries, scoreTask } from "./engine.js";
export type { TaskInput } from "./engine.js";
export { knowledgeEntrySchema, domainEnum, dimensionSchema } from "./schema.js";
export {
  frameworkDefinitionSchema,
  frameworkDimensionSchema,
  buildKnowledgeSchemas,
  BUNDLED_4D_FRAMEWORK,
} from "./schema.js";
export type { FrameworkDefinition, FrameworkDimension, DimensionValue } from "./schema.js";
export { checkPrivacy } from "./privacy.js";
export type { PrivacyCheckResult, PrivacyIssue, PrivacyCheckOptions } from "./privacy.js";
