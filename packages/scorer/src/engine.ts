import { knowledgeEntrySchema } from "./schema";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export type TaskInput = {
  description: string;
  delegation_intent: string;
};

export function loadKnowledgeEntries(knowledgeDir: string) {
  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith(".yaml"));
  return files.map(file => {
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

export function scoreTask(input: TaskInput, knowledgeDir: string) {
  const entries = loadKnowledgeEntries(knowledgeDir);
  const inputSet = keywordSet(input.description + " " + input.delegation_intent);
  const scored = entries.map(entry => {
    const entrySet = keywordSet(
      entry.title + " " + entry.domain + " " + Object.values(entry.dimensions).map(d => d.description).join(" ")
    );
    const similarity = cosineSimilarity(inputSet, entrySet);
    const dimensionScores = Object.fromEntries(
      Object.entries(entry.dimensions).map(([dim, val]) => [
        dim,
        Math.round(similarity * entry.score_hints[dim] * 100)
      ])
    );
    return {
      entry,
      similarity,
      dimensionScores
    };
  });
  scored.sort((a, b) => b.similarity - a.similarity);
  const top3 = scored.slice(0, 3);
  return top3.map(({ entry, dimensionScores }) => ({
    entry,
    dimensionScores,
    suggestions: Object.fromEntries(
      Object.entries(entry.dimensions).map(([dim, val]) => [
        dim,
        `Improve ${dim}: ${val.antipattern}`
      ])
    )
  }));
}
