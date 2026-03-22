/**
 * commands/list.ts
 *
 * `fluent list [domain]` — browse all community 4D cycles, optionally
 * filtered by domain.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadKnowledgeEntries } from "@fluently/scorer";
import { knowledgeDir } from "../utils/paths.js";

export function registerList(program: Command): void {
  program
    .command("list")
    .description(
      "Browse all community 4D cycles in the knowledge base.\n\n" +
      "Filter by domain to narrow results to your field.\n" +
      "Domains: coding · writing · research · education · legal · healthcare · general\n\n" +
      "Examples:\n" +
      "  fluent list\n" +
      "  fluent list coding"
    )
    .argument(
      "[domain]",
      "Filter by domain: coding | writing | research | education | legal | healthcare | general"
    )
    .action((domain?: string) => {
      const entries = loadKnowledgeEntries(knowledgeDir());
      const filtered = domain ? entries.filter((e) => e.domain === domain) : entries;

      if (filtered.length === 0) {
        console.log(chalk.yellow(`No cycles found${domain ? ` for domain "${domain}"` : ""}.`));
        return;
      }

      filtered.forEach((e) => {
        console.log(
          `${chalk.bold(e.title)} | ${chalk.cyan(e.domain)} | ${chalk.yellow(e.tags.join(", "))} | ${chalk.magenta(e.contributor)}`
        );
      });
    });
}
