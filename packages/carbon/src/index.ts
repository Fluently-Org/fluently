/**
 * fluently-carbon
 *
 * Zero-dependency CO₂ emission calculator for LLM token consumption.
 * Implements the Fluently Carbon RATE_TABLE (EcoLogits methodology, 2026-03).
 *
 * All calculations are pure arithmetic — no API calls, no external libraries.
 * Confidence bands reflect the uncertainty in bottom-up energy modelling.
 *
 * Source: https://ecologits.ai/latest/
 * License: MIT
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";

export interface RateEntry {
  /** gCO₂eq per input token */
  inputRate: number;
  /** gCO₂eq per output token */
  outputRate: number;
  confidence: Confidence;
  label: string;
}

export interface CarbonResult {
  /** Total CO₂ in gCO₂eq */
  totalCO2: number;
  /** Lower bound (−40%) */
  rangeMin: number;
  /** Upper bound (+40%) */
  rangeMax: number;
  /** gCO₂eq per 100,000 tokens */
  per100kTokens: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  modelKey: string;
  confidence: Confidence;
  analogy: string;
}

export interface FrameworkRun {
  label: string;
  framework: string | null;
  inputTokens: number;
  outputTokens: number;
}

export interface ComparedRun extends FrameworkRun {
  result: CarbonResult;
  /** Percentage saved vs baseline (0 for baseline itself) */
  savingPct: number;
}

export interface ComparisonResult {
  runs: ComparedRun[];
  baseline: ComparedRun;
  mostEfficient: ComparedRun;
  model: string;
}

// ── Rate table — RATE_TABLE 2026-03 ──────────────────────────────────────────

/** gCO₂eq per token. Source: EcoLogits open model database, 2026-03. */
export const RATE_TABLE: Record<string, RateEntry> = {
  "claude-haiku":  { inputRate: 0.000004, outputRate: 0.000020, confidence: "medium", label: "Claude Haiku"  },
  "claude-sonnet": { inputRate: 0.000012, outputRate: 0.000060, confidence: "medium", label: "Claude Sonnet" },
  "claude-opus":   { inputRate: 0.000040, outputRate: 0.000200, confidence: "medium", label: "Claude Opus"   },
  "gpt-5-nano":    { inputRate: 0.000002, outputRate: 0.000010, confidence: "medium", label: "GPT-5 nano"    },
  "gpt-5-mini":    { inputRate: 0.000005, outputRate: 0.000025, confidence: "medium", label: "GPT-5 mini"    },
  "gpt-5.2":       { inputRate: 0.000035, outputRate: 0.000175, confidence: "medium", label: "GPT-5.2"       },
  "gemini-flash":  { inputRate: 0.000001, outputRate: 0.000005, confidence: "high",   label: "Gemini Flash"  },
  "gemini-pro":    { inputRate: 0.000010, outputRate: 0.000050, confidence: "high",   label: "Gemini Pro"    },
  "mistral-small": { inputRate: 0.000005, outputRate: 0.000025, confidence: "medium", label: "Mistral Small" },
  "mistral-large": { inputRate: 0.000020, outputRate: 0.000100, confidence: "medium", label: "Mistral Large" },
  "deepseek-v3":   { inputRate: 0.000050, outputRate: 0.000250, confidence: "low",    label: "DeepSeek V3"   },
  "DEFAULT":       { inputRate: 0.000012, outputRate: 0.000060, confidence: "low",    label: "Unknown model" },
};

/** RATE_TABLE version string — use for cache invalidation and citations. */
export const RATE_TABLE_VERSION = "2026-03";

// ── Framework token-reduction multipliers ─────────────────────────────────────

/**
 * Expected token reduction vs baseline when using a Fluently framework.
 * Based on the Fluently 3-task benchmark (March 2026).
 * Input tokens reduce less than output tokens (scoping helps output most).
 */
export const FRAMEWORK_REDUCTIONS: Record<string, { input: number; output: number }> = {
  "4d":      { input: 0.23, output: 0.38 },
  "linear":  { input: 0.15, output: 0.25 },
  "cyclic":  { input: 0.10, output: 0.20 },
  "baseline": { input: 0,   output: 0    },
};

// ── Model key resolution ──────────────────────────────────────────────────────

/**
 * Resolve a model identifier string to a RATE_TABLE key.
 * Uses substring matching in priority order (specific before general).
 * Returns "DEFAULT" if no match found.
 */
export function resolveModelKey(model: string): string {
  const m = model.toLowerCase();
  // Specific matches must precede general ones
  if (m.includes("haiku"))          return "claude-haiku";
  if (m.includes("sonnet"))         return "claude-sonnet";
  if (m.includes("opus"))           return "claude-opus";
  if (m.includes("gpt-5-nano"))     return "gpt-5-nano";
  if (m.includes("gpt-5-mini"))     return "gpt-5-mini";
  if (m.includes("gpt-5"))          return "gpt-5.2";
  if (m.includes("gemini-flash"))   return "gemini-flash";
  if (m.includes("gemini"))         return "gemini-pro";
  if (m.includes("mistral-small"))  return "mistral-small";
  if (m.includes("mistral"))        return "mistral-large";
  if (m.includes("deepseek"))       return "deepseek-v3";
  return "DEFAULT";
}

// ── Analogy lookup ────────────────────────────────────────────────────────────

/**
 * Map a CO₂ value in gCO₂eq to a human-readable analogy.
 * Thresholds are chosen to give meaningful fractions of everyday activities.
 */
export function getAnalogy(gCO2: number): string {
  if (gCO2 <= 0)     return "0 gCO₂eq — no tokens consumed";
  if (gCO2 < 0.001)  return "less than 0.01% of charging a smartphone";
  if (gCO2 < 0.03)   return `${((gCO2 / 3) * 100).toFixed(2)}% of a smartphone charge`;
  if (gCO2 < 0.1)    return `~${(gCO2 / 3).toFixed(3)} smartphone charges`;
  if (gCO2 < 1.5)    return `~${(gCO2 / 3).toFixed(2)} smartphone charges`;
  if (gCO2 < 10)     return `~${(gCO2 / 1.5).toFixed(1)} kettles boiled`;
  if (gCO2 < 100)    return `~${(gCO2 / 250).toFixed(4)} km in a petrol car`;
  return               `~${(gCO2 / 250).toFixed(2)} km in a petrol car`;
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Calculate CO₂ emissions for a single LLM call.
 * Returns null if both token counts are 0.
 */
export function calculateCO2(
  model: string,
  inputTokens: number,
  outputTokens: number,
): CarbonResult | null {
  if (inputTokens === 0 && outputTokens === 0) return null;

  const modelKey = resolveModelKey(model);
  const rates = RATE_TABLE[modelKey];

  const inputCO2  = inputTokens  * rates.inputRate;
  const outputCO2 = outputTokens * rates.outputRate;
  const totalCO2  = inputCO2 + outputCO2;
  const totalTokens = inputTokens + outputTokens;
  const per100kTokens = totalTokens > 0 ? (totalCO2 / totalTokens) * 100_000 : 0;

  return {
    totalCO2,
    rangeMin: totalCO2 * 0.60,
    rangeMax: totalCO2 * 1.40,
    per100kTokens,
    totalTokens,
    inputTokens,
    outputTokens,
    modelKey,
    confidence: rates.confidence,
    analogy: getAnalogy(totalCO2),
  };
}

// ── Session accumulator ───────────────────────────────────────────────────────

/**
 * Accumulates CO₂ estimates across multiple LLM calls in a session.
 * Call `add()` after each call, `getTotal()` to report at any point.
 */
export class CarbonSession {
  private totalCO2   = 0;
  private totalInput  = 0;
  private totalOutput = 0;
  private readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  add(inputTokens: number, outputTokens: number): CarbonResult | null {
    const result = calculateCO2(this.model, inputTokens, outputTokens);
    if (result) {
      this.totalCO2    += result.totalCO2;
      this.totalInput  += inputTokens;
      this.totalOutput += outputTokens;
    }
    return result;
  }

  getTotal(): CarbonResult | null {
    return calculateCO2(this.model, this.totalInput, this.totalOutput);
  }

  reset(): void {
    this.totalCO2   = 0;
    this.totalInput  = 0;
    this.totalOutput = 0;
  }

  get inputTokens():  number { return this.totalInput; }
  get outputTokens(): number { return this.totalOutput; }
  get sessionCO2():   number { return this.totalCO2; }
}

// ── Framework comparison ──────────────────────────────────────────────────────

/**
 * Compare CO₂ efficiency across multiple framework runs on the same task.
 * The baseline is the run with `framework: null`, or the highest per-100k run
 * if all runs have a framework specified.
 *
 * Runs are sorted ascending by per100kTokens (most efficient first).
 */
export function compareFrameworks(
  model: string,
  runs: FrameworkRun[],
): ComparisonResult {
  if (runs.length === 0) throw new Error("compareFrameworks: at least one run required");

  const compared: ComparedRun[] = runs.map(run => ({
    ...run,
    result: calculateCO2(model, run.inputTokens, run.outputTokens) ?? {
      totalCO2: 0, rangeMin: 0, rangeMax: 0, per100kTokens: 0,
      totalTokens: 0, inputTokens: 0, outputTokens: 0,
      modelKey: resolveModelKey(model), confidence: "low" as Confidence,
      analogy: "0 gCO₂eq — no tokens consumed",
    },
    savingPct: 0,
  }));

  // Identify baseline: null-framework run, or highest per100k
  const nullRun = compared.find(r => r.framework === null);
  const baseline = nullRun ?? compared.reduce((max, r) =>
    r.result.per100kTokens > max.result.per100kTokens ? r : max, compared[0]);

  // Compute savings relative to baseline
  compared.forEach(r => {
    r.savingPct = baseline.result.per100kTokens > 0
      ? Math.round((1 - r.result.per100kTokens / baseline.result.per100kTokens) * 100)
      : 0;
  });

  // Sort ascending by per100kTokens (most efficient first)
  const sorted = [...compared].sort(
    (a, b) => a.result.per100kTokens - b.result.per100kTokens,
  );

  return {
    runs: sorted,
    baseline,
    mostEfficient: sorted[0],
    model,
  };
}
