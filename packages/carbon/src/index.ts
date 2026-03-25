/**
 * fluently-carbon
 *
 * Zero-dependency CO₂ emission calculator for LLM token consumption.
 *
 * Architecture overview
 * ─────────────────────
 * EmissionsProvider  — interface every calculation method must implement.
 *                      Swap in any future source: EcoLogits API, provider-
 *                      disclosed figures, per-model SDK telemetry, etc.
 *
 * RateTableProvider  — default implementation backed by the EcoLogits
 *                      open model database (bottom-up hardware model, 2026-03).
 *                      Accepts a custom rate table so callers can supply
 *                      updated or provider-specific rates without subclassing.
 *
 * EmissionsRegistry  — holds named providers, picks the right one per call,
 *                      falls back to the registered default. Register a new
 *                      provider once; all downstream call sites pick it up.
 *
 * defaultRegistry    — module-level singleton, pre-loaded with RateTableProvider.
 *                      Most callers never touch it directly.
 *
 * calculateCO2 / CarbonSession / compareFrameworks
 *                    — convenience wrappers that accept an optional provider.
 *                      Omit the provider to use the global default.
 *
 * Source: https://ecologits.ai/latest/
 * License: MIT
 */

// ── Core types ────────────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";

export interface RateEntry {
  /** gCO₂eq per input token */
  inputRate: number;
  /** gCO₂eq per output token (generation costs ~5× more than prefill) */
  outputRate: number;
  confidence: Confidence;
  label: string;
}

export interface CarbonResult {
  /** Total CO₂ in gCO₂eq */
  totalCO2: number;
  /** Lower bound of ±uncertainty band */
  rangeMin: number;
  /** Upper bound of ±uncertainty band */
  rangeMax: number;
  /** gCO₂eq per 100,000 tokens — normalised for cross-model comparison */
  per100kTokens: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Model key as resolved by the provider */
  modelKey: string;
  confidence: Confidence;
  analogy: string;
  /** Which provider produced this result */
  providerId: string;
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
  providerId: string;
}

// ── EmissionsProvider interface ───────────────────────────────────────────────

/**
 * Contract every emissions calculation method must satisfy.
 *
 * Implementing a new provider:
 *   1. Create a class that implements EmissionsProvider.
 *   2. Return null from calculate() for models your provider cannot handle.
 *   3. Register it: defaultRegistry.register(new MyProvider(), true).
 *
 * Example future providers:
 *   - EcoLogitsAPIProvider   — fetches live rates from ecologits.ai
 *   - AnthropicSDKProvider   — uses Anthropic's usage API when/if disclosed
 *   - ProviderInsightProvider — per-org telemetry from an AI gateway
 *   - MeasuredProvider       — actual energy meter readings from a data centre
 */
export interface EmissionsProvider {
  /** Stable identifier used in results and registry lookups. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Data version or reference date, e.g. "2026-03". */
  readonly version: string;
  /** Canonical source URL for methodology / data. */
  readonly sourceUrl?: string;

  /**
   * Calculate CO₂ for a model call.
   * Return null if this provider cannot handle the given model
   * (e.g. model family not in database). The registry will fall
   * back to the next registered provider.
   */
  calculate(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): CarbonResult | null;
}

// ── EmissionsRegistry ─────────────────────────────────────────────────────────

/**
 * Registry of EmissionsProvider instances.
 *
 * Providers are tried in registration order. The first one that returns
 * a non-null result wins. If no provider handles the model, the default
 * provider is used as a final fallback.
 *
 * Usage:
 *   import { defaultRegistry } from "fluently-carbon";
 *   defaultRegistry.register(new MyProvider(), true); // set as new default
 */
export class EmissionsRegistry {
  private readonly _providers = new Map<string, EmissionsProvider>();
  private readonly _order: string[] = [];
  private _defaultId: string | null = null;

  /** Add a provider. Pass setAsDefault=true to make it the fallback. */
  register(provider: EmissionsProvider, setAsDefault = false): this {
    if (!this._providers.has(provider.id)) {
      this._order.push(provider.id);
    }
    this._providers.set(provider.id, provider);
    if (setAsDefault || this._defaultId === null) {
      this._defaultId = provider.id;
    }
    return this;
  }

  /** Remove a provider by id. Returns true if it existed. */
  unregister(id: string): boolean {
    const existed = this._providers.delete(id);
    if (existed) {
      const idx = this._order.indexOf(id);
      if (idx !== -1) this._order.splice(idx, 1);
      if (this._defaultId === id) {
        this._defaultId = this._order[0] ?? null;
      }
    }
    return existed;
  }

  /** Set the default provider (used as final fallback). */
  setDefault(id: string): void {
    if (!this._providers.has(id)) throw new Error(`Provider "${id}" is not registered`);
    this._defaultId = id;
  }

  get(id: string): EmissionsProvider | undefined {
    return this._providers.get(id);
  }

  getDefault(): EmissionsProvider | undefined {
    return this._defaultId ? this._providers.get(this._defaultId) : undefined;
  }

  /** All registered providers in registration order. */
  list(): EmissionsProvider[] {
    return this._order.map(id => this._providers.get(id)!);
  }

  /**
   * Calculate CO₂ using a specific provider (by id) or the default.
   * If no providerId is given, tries all providers in order, returns the
   * first non-null result, then falls back to the default provider.
   */
  calculate(
    model: string,
    inputTokens: number,
    outputTokens: number,
    providerId?: string,
  ): CarbonResult | null {
    if (inputTokens === 0 && outputTokens === 0) return null;

    if (providerId) {
      const p = this._providers.get(providerId);
      if (!p) throw new Error(`Provider "${providerId}" is not registered`);
      return p.calculate(model, inputTokens, outputTokens);
    }

    // Try in registration order; first hit wins
    for (const id of this._order) {
      const result = this._providers.get(id)!.calculate(model, inputTokens, outputTokens);
      if (result !== null) return result;
    }
    return null;
  }
}

// ── Shared utilities (provider-independent) ───────────────────────────────────

/**
 * Map a CO₂ value in gCO₂eq to a human-readable analogy.
 * Thresholds are chosen to give meaningful fractions of everyday activities.
 * This is presentation logic — independent of how the CO₂ was calculated.
 */
export function getAnalogy(gCO2: number): string {
  if (gCO2 <= 0)    return "0 gCO₂eq — no tokens consumed";
  if (gCO2 < 0.001) return "less than 0.01% of charging a smartphone";
  if (gCO2 < 0.03)  return `${((gCO2 / 3) * 100).toFixed(2)}% of a smartphone charge`;
  if (gCO2 < 0.1)   return `~${(gCO2 / 3).toFixed(3)} smartphone charges`;
  if (gCO2 < 1.5)   return `~${(gCO2 / 3).toFixed(2)} smartphone charges`;
  if (gCO2 < 10)    return `~${(gCO2 / 1.5).toFixed(1)} kettles boiled`;
  if (gCO2 < 100)   return `~${(gCO2 / 250).toFixed(4)} km in a petrol car`;
  return              `~${(gCO2 / 250).toFixed(2)} km in a petrol car`;
}

// ── RateTableProvider — default EcoLogits bottom-up implementation ────────────

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

export const RATE_TABLE_VERSION = "2026-03";

/**
 * Resolve a raw model string to a RATE_TABLE key.
 * Exported so custom providers or callers can reuse the matching logic.
 */
export function resolveModelKey(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("haiku"))         return "claude-haiku";
  if (m.includes("sonnet"))        return "claude-sonnet";
  if (m.includes("opus"))          return "claude-opus";
  if (m.includes("gpt-5-nano"))    return "gpt-5-nano";
  if (m.includes("gpt-5-mini"))    return "gpt-5-mini";
  if (m.includes("gpt-5"))         return "gpt-5.2";
  if (m.includes("gemini-flash"))  return "gemini-flash";
  if (m.includes("gemini"))        return "gemini-pro";
  if (m.includes("mistral-small")) return "mistral-small";
  if (m.includes("mistral"))       return "mistral-large";
  if (m.includes("deepseek"))      return "deepseek-v3";
  return "DEFAULT";
}

/**
 * EcoLogits bottom-up rate-table provider.
 *
 * Accepts a custom rateTable so callers can supply updated rates or
 * override specific models without subclassing:
 *   new RateTableProvider({ ...RATE_TABLE, "claude-sonnet": { ... } })
 */
export class RateTableProvider implements EmissionsProvider {
  readonly id      = "ecologits-rate-table";
  readonly name    = "EcoLogits Rate Table";
  readonly version = RATE_TABLE_VERSION;
  readonly sourceUrl = "https://ecologits.ai/latest/";

  private readonly table: Record<string, RateEntry>;

  constructor(rateTable: Record<string, RateEntry> = RATE_TABLE) {
    this.table = rateTable;
  }

  calculate(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): CarbonResult | null {
    if (inputTokens === 0 && outputTokens === 0) return null;

    const modelKey = resolveModelKey(model);
    const rates = this.table[modelKey] ?? this.table["DEFAULT"];
    if (!rates) return null;

    const totalCO2    = inputTokens * rates.inputRate + outputTokens * rates.outputRate;
    const totalTokens = inputTokens + outputTokens;

    return {
      totalCO2,
      rangeMin: totalCO2 * 0.60,
      rangeMax: totalCO2 * 1.40,
      per100kTokens: totalTokens > 0 ? (totalCO2 / totalTokens) * 100_000 : 0,
      totalTokens,
      inputTokens,
      outputTokens,
      modelKey,
      confidence: rates.confidence,
      analogy: getAnalogy(totalCO2),
      providerId: this.id,
    };
  }
}

// ── Framework token-reduction multipliers ─────────────────────────────────────

export const FRAMEWORK_REDUCTIONS: Record<string, { input: number; output: number }> = {
  "4d":       { input: 0.23, output: 0.38 },
  "linear":   { input: 0.15, output: 0.25 },
  "cyclic":   { input: 0.10, output: 0.20 },
  "baseline": { input: 0,    output: 0    },
};

// ── Module-level default registry ─────────────────────────────────────────────

/**
 * Global registry, pre-loaded with RateTableProvider as the default.
 * Register additional providers here to make them available to all
 * convenience functions without changing their call sites:
 *
 *   import { defaultRegistry } from "fluently-carbon";
 *   defaultRegistry.register(new AnthropicSDKProvider(), true);
 */
export const defaultRegistry = new EmissionsRegistry();
defaultRegistry.register(new RateTableProvider(), true);

// ── Convenience functions ─────────────────────────────────────────────────────

/**
 * Calculate CO₂ for a single LLM call.
 * Uses the global defaultRegistry unless a specific provider is passed.
 */
export function calculateCO2(
  model: string,
  inputTokens: number,
  outputTokens: number,
  provider?: EmissionsProvider,
): CarbonResult | null {
  if (provider) {
    if (inputTokens === 0 && outputTokens === 0) return null;
    return provider.calculate(model, inputTokens, outputTokens);
  }
  return defaultRegistry.calculate(model, inputTokens, outputTokens);
}

/**
 * Accumulates CO₂ estimates across multiple LLM calls in a session.
 * Pass a provider to use non-default calculation for the whole session.
 */
export class CarbonSession {
  private _totalCO2   = 0;
  private _totalInput  = 0;
  private _totalOutput = 0;
  private readonly model: string;
  private readonly provider: EmissionsProvider | undefined;

  constructor(model: string, provider?: EmissionsProvider) {
    this.model    = model;
    this.provider = provider;
  }

  add(inputTokens: number, outputTokens: number): CarbonResult | null {
    const result = calculateCO2(this.model, inputTokens, outputTokens, this.provider);
    if (result) {
      this._totalCO2    += result.totalCO2;
      this._totalInput  += inputTokens;
      this._totalOutput += outputTokens;
    }
    return result;
  }

  getTotal(): CarbonResult | null {
    return calculateCO2(this.model, this._totalInput, this._totalOutput, this.provider);
  }

  reset(): void {
    this._totalCO2   = 0;
    this._totalInput  = 0;
    this._totalOutput = 0;
  }

  get inputTokens():  number { return this._totalInput; }
  get outputTokens(): number { return this._totalOutput; }
  get sessionCO2():   number { return this._totalCO2; }
}

/**
 * Compare CO₂ efficiency across multiple framework runs on the same task.
 * Pass a provider to use non-default calculation for the whole comparison.
 */
export function compareFrameworks(
  model: string,
  runs: FrameworkRun[],
  provider?: EmissionsProvider,
): ComparisonResult {
  if (runs.length === 0) throw new Error("compareFrameworks: at least one run required");

  const activeProvider = provider ?? defaultRegistry.getDefault();
  const providerId = activeProvider?.id ?? "unknown";

  const nullResult = (): CarbonResult => ({
    totalCO2: 0, rangeMin: 0, rangeMax: 0, per100kTokens: 0,
    totalTokens: 0, inputTokens: 0, outputTokens: 0,
    modelKey: resolveModelKey(model), confidence: "low",
    analogy: "0 gCO₂eq — no tokens consumed",
    providerId,
  });

  const compared: ComparedRun[] = runs.map(run => ({
    ...run,
    result: calculateCO2(model, run.inputTokens, run.outputTokens, provider) ?? nullResult(),
    savingPct: 0,
  }));

  const nullRun = compared.find(r => r.framework === null);
  const baseline = nullRun ?? compared.reduce((max, r) =>
    r.result.per100kTokens > max.result.per100kTokens ? r : max, compared[0]);

  compared.forEach(r => {
    r.savingPct = baseline.result.per100kTokens > 0
      ? Math.round((1 - r.result.per100kTokens / baseline.result.per100kTokens) * 100)
      : 0;
  });

  const sorted = [...compared].sort(
    (a, b) => a.result.per100kTokens - b.result.per100kTokens,
  );

  return { runs: sorted, baseline, mostEfficient: sorted[0], model, providerId };
}
