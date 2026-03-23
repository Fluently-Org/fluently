/**
 * engine.ts
 *
 * Core scoring engine for the Fluently 4D Framework.
 *
 * Responsibilities:
 *   1. Load and validate knowledge YAML files from disk.
 *   2. Score a user task against each entry using binary cosine similarity.
 *   3. Score the quality of a cycle's collaboration block (sequence coverage,
 *      trigger completeness, loop-back definitions, canonical D order).
 *
 * The scorer never calls an external API — it is pure local computation so it
 * works offline and in CI without any credentials.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { knowledgeEntrySchema } from "./schema.js";
import { BUNDLED_4D_FRAMEWORK } from "./framework-schema.js";
import type { FrameworkDimension, FrameworkDefinition, DimensionValue } from "./framework-schema.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskInput = {
  /** Plain-language description of the AI task */
  description: string;
  /** How much autonomy is given to AI: "automated" | "augmented" | "supervised" */
  delegation_intent: string;
};

/** Validated knowledge entry as produced by Zod parse */
export type KnowledgeEntry = ReturnType<typeof knowledgeEntrySchema.parse>;

// ── Knowledge loading ─────────────────────────────────────────────────────────

/**
 * Load and Zod-validate every `.yaml` file in `knowledgeDir`.
 * Throws if any file fails schema validation — this is intentional so CI
 * catches malformed entries before they reach users.
 */
export function loadKnowledgeEntries(knowledgeDir: string): KnowledgeEntry[] {
  const files = fs
    .readdirSync(knowledgeDir)
    .filter((f: string) => f.endsWith(".yaml"));

  return files.map((file: string) => {
    const content = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
    const raw = yaml.load(content);
    return knowledgeEntrySchema.parse(raw);
  });
}

// ── Keyword similarity ────────────────────────────────────────────────────────

/**
 * Convert text to a lowercase word-set, stripping punctuation.
 * Short tokens (≤ 2 chars) are excluded — they carry almost no signal.
 */
function keywordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Binary cosine similarity between two keyword sets.
 * Each word is treated as a 0/1 feature, so this reduces to
 * |intersection| / (√|A| × √|B|) — equivalent to the Jaccard-like
 * overlap normalised by set sizes rather than union size.
 * Returns 0 when either set is empty.
 */
function cosineSimilarity(a: Set<string>, b: Set<string>): number {
  const union = new Set([...a, ...b]);
  let dot = 0, magA = 0, magB = 0;
  for (const word of union) {
    const av = a.has(word) ? 1 : 0;
    const bv = b.has(word) ? 1 : 0;
    dot  += av * bv;
    magA += av;
    magB += bv;
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

// ── Collaboration scoring ─────────────────────────────────────────────────────

/**
 * Score the quality of a cycle's `collaboration` block on a 0–100 scale.
 *
 * Rubric (each criterion independently scored):
 *   40 pts — All four Ds appear at least once in the sequence
 *   20 pts — Every step has a non-empty `triggers_next` field
 *   20 pts — Loop-back transitions are defined when the pattern requires them
 *   20 pts — First appearance of each D follows the canonical Del→Des→Dis→Dil order
 *
 * Returns the numeric score, a human-readable `summary`, and an `insights`
 * array that lists one bullet per criterion (✓ pass / ⚠ fail).
 */
export function scoreCollaboration(
  entry: KnowledgeEntry,
  frameworkDimensions?: FrameworkDimension[]
): {
  score: number;
  summary: string;
  insights: string[];
} {
  const collab = entry.collaboration;

  if (!collab) {
    return {
      score: 0,
      summary:
        "No collaboration sequence defined — add a collaboration block to capture the conversation flow.",
      insights: ["Missing collaboration block"],
    };
  }

  const insights: string[] = [];
  let score = 0;

  // ── 1. All dimensions represented? (40 pts) ───────────────────────────────
  const dims = frameworkDimensions ?? BUNDLED_4D_FRAMEWORK.dimensions;
  const allKeys = dims.map(d => d.key);
  const canonicalOrder = [...dims].sort((a, b) => a.canonical_order - b.canonical_order).map(d => d.key);

  const dsPresent = new Set(collab.sequence.map((s) => s.d));
  const missingDs = allKeys.filter((d) => !dsPresent.has(d));
  const totalDims = allKeys.length;

  if (missingDs.length === 0) {
    score += 40;
    insights.push(`✓ All ${totalDims} dimensions are represented in the sequence`);
  } else {
    score += ((totalDims - missingDs.length) / totalDims) * 40;
    insights.push(`⚠ Missing dimension clusters: ${missingDs.join(", ")}`);
  }

  // ── 2. Transition triggers defined for every step? (20 pts) ───────────────
  const stepsWithTriggers = collab.sequence.filter((s) => s.triggers_next?.trim());
  const triggerScore = Math.round(
    (stepsWithTriggers.length / collab.sequence.length) * 20
  );
  score += triggerScore;
  if (triggerScore === 20) {
    insights.push("✓ All steps have clear transition triggers");
  } else {
    insights.push(
      `⚠ ${collab.sequence.length - stepsWithTriggers.length} step(s) missing transition triggers`
    );
  }

  // ── 3. Loop-back conditions where pattern requires them? (20 pts) ──────────
  const patternNeedsLoops = [
    "linear_with_loops",
    "cyclic",
    "iterative",
    "branching",
  ].includes(collab.pattern);
  const hasLoopBacks = collab.transitions.some((t) => t.is_loop_back);

  if (!patternNeedsLoops) {
    score += 20; // linear — no loops expected
    insights.push("✓ Linear pattern — no loop-backs required");
  } else if (hasLoopBacks) {
    score += 20;
    insights.push("✓ Loop-back conditions are defined");
  } else {
    insights.push(
      `⚠ Pattern is "${collab.pattern}" but no loop-back transitions are defined`
    );
  }

  // ── 4. Canonical dimension order? (20 pts) ─────────────────────────────────
  // Checks that the *first occurrence* of each dimension respects the canonical order.
  const firstStep: Record<string, number> = {};
  collab.sequence.forEach((s) => {
    if (!(s.d in firstStep)) firstStep[s.d] = s.step;
  });

  let orderCorrect = true;
  for (let i = 0; i < canonicalOrder.length - 1; i++) {
    const a = firstStep[canonicalOrder[i]];
    const b = firstStep[canonicalOrder[i + 1]];
    if (a !== undefined && b !== undefined && a > b) {
      orderCorrect = false;
      insights.push(
        `⚠ ${canonicalOrder[i]} (step ${a}) appears after ${canonicalOrder[i + 1]} (step ${b}) — check sequence order`
      );
    }
  }
  if (orderCorrect) {
    score += 20;
    insights.push(`✓ Dimension order follows recommended canonical flow`);
  }

  const patternLabel: Record<string, string> = {
    linear:            "Linear (single pass)",
    linear_with_loops: "Linear with loop-backs",
    cyclic:            "Cyclic (continuous)",
    iterative:         "Iterative (multiple passes)",
    branching:         "Branching (conditional paths)",
  };

  return {
    score,
    summary: `${patternLabel[collab.pattern] ?? collab.pattern} — ${collab.description}`,
    insights,
  };
}

// ── Compliance evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate how well a free-text collaboration description follows a framework's
 * `evaluation_criteria`.  Each criterion declares signal keywords and a
 * pass_threshold; the function checks presence in the lowercased text.
 *
 * Returns:
 *   - `score`   — 0–100 weighted compliance score
 *   - `passed`  — labels of criteria that passed
 *   - `failed`  — labels of criteria that did not pass
 *   - `details` — per-criterion result with matched keywords (useful for steering)
 *
 * When the framework has no evaluation_criteria the score is 0 and all arrays
 * are empty — callers should treat this as "not yet assessable".
 */
export function evaluateCompliance(
  text: string,
  framework: FrameworkDefinition
): {
  score: number;
  passed: string[];
  failed: string[];
  details: Array<{
    id: string;
    dimension?: string;
    label: string;
    passed: boolean;
    matched_signals: string[];
    weight: number;
  }>;
} {
  const criteria = framework.evaluation_criteria ?? [];
  if (criteria.length === 0) {
    return { score: 0, passed: [], failed: [], details: [] };
  }

  const lower = text.toLowerCase();

  const details = criteria.map((criterion) => {
    const presentSignals = criterion.signals?.present ?? [];
    const threshold      = criterion.pass_threshold ?? 1;
    const matched        = presentSignals.filter((s) => lower.includes(s.toLowerCase()));
    const passed         = matched.length >= threshold;
    return {
      id:              criterion.id,
      dimension:       criterion.dimension,
      label:           criterion.label,
      passed,
      matched_signals: matched,
      weight:          criterion.weight,
    };
  });

  // Weighted score: sum of weights for passing criteria / total weight × 100
  const totalWeight  = criteria.reduce((sum, c) => sum + c.weight, 0);
  const passedWeight = details
    .filter((d) => d.passed)
    .reduce((sum, d) => sum + d.weight, 0);

  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;

  return {
    score,
    passed: details.filter((d) =>  d.passed).map((d) => d.label),
    failed: details.filter((d) => !d.passed).map((d) => d.label),
    details,
  };
}

// ── Task scoring ──────────────────────────────────────────────────────────────

/**
 * Score a task against all entries in `knowledgeDir` and return the top 3.
 *
 * Each result contains:
 *   - `entry` — the matched knowledge entry
 *   - `dimensionScores` — 0–100 per dimension (similarity × weight × 400)
 *   - `collaborationScore` / `collaborationSummary` / `collaborationInsights`
 *   - `suggestions` — one actionable antipattern tip per dimension
 *
 * The dimension score formula deliberately keeps scores interpretable:
 * a perfect similarity on a dimension weighted 0.25 yields a score of 100.
 */
export function scoreTask(input: TaskInput, knowledgeDir: string) {
  const entries = loadKnowledgeEntries(knowledgeDir);
  const inputSet = keywordSet(`${input.description} ${input.delegation_intent}`);

  const scored = entries.map((entry) => {
    // Build entry text from title + domain + all dimension descriptions
    const dims = entry.dimensions as Record<string, DimensionValue>;
    const entryText = keywordSet(
      [
        entry.title,
        entry.domain,
        ...Object.values(dims).map((d) => d.description),
      ].join(" ")
    );

    const similarity = cosineSimilarity(inputSet, entryText);

    // Each dimension score is weighted by score_hints so high-signal dimensions
    // contribute more; capped at 100 to keep numbers readable.
    const dimensionScores = Object.fromEntries(
      Object.entries(entry.dimensions).map(([dim, val]) => [
        dim,
        Math.min(
          100,
          Math.round(
            similarity *
              (entry.score_hints[dim as keyof typeof entry.score_hints] ?? 0) *
              400
          )
        ),
      ])
    );

    const collab = scoreCollaboration(entry);
    return {
      entry,
      similarity,
      dimensionScores,
      collaborationScore:    collab.score,
      collaborationSummary:  collab.summary,
      collaborationInsights: collab.insights,
    };
  });

  // Return the 3 closest matches
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, 3).map(
    ({ entry, dimensionScores, collaborationScore, collaborationSummary, collaborationInsights }) => ({
      entry,
      dimensionScores,
      collaborationScore,
      collaborationSummary,
      collaborationInsights,
      suggestions: Object.fromEntries(
        Object.entries(entry.dimensions as Record<string, DimensionValue>).map(([dim, val]) => [
          dim,
          `Improve ${dim}: ${val.antipattern}`,
        ])
      ),
    })
  );
}
