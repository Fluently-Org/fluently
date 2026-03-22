// ── D-cluster types (conversation sequence) ───────────────────────────────────

export type DimKey = "delegation" | "description" | "discernment" | "diligence";

export interface PromptCluster {
  step: number;
  d: DimKey;
  label: string;
  example_prompts?: Array<{ speaker: "human" | "ai"; text: string }>;
  triggers_next: string;
  loop_back?: { to: DimKey; condition: string; reason: string };
  can_restart?: boolean;
}

export interface Transition {
  from: DimKey;
  to: DimKey;
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
  title: string;
  domain: string;
  tags: string[];
  contributor: string;
  version: string;
  summary?: string;
  dimensions: {
    delegation:  { description: string; example: string; antipattern: string };
    description: { description: string; example: string; antipattern: string };
    discernment: { description: string; example: string; antipattern: string };
    diligence:   { description: string; example: string; antipattern: string };
  };
  score_hints?: {
    delegation: number;
    description: number;
    discernment: number;
    diligence: number;
  };
  /** Collaboration block: how the 4Ds sequence as human↔AI conversation clusters */
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
}
