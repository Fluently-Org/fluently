/**
 * carbon.test.ts
 *
 * Comprehensive tests for the fluently-carbon package.
 *
 * Coverage:
 *   - RATE_TABLE structure and completeness
 *   - resolveModelKey: all supported models + priority order + DEFAULT fallback
 *   - calculateCO2: worked example, zero tokens, all models, confidence bands
 *   - getAnalogy: boundary values and scale
 *   - CarbonSession: accumulation, reset, multi-call totals
 *   - compareFrameworks: sorting, savings, baseline detection, edge cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RATE_TABLE,
  RATE_TABLE_VERSION,
  FRAMEWORK_REDUCTIONS,
  resolveModelKey,
  calculateCO2,
  getAnalogy,
  compareFrameworks,
  CarbonSession,
} from "../index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Round to N decimal places to avoid floating-point noise. */
const round = (n: number, dp = 9) => Math.round(n * 10 ** dp) / 10 ** dp;

// ── RATE_TABLE ─────────────────────────────────────────────────────────────────

describe("RATE_TABLE", () => {
  it("exports a version string", () => {
    expect(typeof RATE_TABLE_VERSION).toBe("string");
    expect(RATE_TABLE_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });

  it("has a DEFAULT entry", () => {
    expect(RATE_TABLE["DEFAULT"]).toBeDefined();
    expect(RATE_TABLE["DEFAULT"].confidence).toBe("low");
  });

  const requiredKeys = [
    "claude-haiku", "claude-sonnet", "claude-opus",
    "gpt-5-nano", "gpt-5-mini", "gpt-5.2",
    "gemini-flash", "gemini-pro",
    "mistral-small", "mistral-large",
    "deepseek-v3",
    "DEFAULT",
  ];

  it.each(requiredKeys)("has entry for %s", (key) => {
    const entry = RATE_TABLE[key];
    expect(entry).toBeDefined();
    expect(entry.inputRate).toBeGreaterThan(0);
    expect(entry.outputRate).toBeGreaterThan(0);
    expect(["high", "medium", "low"]).toContain(entry.confidence);
    expect(entry.label).toBeTruthy();
  });

  it("output rate is always greater than input rate (generation costs more)", () => {
    for (const [key, entry] of Object.entries(RATE_TABLE)) {
      expect(entry.outputRate).toBeGreaterThan(entry.inputRate),
        `${key}: outputRate should exceed inputRate`;
    }
  });

  it("output rate is approximately 5× input rate for each entry", () => {
    for (const [key, entry] of Object.entries(RATE_TABLE)) {
      const ratio = entry.outputRate / entry.inputRate;
      expect(ratio).toBe(5), `${key}: expected output/input ratio of 5, got ${ratio}`;
    }
  });

  it("gemini entries have high confidence", () => {
    expect(RATE_TABLE["gemini-flash"].confidence).toBe("high");
    expect(RATE_TABLE["gemini-pro"].confidence).toBe("high");
  });

  it("deepseek-v3 has low confidence", () => {
    expect(RATE_TABLE["deepseek-v3"].confidence).toBe("low");
  });
});

// ── FRAMEWORK_REDUCTIONS ──────────────────────────────────────────────────────

describe("FRAMEWORK_REDUCTIONS", () => {
  it("has 4D, linear, cyclic, and baseline entries", () => {
    expect(FRAMEWORK_REDUCTIONS["4d"]).toBeDefined();
    expect(FRAMEWORK_REDUCTIONS["linear"]).toBeDefined();
    expect(FRAMEWORK_REDUCTIONS["cyclic"]).toBeDefined();
    expect(FRAMEWORK_REDUCTIONS["baseline"]).toBeDefined();
  });

  it("baseline has zero reduction", () => {
    expect(FRAMEWORK_REDUCTIONS["baseline"].input).toBe(0);
    expect(FRAMEWORK_REDUCTIONS["baseline"].output).toBe(0);
  });

  it("4D framework has higher reduction than linear and cyclic", () => {
    expect(FRAMEWORK_REDUCTIONS["4d"].output).toBeGreaterThan(FRAMEWORK_REDUCTIONS["linear"].output);
    expect(FRAMEWORK_REDUCTIONS["linear"].output).toBeGreaterThan(FRAMEWORK_REDUCTIONS["cyclic"].output);
  });

  it("all non-baseline reductions are between 0 and 1 (exclusive)", () => {
    for (const [key, val] of Object.entries(FRAMEWORK_REDUCTIONS)) {
      if (key === "baseline") continue;
      expect(val.input).toBeGreaterThan(0);
      expect(val.input).toBeLessThan(1);
      expect(val.output).toBeGreaterThan(0);
      expect(val.output).toBeLessThan(1);
    }
  });
});

// ── resolveModelKey ────────────────────────────────────────────────────────────

describe("resolveModelKey", () => {
  // Anthropic models
  it("resolves claude-haiku-4-5-xxx", () => {
    expect(resolveModelKey("claude-haiku-4-5-20251001")).toBe("claude-haiku");
  });
  it("resolves claude-sonnet-4-6", () => {
    expect(resolveModelKey("claude-sonnet-4-6")).toBe("claude-sonnet");
  });
  it("resolves claude-opus-4-6", () => {
    expect(resolveModelKey("claude-opus-4-6")).toBe("claude-opus");
  });

  // GPT models — specific before general to avoid mis-classification
  it("resolves gpt-5-nano before gpt-5-mini and gpt-5", () => {
    expect(resolveModelKey("gpt-5-nano-2026-01")).toBe("gpt-5-nano");
  });
  it("resolves gpt-5-mini before gpt-5", () => {
    expect(resolveModelKey("gpt-5-mini-2026")).toBe("gpt-5-mini");
  });
  it("resolves gpt-5 (non-nano, non-mini) to gpt-5.2", () => {
    expect(resolveModelKey("gpt-5")).toBe("gpt-5.2");
    expect(resolveModelKey("gpt-5.2-turbo")).toBe("gpt-5.2");
  });

  // Google models
  it("resolves gemini-flash before gemini-pro", () => {
    expect(resolveModelKey("gemini-flash-2.0-lite")).toBe("gemini-flash");
  });
  it("resolves gemini (non-flash) to gemini-pro", () => {
    expect(resolveModelKey("gemini-pro-1.5")).toBe("gemini-pro");
    expect(resolveModelKey("gemini-2.0-pro")).toBe("gemini-pro");
  });

  // Mistral models
  it("resolves mistral-small before mistral-large", () => {
    expect(resolveModelKey("mistral-small-latest")).toBe("mistral-small");
  });
  it("resolves mistral (non-small) to mistral-large", () => {
    expect(resolveModelKey("mistral-large-2411")).toBe("mistral-large");
    expect(resolveModelKey("mistral-medium")).toBe("mistral-large");
  });

  // DeepSeek
  it("resolves deepseek-v3", () => {
    expect(resolveModelKey("deepseek-v3-0324")).toBe("deepseek-v3");
    expect(resolveModelKey("deepseek-r1")).toBe("deepseek-v3");
  });

  // Unknown
  it("falls back to DEFAULT for unrecognised model", () => {
    expect(resolveModelKey("llama-3-70b")).toBe("DEFAULT");
    expect(resolveModelKey("unknown-model-xyz")).toBe("DEFAULT");
    expect(resolveModelKey("")).toBe("DEFAULT");
  });

  it("is case-insensitive", () => {
    expect(resolveModelKey("Claude-Sonnet-4-6")).toBe("claude-sonnet");
    expect(resolveModelKey("GEMINI-FLASH")).toBe("gemini-flash");
  });
});

// ── calculateCO2 ──────────────────────────────────────────────────────────────

describe("calculateCO2", () => {
  it("returns null when both token counts are 0", () => {
    expect(calculateCO2("claude-sonnet-4-6", 0, 0)).toBeNull();
  });

  it("matches the CARBON_KNOWLEDGE.md worked example exactly", () => {
    // Task: RFP draft · claude-sonnet-4-6 · 843 input · 400 output
    const result = calculateCO2("claude-sonnet-4-6", 843, 400);
    expect(result).not.toBeNull();

    // Input: 843 × 0.000012 = 0.010116
    // Output: 400 × 0.000060 = 0.024000
    // Total: 0.034116
    expect(round(result!.totalCO2, 9)).toBe(round(0.034116, 9));
    expect(result!.totalTokens).toBe(1243);
    expect(result!.modelKey).toBe("claude-sonnet");
    expect(result!.confidence).toBe("medium");
  });

  it("calculates range as ±40% of total", () => {
    const result = calculateCO2("claude-sonnet-4-6", 843, 400)!;
    expect(round(result.rangeMin)).toBe(round(result.totalCO2 * 0.60));
    expect(round(result.rangeMax)).toBe(round(result.totalCO2 * 1.40));
  });

  it("calculates per100kTokens correctly", () => {
    const result = calculateCO2("claude-sonnet-4-6", 843, 400)!;
    const expected = (result.totalCO2 / 1243) * 100_000;
    expect(round(result.per100kTokens)).toBe(round(expected));
    // ≈ 2.745 g/100k tokens
    expect(result.per100kTokens).toBeCloseTo(2.745, 2);
  });

  it("works with input-only tokens (0 output)", () => {
    const result = calculateCO2("claude-sonnet-4-6", 1000, 0)!;
    const expected = 1000 * 0.000012;
    expect(round(result.totalCO2)).toBe(round(expected));
    expect(result.outputTokens).toBe(0);
  });

  it("works with output-only tokens (0 input)", () => {
    const result = calculateCO2("claude-sonnet-4-6", 0, 500)!;
    const expected = 500 * 0.000060;
    expect(round(result.totalCO2)).toBe(round(expected));
  });

  it("uses DEFAULT rates for unknown model and marks confidence low", () => {
    const result = calculateCO2("llama-3-70b", 1000, 500)!;
    expect(result.modelKey).toBe("DEFAULT");
    expect(result.confidence).toBe("low");
    // DEFAULT rates same as claude-sonnet
    const expected = 1000 * 0.000012 + 500 * 0.000060;
    expect(round(result.totalCO2)).toBe(round(expected));
  });

  it("gemini-flash produces the lowest CO2 per token", () => {
    const flash  = calculateCO2("gemini-flash", 1000, 500)!;
    const sonnet = calculateCO2("claude-sonnet", 1000, 500)!;
    const opus   = calculateCO2("claude-opus", 1000, 500)!;
    expect(flash.totalCO2).toBeLessThan(sonnet.totalCO2);
    expect(sonnet.totalCO2).toBeLessThan(opus.totalCO2);
  });

  it("includes a non-empty analogy string", () => {
    const result = calculateCO2("claude-sonnet", 1000, 500)!;
    expect(typeof result.analogy).toBe("string");
    expect(result.analogy.length).toBeGreaterThan(0);
  });

  it.each([
    ["claude-haiku",  100, 50],
    ["claude-opus",   500, 200],
    ["gpt-5-nano",    300, 100],
    ["gpt-5-mini",    400, 200],
    ["gpt-5.2",       600, 300],
    ["gemini-flash",  800, 400],
    ["gemini-pro",    700, 350],
    ["mistral-small", 500, 250],
    ["mistral-large", 600, 300],
    ["deepseek-v3",   400, 200],
  ])("produces a positive result for %s (%i/%i tokens)", (model, inp, out) => {
    const result = calculateCO2(model, inp, out)!;
    expect(result.totalCO2).toBeGreaterThan(0);
    expect(result.rangeMin).toBeLessThan(result.totalCO2);
    expect(result.rangeMax).toBeGreaterThan(result.totalCO2);
    expect(result.totalTokens).toBe(inp + out);
  });
});

// ── getAnalogy ────────────────────────────────────────────────────────────────

describe("getAnalogy", () => {
  it("returns a zero-emission string for 0 gCO2", () => {
    expect(getAnalogy(0)).toContain("0 gCO₂eq");
  });

  it("returns a zero-emission string for negative values", () => {
    expect(getAnalogy(-1)).toContain("0 gCO₂eq");
  });

  it("handles very small values (< 0.001 g)", () => {
    const result = getAnalogy(0.0005);
    expect(result).toContain("0.01%");
  });

  it("handles small values between 0.001 and 0.03 (smartphone fraction)", () => {
    const result = getAnalogy(0.015);
    expect(result).toContain("smartphone charge");
    expect(result).toContain("%");
  });

  it("handles medium values around 0.03 g (one smartphone charge)", () => {
    const result = getAnalogy(0.034);
    expect(result).toContain("smartphone");
  });

  it("handles values around 1.5 g (kettle)", () => {
    const result = getAnalogy(3.0);
    expect(result).toContain("kettle");
  });

  it("handles large values (km in a car)", () => {
    const result = getAnalogy(50);
    expect(result).toContain("km");
  });

  it("handles very large values", () => {
    const result = getAnalogy(1000);
    expect(result).toContain("km");
  });

  it("always returns a string", () => {
    for (const val of [0, 0.0001, 0.01, 0.1, 1, 10, 100, 1000]) {
      expect(typeof getAnalogy(val)).toBe("string");
    }
  });
});

// ── CarbonSession ─────────────────────────────────────────────────────────────

describe("CarbonSession", () => {
  let session: CarbonSession;

  beforeEach(() => {
    session = new CarbonSession("claude-sonnet-4-6");
  });

  it("starts with zero state", () => {
    expect(session.sessionCO2).toBe(0);
    expect(session.inputTokens).toBe(0);
    expect(session.outputTokens).toBe(0);
    expect(session.getTotal()).toBeNull();
  });

  it("accumulates a single call", () => {
    const result = session.add(843, 400);
    expect(result).not.toBeNull();
    expect(session.inputTokens).toBe(843);
    expect(session.outputTokens).toBe(400);
    expect(round(session.sessionCO2)).toBe(round(result!.totalCO2));
  });

  it("accumulates multiple calls correctly", () => {
    session.add(843, 400);   // call 1
    session.add(500, 200);   // call 2
    session.add(1000, 600);  // call 3

    expect(session.inputTokens).toBe(843 + 500 + 1000);
    expect(session.outputTokens).toBe(400 + 200 + 600);

    const total = session.getTotal()!;
    const expectedCO2 = (2343 * 0.000012) + (1200 * 0.000060);
    expect(round(total.totalCO2)).toBe(round(expectedCO2));
    expect(total.totalTokens).toBe(2343 + 1200);
  });

  it("getTotal returns a result consistent with calculateCO2 for the same totals", () => {
    session.add(843, 400);
    session.add(500, 200);

    const sessionTotal = session.getTotal()!;
    const direct = calculateCO2("claude-sonnet-4-6", 1343, 600)!;

    expect(round(sessionTotal.totalCO2)).toBe(round(direct.totalCO2));
    expect(sessionTotal.totalTokens).toBe(direct.totalTokens);
  });

  it("returns null from add() when both token counts are 0", () => {
    const result = session.add(0, 0);
    expect(result).toBeNull();
    // State should remain unchanged
    expect(session.sessionCO2).toBe(0);
  });

  it("resets to zero state", () => {
    session.add(843, 400);
    session.add(500, 200);
    session.reset();

    expect(session.sessionCO2).toBe(0);
    expect(session.inputTokens).toBe(0);
    expect(session.outputTokens).toBe(0);
    expect(session.getTotal()).toBeNull();
  });

  it("continues accumulating after reset", () => {
    session.add(843, 400);
    session.reset();
    session.add(500, 200);

    expect(session.inputTokens).toBe(500);
    expect(session.outputTokens).toBe(200);
  });

  it("accumulated sessionCO2 equals sum of individual call results", () => {
    const r1 = session.add(300, 100)!;
    const r2 = session.add(400, 150)!;
    const r3 = session.add(200, 80)!;

    const expectedTotal = r1.totalCO2 + r2.totalCO2 + r3.totalCO2;
    expect(round(session.sessionCO2)).toBe(round(expectedTotal));
  });
});

// ── compareFrameworks ─────────────────────────────────────────────────────────

describe("compareFrameworks", () => {
  const baseRuns = [
    { label: "no_framework",    framework: null,     inputTokens: 1100, outputTokens: 620 },
    { label: "fluently_4D",     framework: "4D",     inputTokens: 843,  outputTokens: 400 },
    { label: "fluently_linear", framework: "linear", inputTokens: 920,  outputTokens: 480 },
  ];

  it("throws when given an empty runs array", () => {
    expect(() => compareFrameworks("claude-sonnet", [])).toThrow();
  });

  it("returns all runs with results", () => {
    const { runs } = compareFrameworks("claude-sonnet", baseRuns);
    expect(runs).toHaveLength(3);
    for (const r of runs) {
      expect(r.result).not.toBeNull();
      expect(r.result.totalCO2).toBeGreaterThan(0);
    }
  });

  it("sorts runs by per100kTokens ascending (most efficient first)", () => {
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
    expect(baseline.label).toBe("no_framework");
  });

  it("identifies most efficient as the run with lowest per100kTokens", () => {
    const { runs, mostEfficient } = compareFrameworks("claude-sonnet", baseRuns);
    expect(mostEfficient.label).toBe(runs[0].label);
  });

  it("baseline has 0% saving", () => {
    const { baseline } = compareFrameworks("claude-sonnet", baseRuns);
    expect(baseline.savingPct).toBe(0);
  });

  it("non-baseline runs have positive saving percentage vs baseline", () => {
    const { runs, baseline } = compareFrameworks("claude-sonnet", baseRuns);
    const nonBaseline = runs.filter(r => r !== baseline);
    for (const r of nonBaseline) {
      expect(r.savingPct).toBeGreaterThan(0);
    }
  });

  it("saving percentage is correct: (1 - run/baseline) * 100", () => {
    const { runs, baseline } = compareFrameworks("claude-sonnet", baseRuns);
    for (const r of runs) {
      const expected = Math.round(
        (1 - r.result.per100kTokens / baseline.result.per100kTokens) * 100,
      );
      expect(r.savingPct).toBe(expected);
    }
  });

  it("when no null-framework run exists, picks highest per100k as baseline", () => {
    const allFrameworkRuns = [
      { label: "4D",     framework: "4D",     inputTokens: 843,  outputTokens: 400 },
      { label: "linear", framework: "linear", inputTokens: 1100, outputTokens: 620 },
    ];
    const { baseline } = compareFrameworks("claude-sonnet", allFrameworkRuns);
    // linear has more tokens → higher per100k → should be baseline
    expect(baseline.label).toBe("linear");
  });

  it("works with a single run (no comparison possible)", () => {
    const single = [{ label: "solo", framework: null, inputTokens: 500, outputTokens: 200 }];
    const { runs, baseline, mostEfficient } = compareFrameworks("claude-sonnet", single);
    expect(runs).toHaveLength(1);
    expect(baseline).toBe(mostEfficient);
    expect(runs[0].savingPct).toBe(0);
  });

  it("carries the model through to result modelKey", () => {
    const { runs } = compareFrameworks("claude-opus-4-6", baseRuns);
    for (const r of runs) {
      expect(r.result.modelKey).toBe("claude-opus");
    }
  });

  it("4D framework produces greater savings than linear in the standard example", () => {
    const { runs } = compareFrameworks("claude-sonnet", baseRuns);
    const the4D     = runs.find(r => r.label === "fluently_4D")!;
    const theLinear = runs.find(r => r.label === "fluently_linear")!;
    expect(the4D.savingPct).toBeGreaterThan(theLinear.savingPct);
  });
});
