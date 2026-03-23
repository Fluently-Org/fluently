// ── Framework types ────────────────────────────────────────────────────────────

export interface FrameworkDimension {
  key: string;
  label: string;
  description: string;
  canonical_order: number;
}

export interface FrameworkDefinition {
  id: string;
  name: string;
  version: string;
  contributor: string;
  description: string;
  dimensions: FrameworkDimension[];
  tags?: string[];
  reference?: string;
}

// ── D-cluster types (conversation sequence) ───────────────────────────────────

/** @deprecated Use string keys instead — retained for backward compat */
export type DimKey = "delegation" | "description" | "discernment" | "diligence";

export interface PromptCluster {
  step: number;
  d: string;
  label: string;
  example_prompts?: Array<{ speaker: "human" | "ai"; text: string }>;
  triggers_next: string;
  loop_back?: { to: string; condition: string; reason: string };
  can_restart?: boolean;
}

export interface Transition {
  from: string;
  to: string;
  trigger: string;
  is_loop_back?: boolean;
  is_cycle_restart?: boolean;
}

export interface Collaboration {
  /** Structural shape: linear | linear_with_loops | cyclic | iterative | branching */
  pattern: "linear" | "linear_with_loops" | "cyclic" | "iterative" | "branching";
  description: string;
  sequence: PromptCluster[];
  transitions: Transition[];
}

// ── Core knowledge types ───────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  /** The framework this entry belongs to. Defaults to "4d-framework" for legacy entries. */
  framework_id?: string;
  title: string;
  domain: string;
  tags: string[];
  contributor: string;
  version: string;
  summary?: string;
  /** Dimension values — keys are framework-specific dimension keys */
  dimensions: Record<string, { description: string; example: string; antipattern: string }>;
  /** Relative weights per dimension key (sum to 1.0) */
  score_hints?: Record<string, number>;
  /** Collaboration block: how the dimensions sequence as human↔AI conversation clusters */
  collaboration?: Collaboration;
}

export interface ContributionResult {
  success: boolean;
  message: string;
  url?: string;
  yaml?: string;
}

export interface KnowledgeConnector {
  readonly name: string;
  load(): Promise<KnowledgeEntry[]>;
  contribute(cycle: unknown): Promise<ContributionResult>;
  /** Optional: load all framework definitions from the knowledge source */
  loadFrameworks?(): Promise<FrameworkDefinition[]>;
}
