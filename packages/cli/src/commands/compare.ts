/**
 * commands/compare.ts
 *
 * `fluent compare --description <desc> --delegation <intent>` — score a task
 * against the closest community 4D cycle using both description and delegation
 * intent, then display the single best match.
 *
 * delegation_intent narrows the scorer to how much autonomy is given to AI:
 *   automated  — AI decides without human review
 *   augmented  — human and AI collaborate
 *   supervised — human decides, AI assists
 */

import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { scoreTask } from "fluently-scorer";
import { knowledgeDir } from "../utils/paths.js";
import { renderScoreRow, averageScore } from "../utils/display.js";

export function registerCompare(program: Command): void {
  program
    .command("compare")
    .description(
      "Score your task against the closest community 4D cycle.\n\n" +
      "Delegation intent tells the scorer how much you plan to rely on AI:\n" +
      "  automated — AI decides | augmented — AI + human | supervised — human decides\n\n" +
      "Example:\n" +
      '  fluent compare --description "AI reviews PRs for style issues" --delegation "augmented"'
    )
    .requiredOption("--description <desc>", "Plain-language description of the AI task")
    .requiredOption(
      "--delegation <intent>",
      "How much you delegate to AI: automated | augmented | supervised"
    )
    .action(async (opts: { description: string; delegation: string }) => {
      const spinner = ora("Comparing...").start();
      const results = scoreTask(
        { description: opts.description, delegation_intent: opts.delegation },
        knowledgeDir()
      );
      spinner.succeed("Comparison complete\n");

      const top     = results[0];
      const scores  = Object.values(top.dimensionScores) as number[];
      const overall = averageScore(scores);

      console.log(chalk.bold(`Best match: ${top.entry.title}`) + chalk.gray(`  (${top.entry.domain})`));
      console.log(chalk.yellow(`4D Score: ${overall}/100\n`));

      Object.entries(top.dimensionScores).forEach(([dim, score]) => {
        console.log(renderScoreRow(dim, score as number));
      });

      console.log(chalk.blue(`\nYAML: knowledge/${top.entry.domain}-${top.entry.id}.yaml`));
    });
}
