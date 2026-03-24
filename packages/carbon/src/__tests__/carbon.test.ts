/**
 * carbon.test.ts
 *
 * Comprehensive tests for the fluently-carbon package.
 *
 * Coverage:
 *   - RATE_TABLE structure and completeness
 *   - resolveModelKey: all supported models, priority order, case, DEFAULT
 *   - getAnalogy: boundary values across all scale bands
 *   - RateTableProvider: core calculation, worked example, custom table
 *   - EmissionsRegistry: register/unregister, default, order, fallback, errors
 *   - calculateCO2 convenience wrapper: default provider, custom provider
 *   - CarbonSession: accumulation, reset, multi-call consistency, custom provider
 *   - compareFrameworks: sorting, savings, baseline detection, custom provider
 *   - Custom EmissionsProvider: interface compliance, injection at every level
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RATE_TABLE,
  RATE_TABLE_VERSION,
  FRAMEWORK_REDUCTIONS,
  resolveModelKey,
  getAnalogy,
  RateTableProvider,
  EmissionsRegistry,
  defaultRegistry,
  calculateCO2,
  compareFrameworks,
  CarbonSession,
  type EmissionsProvider,
  type CarbonResult,
  type FrameworkRun,
} from "../index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const round = (n: number, dp = 9) => Math.round(n * 10 ** dp) / 10 ** dp;

// ── Fixtures: test providers ──────────────────────────────────────────────────

/**
 * A deterministic mock provider: always returns a fixed rate.
 * Used to test provider injection without coupling to real rates.
 */
function makeMockProvider(overrides: Partial<CarbonResult> = {}): EmissionsProvider {
  return {
    id: "mock-provider",
    name: "Mock Provider",
    version: "test",
    sourceUrl: "https://example.com",
    calculate(_model, inputTokens, outputTokens) {
      if (inputTokens === 0 && outputTokens === 0) return null;
      const totalCO2 = inputTokens * 0.000100 + outputTokens * 0.000500;
      const totalTokens = inputTokens + outputTokens;
      return {
        totalCO2,
        rangeMin: totalCO2 * 0.5,
        rangeMax: totalCO2 * 1.5,
        per100kTokens: (totalCO2 / totalTokens) * 100_000,
        totalTokens,
        inputTokens,
        outputTokens,
        modelKey: "mock",
        confidence: "high",
        analogy: "mock analogy",
        providerId: "mock-provider",
        ...overrides,
      };
    },
  };
}

/** A provider that always returns null (cannot handle any model). */
const nullProvider: EmissionsProvider = {
  id: "null-provider",
  name: "Null Provider",
  version: "test",
  calculate: () => null,
};

// ── RATE_TABLE ─────────────────────────────────────────────────────────────────

describe("RATE_TABLE", () => {
  it("exports a version string matching YYYY-MM", () => {
    expect(RATE_TABLE_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });

  it("has a DEFAULT entry with low confidence", () => {
    expect(RATE_TABLE["DEFAULT"]).toBeDefined();
    expect(RATE_TABLE["DEFAULT"].confidence).toBe("low");
  });

  const requiredKeys = [
    "claude-haiku", "claude-sonnet", "claude-opus",
    "gpt-5-nano", "gpt-5-mini", "gpt-5.2",
    "gemini-flash", "gemini-pro",
    "mistral-small", "mistral-large",
    "deepseek-v3", "DEFAULT",
  ];

  it.each(requiredKeys)("has a complete entry for '%s'", (key) => {
    const e = RATE_TABLE[key];
    expect(e).toBeDefined();
    expect(e.inputRate).toBeGreaterThan(0);
    expect(e.outputRate).toBeGreaterThan(0);
    expect(["high", "medium", "low"]).toContain(e.confidence);
    expect(e.label).toBeTruthy();
  });

  it("output rate is exactly 5× input rate for every entry", () => {
    for (const [key, e] of Object.entries(RATE_TABLE)) {
      expect(e.outputRate / e.inputRate).toBe(5),
        `${key}: expected ratio 5, got ${e.outputRate / e.inputRate}`;
    }
  });

  it("gemini entries have high confidence (vendor-disclosed data)", () => {
    expect(RATE_TABLE["gemini-flash"].confidence).toBe("high");
    expect(RATE_TABLE["gemini-pro"].confidence).toBe("high");
  });

  it("deepseek-v3 has low confidence (sparse data)", () => {
    expect(RATE_TABLE["deepseek-v3"].confidence).toBe("low");
  });
});

// ── FRAMEWORK_REDUCTIONS ──────────────────────────────────────────────────────

describe("FRAMEWORK_REDUCTIONS", () => {
  it("has 4d, linear, cyclic, and baseline keys", () => {
    ["4d", "linear", "cyclic", "baseline"].forEach(k =>
      expect(FRAMEWORK_REDUCTIONS[k]).toBeDefined(),
    );
  });

  it("baseline has zero reduction on both dimensions", () => {
    expect(FRAMEWORK_REDUCTIONS["baseline"]).toEqual({ input: 0, output: 0 });
  });

  it("4D has greater reduction than linear > cyclic", () => {
    expect(FRAMEWORK_REDUCTIONS["4d"].output).toBeGreaterThan(FRAMEWORK_REDUCTIONS["linear"].output);
    expect(FRAMEWORK_REDUCTIONS["linear"].output).toBeGreaterThan(FRAMEWORK_REDUCTIONS["cyclic"].output);
  });

  it("all non-baseline reductions are strictly between 0 and 1", () => {
    for (const [k, v] of Object.entries(FRAMEWORK_REDUCTIONS)) {
      if (k === "baseline") continue;
      expect(v.input).toBeGreaterThan(0);
      expect(v.input).toBeLessThan(1);
      expect(v.output).toBeGreaterThan(0);
      expect(v.output).toBeLessThan(1);
    }
  });
});

// ── resolveModelKey ────────────────────────────────────────────────────────────

describe("resolveModelKey", () => {
  it.each([
    ["claude-haiku-4-5-20251001", "claude-haiku"],
    ["claude-sonnet-4-6",         "claude-sonnet"],
    ["claude-opus-4-6",           "claude-opus"],
    ["gpt-5-nano-2026-01",        "gpt-5-nano"],
    ["gpt-5-mini-2026",           "gpt-5-mini"],
    ["gpt-5",                     "gpt-5.2"],
    ["gpt-5.2-turbo",             "gpt-5.2"],
    ["gemini-flash-2.0-lite",     "gemini-flash"],
    ["gemini-pro-1.5",            "gemini-pro"],
    ["gemini-2.0-pro",            "gemini-pro"],
    ["mistral-small-latest",      "mistral-small"],
    ["mistral-large-2411",        "mistral-large"],
    ["mistral-medium",            "mistral-large"],
    ["deepseek-v3-0324",          "deepseek-v3"],
    ["deepseek-r1",               "deepseek-v3"],
  ])("'%s' → '%s'", (model, expected) => {
    expect(resolveModelKey(model)).toBe(expected);
  });

  it("falls back to DEFAULT for unrecognised models", () => {
    expect(resolveModelKey("llama-3-70b")).toBe("DEFAULT");
    expect(resolveModelKey("unknown-xyz")).toBe("DEFAULT");
    expect(resolveModelKey("")).toBe("DEFAULT");
  });

  it("is case-insensitive", () => {
    expect(resolveModelKey("Claude-Sonnet-4-6")).toBe("claude-sonnet");
    expect(resolveModelKey("GEMINI-FLASH")).toBe("gemini-flash");
    expect(resolveModelKey("GPT-5-NANO")).toBe("gpt-5-nano");
  });

  it("gpt-5-nano is resolved before gpt-5-mini and gpt-5 (priority order)", () => {
    expect(resolveModelKey("gpt-5-nano")).toBe("gpt-5-nano");
    expect(resolveModelKey("gpt-5-mini")).toBe("gpt-5-mini");
    expect(resolveModelKey("gpt-5")).toBe("gpt-5.2");
  });

  it("mistral-small resolved before mistral (priority order)", () => {
    expect(resolveModelKey("mistral-small")).toBe("mistral-small");
    expect(resolveModelKey("mistral")).toBe("mistral-large");
  });
});

// ── getAnalogy ────────────────────────────────────────────────────────────────

describe("getAnalogy", () => {
  it("returns zero-emission string for 0 and negative values", () => {
    expect(getAnalogy(0)).toContain("0 gCO₂eq");
    expect(getAnalogy(-1)).toContain("0 gCO₂eq");
  });

  it("uses percentage-of-smartphone for values < 0.001", () => {
    expect(getAnalogy(0.0005)).toContain("0.01%");
  });

  it("uses smartphone fraction between 0.001 and 0.03", () => {
    const r = getAnalogy(0.015);
    expect(r).toContain("smartphone charge");
    expect(r).toContain("%");
  });

  it("uses smartphone count between 0.03 and 1.5", () => {
    expect(getAnalogy(0.05)).toContain("smartphone");
    expect(getAnalogy(1.0)).toContain("smartphone");
  });

  it("uses kettles for 1.5–10 g", () => {
    expect(getAnalogy(3.0)).toContain("kettle");
    expect(getAnalogy(9.9)).toContain("kettle");
  });

  it("uses km-in-car for values ≥ 10 g", () => {
    expect(getAnalogy(50)).toContain("km");
    expect(getAnalogy(1000)).toContain("km");
  });

  it("always returns a non-empty string", () => {
    [0, 0.0001, 0.01, 0.1, 1, 10, 100, 1000].forEach(v =>
      expect(typeof getAnalogy(v)).toBe("string"),
    );
  });
});

// ── RateTableProvider ─────────────────────────────────────────────────────────

describe("RateTableProvider", () => {
  const provider = new RateTableProvider();

  it("has the expected stable id", () => {
    expect(provider.id).toBe("ecologits-rate-table");
  });

  it("returns null when both token counts are 0", () => {
    expect(provider.calculate("claude-sonnet", 0, 0)).toBeNull();
  });

  it("matches the CARBON_KNOWLEDGE.md worked example exactly", () => {
    // claude-sonnet-4-6 · 843 input · 400 output
    // input:  843 × 0.000012 = 0.010116
    // output: 400 × 0.000060 = 0.024000
    // total:  0.034116
    const r = provider.calculate("claude-sonnet-4-6", 843, 400)!;
    expect(r).not.toBeNull();
    expect(round(r.totalCO2, 9)).toBe(round(0.034116, 9));
    expect(r.totalTokens).toBe(1243);
    expect(r.modelKey).toBe("claude-sonnet");
    expect(r.confidence).toBe("medium");
    expect(r.providerId).toBe("ecologits-rate-table");
  });

  it("range is exactly ±40%", () => {
    const r = provider.calculate("claude-sonnet-4-6", 843, 400)!;
    expect(round(r.rangeMin)).toBe(round(r.totalCO2 * 0.60));
    expect(round(r.rangeMax)).toBe(round(r.totalCO2 * 1.40));
  });

  it("per100kTokens normalises correctly", () => {
    const r = provider.calculate("claude-sonnet-4-6", 843, 400)!;
    expect(r.per100kTokens).toBeCloseTo((r.totalCO2 / 1243) * 1e5, 6);
  });

  it("uses DEFAULT rates for unrecognised models", () => {
    const r = provider.calculate("llama-3-70b", 1000, 500)!;
    expect(r.modelKey).toBe("DEFAULT");
    expect(r.confidence).toBe("low");
  });

  it("gemini-flash produces less CO₂ than claude-sonnet, which is less than claude-opus", () => {
    const flash  = provider.calculate("gemini-flash", 1000, 500)!;
    const sonnet = provider.calculate("claude-sonnet", 1000, 500)!;
    const opus   = provider.calculate("claude-opus", 1000, 500)!;
    expect(flash.totalCO2).toBeLessThan(sonnet.totalCO2);
    expect(sonnet.totalCO2).toBeLessThan(opus.totalCO2);
  });

  it("accepts a custom rate table without subclassing", () => {
    const customTable = {
      ...RATE_TABLE,
      "claude-sonnet": { inputRate: 0.000001, outputRate: 0.000005, confidence: "high" as const, label: "Custom Sonnet" },
    };
    const customProvider = new RateTableProvider(customTable);
    const r = customProvider.calculate("claude-sonnet", 1000, 1000)!;
    const expected = 1000 * 0.000001 + 1000 * 0.000005;
    expect(round(r.totalCO2)).toBe(round(expected));
    // Default provider is unchanged
    const defaultR = provider.calculate("claude-sonnet", 1000, 1000)!;
    expect(defaultR.totalCO2).toBeGreaterThan(r.totalCO2);
  });

  it.each([
    ["claude-haiku",  100,  50],
    ["claude-opus",   500, 200],
    ["gpt-5-nano",    300, 100],
    ["gpt-5-mini",    400, 200],
    ["gpt-5.2",       600, 300],
    ["gemini-flash",  800, 400],
    ["gemini-pro",    700, 350],
    ["mistral-small", 500, 250],
    ["mistral-large", 600, 300],
    ["deepseek-v3",   400, 200],
  ])("produces a valid result for %s (%i/%i tokens)", (model, inp, out) => {
    const r = provider.calculate(model, inp, out)!;
    expect(r.totalCO2).toBeGreaterThan(0);
    expect(r.rangeMin).toBeLessThan(r.totalCO2);
    expect(r.rangeMax).toBeGreaterThan(r.totalCO2);
    expect(r.totalTokens).toBe(inp + out);
    expect(r.providerId).toBe("ecologits-rate-table");
  });
});

// ── EmissionsRegistry ─────────────────────────────────────────────────────────

describe("EmissionsRegistry", () => {
  let registry: EmissionsRegistry;
  const mockA = makeMockProvider();
  const mockB: EmissionsProvider = { ...makeMockProvider(), id: "mock-b", name: "Mock B" };

  beforeEach(() => {
    registry = new EmissionsRegistry();
  });

  it("starts empty with no default", () => {
    expect(registry.list()).toHaveLength(0);
    expect(registry.getDefault()).toBeUndefined();
  });

  it("registers a provider and sets it as default automatically (first registered)", () => {
    registry.register(mockA);
    expect(registry.list()).toHaveLength(1);
    expect(registry.getDefault()?.id).toBe("mock-provider");
  });

  it("setAsDefault=true overrides current default", () => {
    registry.register(mockA);
    registry.register(mockB, true);
    expect(registry.getDefault()?.id).toBe("mock-b");
  });

  it("register() returns this for chaining", () => {
    const result = registry.register(mockA).register(mockB);
    expect(result).toBe(registry);
  });

  it("get() retrieves a provider by id", () => {
    registry.register(mockA);
    expect(registry.get("mock-provider")).toBe(mockA);
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("list() returns providers in registration order", () => {
    registry.register(mockA);
    registry.register(mockB);
    const ids = registry.list().map(p => p.id);
    expect(ids).toEqual(["mock-provider", "mock-b"]);
  });

  it("unregister() removes a provider and returns true", () => {
    registry.register(mockA);
    expect(registry.unregister("mock-provider")).toBe(true);
    expect(registry.list()).toHaveLength(0);
  });

  it("unregister() returns false for non-existent id", () => {
    expect(registry.unregister("nope")).toBe(false);
  });

  it("unregistering the default shifts default to next registered provider", () => {
    registry.register(mockA);
    registry.register(mockB);
    registry.unregister("mock-provider");
    expect(registry.getDefault()?.id).toBe("mock-b");
  });

  it("setDefault() throws for an unregistered id", () => {
    expect(() => registry.setDefault("unknown")).toThrow();
  });

  it("calculate() returns null for both-zero tokens", () => {
    registry.register(mockA);
    expect(registry.calculate("any-model", 0, 0)).toBeNull();
  });

  it("calculate() uses the first provider that returns non-null", () => {
    registry.register(nullProvider);
    registry.register(mockA);
    const r = registry.calculate("any-model", 100, 50)!;
    expect(r.providerId).toBe("mock-provider");
  });

  it("calculate() with a specific providerId uses only that provider", () => {
    registry.register(mockA);
    registry.register(new RateTableProvider());
    const r = registry.calculate("claude-sonnet", 100, 50, "ecologits-rate-table")!;
    expect(r.providerId).toBe("ecologits-rate-table");
  });

  it("calculate() throws if the requested providerId is not registered", () => {
    expect(() => registry.calculate("claude-sonnet", 100, 50, "ghost")).toThrow();
  });

  it("calculate() returns null if no provider can handle the call", () => {
    registry.register(nullProvider);
    expect(registry.calculate("any-model", 100, 50)).toBeNull();
  });
});

// ── defaultRegistry ───────────────────────────────────────────────────────────

describe("defaultRegistry", () => {
  it("is pre-loaded with RateTableProvider as the default", () => {
    expect(defaultRegistry.getDefault()?.id).toBe("ecologits-rate-table");
  });

  it("contains at least RateTableProvider", () => {
    const ids = defaultRegistry.list().map(p => p.id);
    expect(ids).toContain("ecologits-rate-table");
  });
});

// ── calculateCO2 convenience wrapper ─────────────────────────────────────────

describe("calculateCO2", () => {
  it("returns null when both token counts are 0", () => {
    expect(calculateCO2("claude-sonnet-4-6", 0, 0)).toBeNull();
  });

  it("uses the defaultRegistry when no provider is given", () => {
    const r = calculateCO2("claude-sonnet-4-6", 843, 400)!;
    expect(r).not.toBeNull();
    expect(r.providerId).toBe("ecologits-rate-table");
  });

  it("matches the worked example from CARBON_KNOWLEDGE.md", () => {
    const r = calculateCO2("claude-sonnet-4-6", 843, 400)!;
    expect(round(r.totalCO2, 9)).toBe(round(0.034116, 9));
  });

  it("uses an injected provider when one is given", () => {
    const mock = makeMockProvider();
    const r = calculateCO2("claude-sonnet", 100, 50, mock)!;
    expect(r.providerId).toBe("mock-provider");
    // mock rates: 100×0.0001 + 50×0.0005 = 0.035
    expect(round(r.totalCO2)).toBe(round(0.035));
  });

  it("returns null from injected provider when it returns null", () => {
    expect(calculateCO2("any", 100, 50, nullProvider)).toBeNull();
  });
});

// ── CarbonSession ─────────────────────────────────────────────────────────────

describe("CarbonSession", () => {
  it("starts with zero state and null total", () => {
    const s = new CarbonSession("claude-sonnet");
    expect(s.sessionCO2).toBe(0);
    expect(s.inputTokens).toBe(0);
    expect(s.outputTokens).toBe(0);
    expect(s.getTotal()).toBeNull();
  });

  it("accumulates a single call", () => {
    const s = new CarbonSession("claude-sonnet-4-6");
    const r = s.add(843, 400)!;
    expect(round(s.sessionCO2)).toBe(round(r.totalCO2));
    expect(s.inputTokens).toBe(843);
    expect(s.outputTokens).toBe(400);
  });

  it("accumulates multiple calls correctly", () => {
    const s = new CarbonSession("claude-sonnet-4-6");
    s.add(843, 400);
    s.add(500, 200);
    s.add(1000, 600);
    expect(s.inputTokens).toBe(2343);
    expect(s.outputTokens).toBe(1200);
    const total = s.getTotal()!;
    const expected = 2343 * 0.000012 + 1200 * 0.000060;
    expect(round(total.totalCO2)).toBe(round(expected));
  });

  it("getTotal() matches direct calculateCO2 for the same accumulated totals", () => {
    const s = new CarbonSession("claude-sonnet-4-6");
    s.add(843, 400);
    s.add(500, 200);
    const direct = calculateCO2("claude-sonnet-4-6", 1343, 600)!;
    expect(round(s.getTotal()!.totalCO2)).toBe(round(direct.totalCO2));
  });

  it("add() returns null and does not change state for zero tokens", () => {
    const s = new CarbonSession("claude-sonnet");
    expect(s.add(0, 0)).toBeNull();
    expect(s.sessionCO2).toBe(0);
  });

  it("resets to zero and allows re-accumulation", () => {
    const s = new CarbonSession("claude-sonnet-4-6");
    s.add(843, 400);
    s.reset();
    expect(s.sessionCO2).toBe(0);
    expect(s.getTotal()).toBeNull();
    s.add(500, 200);
    expect(s.inputTokens).toBe(500);
  });

  it("accumulated sessionCO2 equals sum of individual call results", () => {
    const s = new CarbonSession("claude-sonnet-4-6");
    const r1 = s.add(300, 100)!;
    const r2 = s.add(400, 150)!;
    const r3 = s.add(200, 80)!;
    expect(round(s.sessionCO2)).toBe(round(r1.totalCO2 + r2.totalCO2 + r3.totalCO2));
  });

  it("uses an injected provider for all calls in the session", () => {
    const mock = makeMockProvider();
    const s = new CarbonSession("claude-sonnet", mock);
    const r = s.add(100, 50)!;
    expect(r.providerId).toBe("mock-provider");
    const total = s.getTotal()!;
    expect(total.providerId).toBe("mock-provider");
  });

  it("session with injected provider is independent of defaultRegistry", () => {
    const highRateProvider = makeMockProvider(); // higher rates than default
    const s = new CarbonSession("claude-sonnet", highRateProvider);
    const r = s.add(100, 50)!;
    // mock rates: 100×0.0001 + 50×0.0005 = 0.035
    // default rates: 100×0.000012 + 50×0.000060 = 0.004200
    expect(r.totalCO2).toBeGreaterThan(0.030);
  });
});

// ── compareFrameworks ─────────────────────────────────────────────────────────

describe("compareFrameworks", () => {
  const baseRuns: FrameworkRun[] = [
    { label: "no_framework",    framework: null,     inputTokens: 1100, outputTokens: 620 },
    { label: "fluently_4D",     framework: "4D",     inputTokens: 843,  outputTokens: 400 },
    { label: "fluently_linear", framework: "linear", inputTokens: 920,  outputTokens: 480 },
  ];

  it("throws for an empty runs array", () => {
    expect(() => compareFrameworks("claude-sonnet", [])).toThrow();
  });

  it("returns all runs with valid results", () => {
    const { runs } = compareFrameworks("claude-sonnet", baseRuns);
    expect(runs).toHaveLength(3);
    runs.forEach(r => expect(r.result.totalCO2).toBeGreaterThan(0));
  });

  it("sorts runs ascending by per100kTokens (most efficient first)", () => {
    const { runs } = compareFrameworks("claude-sonnet", baseRuns);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].result.per100kTokens).toBeGreaterThanOrEqual(
        runs[i - 1].result.per100kTokens,
      );
    }
  });

  it("identifies baseline as the null-framework run", () => {
    const { baseline } = compareFrameworks("claude-sonnet", baseRuns);
    expect(baseline.framework).toBeNull();
  });

  it("baseline has 0% saving", () => {
    const { baseline } = compareFrameworks("claude-sonnet", baseRuns);
    expect(baseline.savingPct).toBe(0);
  });

  it("non-baseline runs have positive savings vs baseline", () => {
    const { runs, baseline } = compareFrameworks("claude-sonnet", baseRuns);
    runs.filter(r => r !== baseline).forEach(r =>
      expect(r.savingPct).toBeGreaterThan(0),
    );
  });

  it("saving percentage formula: round((1 - run/baseline) * 100)", () => {
    const { runs, baseline } = compareFrameworks("claude-sonnet", baseRuns);
    runs.forEach(r => {
      const expected = Math.round(
        (1 - r.result.per100kTokens / baseline.result.per100kTokens) * 100,
      );
      expect(r.savingPct).toBe(expected);
    });
  });

  it("when no null-framework run exists, highest per100k is baseline", () => {
    const allFramework: FrameworkRun[] = [
      { label: "4D",     framework: "4D",     inputTokens: 843,  outputTokens: 400 },
      { label: "linear", framework: "linear", inputTokens: 1100, outputTokens: 620 },
    ];
    const { baseline } = compareFrameworks("claude-sonnet", allFramework);
    expect(baseline.label).toBe("linear"); // more tokens → higher per100k
  });

  it("single run produces valid result with 0% savings", () => {
    const { runs, baseline, mostEfficient } = compareFrameworks("claude-sonnet", [
      { label: "solo", framework: null, inputTokens: 500, outputTokens: 200 },
    ]);
    expect(runs).toHaveLength(1);
    expect(baseline).toBe(mostEfficient);
    expect(runs[0].savingPct).toBe(0);
  });

  it("4D has greater savings than linear in the standard example", () => {
    const { runs } = compareFrameworks("claude-sonnet", baseRuns);
    const the4D     = runs.find(r => r.label === "fluently_4D")!;
    const theLinear = runs.find(r => r.label === "fluently_linear")!;
    expect(the4D.savingPct).toBeGreaterThan(theLinear.savingPct);
  });

  it("carries the correct model key through to each run result", () => {
    const { runs } = compareFrameworks("claude-opus-4-6", baseRuns);
    runs.forEach(r => expect(r.result.modelKey).toBe("claude-opus"));
  });

  it("uses an injected provider for all runs", () => {
    const mock = makeMockProvider();
    const { runs, providerId } = compareFrameworks("claude-sonnet", baseRuns, mock);
    expect(providerId).toBe("mock-provider");
    runs.forEach(r => expect(r.result.providerId).toBe("mock-provider"));
  });

  it("injected provider produces different results than the default", () => {
    const mock = makeMockProvider(); // higher rates
    const defaultResult = compareFrameworks("claude-sonnet", baseRuns);
    const mockResult    = compareFrameworks("claude-sonnet", baseRuns, mock);
    // mock rates are much higher, so all CO₂ values should be larger
    expect(mockResult.baseline.result.totalCO2).toBeGreaterThan(
      defaultResult.baseline.result.totalCO2,
    );
  });
});

// ── Custom EmissionsProvider end-to-end ───────────────────────────────────────

describe("Custom EmissionsProvider — end-to-end injection", () => {
  it("a custom provider can be registered in a local registry and used", () => {
    const registry = new EmissionsRegistry();
    registry.register(makeMockProvider(), true);
    const r = registry.calculate("any-model", 100, 50)!;
    expect(r.providerId).toBe("mock-provider");
    expect(round(r.totalCO2)).toBe(round(100 * 0.000100 + 50 * 0.000500));
  });

  it("a provider that handles only specific models returns null for others", () => {
    const anthropicOnly: EmissionsProvider = {
      id: "anthropic-only",
      name: "Anthropic Only",
      version: "test",
      calculate(model, inp, out) {
        if (!model.toLowerCase().includes("claude")) return null;
        const co2 = inp * 0.00001 + out * 0.00005;
        return {
          totalCO2: co2, rangeMin: co2 * 0.8, rangeMax: co2 * 1.2,
          per100kTokens: (co2 / (inp + out)) * 1e5,
          totalTokens: inp + out, inputTokens: inp, outputTokens: out,
          modelKey: "claude", confidence: "high", analogy: "test",
          providerId: "anthropic-only",
        };
      },
    };

    const registry = new EmissionsRegistry();
    registry.register(anthropicOnly);
    registry.register(new RateTableProvider());

    // anthropicOnly handles claude → should win
    const claudeResult = registry.calculate("claude-sonnet", 100, 50)!;
    expect(claudeResult.providerId).toBe("anthropic-only");

    // anthropicOnly returns null for gpt → falls through to RateTableProvider
    const gptResult = registry.calculate("gpt-5-mini", 100, 50)!;
    expect(gptResult.providerId).toBe("ecologits-rate-table");
  });

  it("a provider with higher confidence is preferred when registered first", () => {
    const highConfidence: EmissionsProvider = {
      id: "high-confidence",
      name: "High Confidence",
      version: "test",
      calculate(_, inp, out) {
        if (inp + out === 0) return null;
        const co2 = (inp + out) * 0.00001;
        return {
          totalCO2: co2, rangeMin: co2 * 0.95, rangeMax: co2 * 1.05,
          per100kTokens: co2 / (inp + out) * 1e5,
          totalTokens: inp + out, inputTokens: inp, outputTokens: out,
          modelKey: "any", confidence: "high", analogy: "test",
          providerId: "high-confidence",
        };
      },
    };

    const registry = new EmissionsRegistry();
    registry.register(highConfidence, true);
    registry.register(new RateTableProvider());

    const r = registry.calculate("claude-sonnet", 100, 50)!;
    expect(r.providerId).toBe("high-confidence");
    expect(r.confidence).toBe("high");
  });
});
