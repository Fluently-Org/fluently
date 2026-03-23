/**
 * commands/list.ts
 *
 * `fluent list [domain]` — browse all community cycles, optionally
 * filtered by domain and/or framework.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadKnowledgeEntries } from "@fluently/scorer";
import { knowledgeDir } from "../utils/paths.js";

export function registerList(program: Command): void {
  program
    .command("list")
    .description(
      "Browse all community cycles in the knowledge base.\n\n" +
      "Filter by domain to narrow results to your field.\n" +
      "Filter by framework to show only cycles from a specific framework.\n" +
      "Domains: coding · writing · research · education · legal · healthcare · general\n\n" +
      "Examples:\n" +
      "  fluent list\n" +
      "  fluent list coding\n" +
      "  fluent list --framework 4d-framework\n" +
      "  fluent list coding --framework 4d-framework"
    )
    .argument(
      "[domain]",
      "Filter by domain: coding | writing | research | education | legal | healthcare | general"
    )
    .option(
      "--framework <id>",
      "Filter by framework id (e.g. 4d-framework)"
    )
    .action((domain?: string, options?: { framework?: string }) => {
      const entries = loadKnowledgeEntries(knowledgeDir());
      let filtered = domain ? entries.filter((e) => e.domain === domain) : entries;

      if (options?.framework) {
        filtered = filtered.filter(
          (e) => (e as any).framework_id === options.framework ||
            // Legacy entries without framework_id default to "4d-framework"
            (!((e as any).framework_id) && options.framework === "4d-framework")
        );
      }

      if (filtered.length === 0) {
        const filters = [
          domain ? `domain "${domain}"` : null,
          options?.framework ? `framework "${options.framework}"` : null,
        ].filter(Boolean).join(" and ");
        console.log(chalk.yellow(`No cycles found${filters ? ` for ${filters}` : ""}.`));
        return;
      }

      filtered.forEach((e) => {
        const frameworkId = (e as any).framework_id ?? "4d-framework";
        console.log(
          `${chalk.bold(e.title)} | ${chalk.cyan(e.domain)} | ${chalk.blue(`[${frameworkId}]`)} | ${chalk.yellow(e.tags.join(", "))} | ${chalk.magenta(e.contributor)}`
        );
      });
    });
}
