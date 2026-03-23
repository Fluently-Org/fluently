/**
 * commands/score.ts
 *
 * `fluent score <task>` — find the 3 community 4D cycles most similar to a
 * plain-language task description.
 *
 * Output: ranked list with per-dimension bar charts and a pointer to the YAML
 * source so the user can read the full guidance.
 */

import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { scoreTask } from "fluently-scorer";
import { knowledgeDir } from "../utils/paths.js";
import { renderScoreRow, renderEntryHeader, averageScore } from "../utils/display.js";

export function registerScore(program: Command): void {
  program
    .command("score")
    .description(
      "Find the 3 community 4D cycles most similar to your task.\n\n" +
      "Scores each match across Delegation, Description, Discernment, and Diligence (0–100).\n" +
      "Use this to discover existing patterns you can extend or adapt.\n\n" +
      "Example:\n" +
      '  fluent score "AI generates a first draft, human edits and publishes"'
    )
    .argument("<task>", "Plain-language description of the AI task")
    .action(async (task: string) => {
      const spinner = ora("Scoring task...").start();
      const results = scoreTask({ description: task, delegation_intent: "" }, knowledgeDir());
      spinner.succeed("Score complete\n");

      results.forEach(({ entry, dimensionScores }, i) => {
        const scores  = Object.values(dimensionScores) as number[];
        const overall = averageScore(scores);

        console.log(renderEntryHeader(i + 1, entry.title, entry.domain, overall));

        Object.entries(dimensionScores).forEach(([dim, score]) => {
          console.log(renderScoreRow(dim, score as number));
        });

        console.log(chalk.gray(`  → knowledge/${entry.domain}-${entry.id}.yaml\n`));
      });
    });
}
