import { knowledgeEntrySchema } from "./schema";
const fs = require("fs");
const path = require("path");
import yaml from "js-yaml";

export type TaskInput = {
  description: string;
  delegation_intent: string;
};

export function loadKnowledgeEntries(knowledgeDir: string) {
  const files = fs.readdirSync(knowledgeDir).filter((f: string) => f.endsWith(".yaml"));
  return files.map((file: string) => {
    const content = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
    const entry = yaml.load(content);
    return knowledgeEntrySchema.parse(entry);
  });
}

function keywordSet(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
}

function cosineSimilarity(setA: Set<string>, setB: Set<string>) {
  const all = new Set([...setA, ...setB]);
  let dot = 0, magA = 0, magB = 0;
  for (const word of all) {
    const a = setA.has(word) ? 1 : 0;
    const b = setB.has(word) ? 1 : 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

// ── Collaboration sequence scoring ────────────────────────────────────────────
// Scores the quality of a cycle's collaboration block — how well the sequence
// of D-clusters covers all four dimensions, has clear triggers, and defines
// loop-back conditions. Returns a 0–100 score and a short summary.

export function scoreCollaboration(entry: ReturnType<typeof knowledgeEntrySchema.parse>): {
  score: number;
  summary: string;
  insights: string[];
} {
  const collab = entry.collaboration;
  if (!collab) {
    return {
      score: 0,
      summary: "No collaboration sequence defined — add a collaboration block to capture the conversation flow.",
      insights: ["Missing collaboration block"],
    };
  }

  const insights: string[] = [];
  let score = 0;

  // 1. All 4 Ds represented in the sequence? (40 pts)
  const dsPresent = new Set(collab.sequence.map(s => s.d));
  const allDs: Array<"delegation" | "description" | "discernment" | "diligence"> =
    ["delegation", "description", "discernment", "diligence"];
  const missingDs = allDs.filter(d => !dsPresent.has(d));
  if (missingDs.length === 0) {
    score += 40;
    insights.push("✓ All 4 dimensions are represented in the sequence");
  } else {
    score += (4 - missingDs.length) * 10;
    insights.push(`⚠ Missing D-clusters: ${missingDs.join(", ")}`);
  }

  // 2. Triggers defined for each step? (20 pts)
  const stepsWithTriggers = collab.sequence.filter(s => s.triggers_next?.trim());
  const triggerScore = Math.round((stepsWithTriggers.length / collab.sequence.length) * 20);
  score += triggerScore;
  if (triggerScore === 20) {
    insights.push("✓ All steps have clear transition triggers");
  } else {
    insights.push(`⚠ ${collab.sequence.length - stepsWithTriggers.length} step(s) missing transition triggers`);
  }

  // 3. Loop-back conditions defined (where pattern allows)? (20 pts)
  const hasLoopBacks = collab.transitions.some(t => t.is_loop_back);
  const patternNeedsLoops = ["linear_with_loops", "cyclic", "iterative", "branching"].includes(collab.pattern);
  if (!patternNeedsLoops) {
    score += 20; // linear pattern — no loops expected
    insights.push("✓ Linear pattern — no loop-backs required");
  } else if (hasLoopBacks) {
    score += 20;
    insights.push("✓ Loop-back conditions are defined");
  } else {
    insights.push(`⚠ Pattern is "${collab.pattern}" but no loop-back transitions are defined`);
  }

  // 4. Sequence order follows recommended flow: Del → Des → Dis → Dil? (20 pts)
  // The canonical first occurrence of each D should respect: Del before Des before Dis before Dil
  const firstOccurrence: Record<string, number> = {};
  collab.sequence.forEach(s => {
    if (!(s.d in firstOccurrence)) firstOccurrence[s.d] = s.step;
  });
  const recommended = ["delegation", "description", "discernment", "diligence"];
  let orderCorrect = true;
  for (let i = 0; i < recommended.length - 1; i++) {
    const a = firstOccurrence[recommended[i]];
    const b = firstOccurrence[recommended[i + 1]];
    if (a !== undefined && b !== undefined && a > b) {
      orderCorrect = false;
      insights.push(`⚠ ${recommended[i]} (step ${a}) appears after ${recommended[i + 1]} (step ${b}) — check sequence order`);
    }
  }
  if (orderCorrect) {
    score += 20;
    insights.push("✓ D-cluster order follows recommended Del → Des → Dis → Dil flow");
  }

  const patternLabel: Record<string, string> = {
    linear: "Linear (single pass)",
    linear_with_loops: "Linear with loop-backs",
    cyclic: "Cyclic (continuous)",
    iterative: "Iterative (multiple passes)",
    branching: "Branching (conditional paths)",
  };

  return {
    score,
    summary: `${patternLabel[collab.pattern] ?? collab.pattern} — ${collab.description}`,
    insights,
  };
}

export function scoreTask(input: TaskInput, knowledgeDir: string) {
  const entries = loadKnowledgeEntries(knowledgeDir);
  const inputSet = keywordSet(input.description + " " + input.delegation_intent);
  const scored = entries.map((entry: any) => {
    const entrySet = keywordSet(
      entry.title + " " + entry.domain + " " + Object.values(entry.dimensions).map((d: any) => d.description).join(" ")
    );
    const similarity = cosineSimilarity(inputSet, entrySet);
    const dimensionScores = Object.fromEntries(
      Object.entries(entry.dimensions).map(([dim, val]: [string, any]) => [
        dim,
        Math.min(100, Math.round(similarity * (entry.score_hints[dim as keyof typeof entry.score_hints] ?? 0) * 400))
      ])
    );
    const collabResult = scoreCollaboration(entry);
    return {
      entry,
      similarity,
      dimensionScores,
      collaborationScore: collabResult.score,
      collaborationSummary: collabResult.summary,
      collaborationInsights: collabResult.insights,
    };
  });
  scored.sort((a, b) => b.similarity - a.similarity);
  const top3 = scored.slice(0, 3);
  return top3.map(({ entry, dimensionScores, collaborationScore, collaborationSummary, collaborationInsights }) => ({
    entry,
    dimensionScores,
    collaborationScore,
    collaborationSummary,
    collaborationInsights,
    suggestions: Object.fromEntries(
      Object.entries(entry.dimensions).map(([dim, val]: [string, any]) => [
        dim,
        `Improve ${dim}: ${val.antipattern}`
      ])
    )
  }));
}
