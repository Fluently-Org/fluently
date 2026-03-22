/**
 * packages/cli/src/index.ts
 *
 * Entry point for the `fluent` CLI.
 *
 * This file intentionally contains no business logic — it only wires the
 * Commander program to the individual command modules. Adding a new command:
 *   1. Create packages/cli/src/commands/<name>.ts
 *   2. Export a `register<Name>(program)` function
 *   3. Import and call it here
 */

import { Command } from "commander";
import { registerScore }      from "./commands/score.js";
import { registerCompare }    from "./commands/compare.js";
import { registerList }       from "./commands/list.js";
import { registerContribute } from "./commands/contribute.js";
import { registerSync }       from "./commands/sync.js";

const program = new Command();

program
  .name("fluent")
  .description(
    "Fluently — AI Fluency 4D Framework CLI\n\n" +
    "Scores your AI tasks against a community knowledge base of validated 4D cycles.\n" +
    "Works with any AI agent: Claude, GPT, Gemini, Mistral, Copilot, and more.\n\n" +
    "Commands:\n" +
    "  score      Find the 3 most similar 4D cycles to your task\n" +
    "  compare    Match your task + delegation intent to the closest cycle\n" +
    "  list       Browse all cycles, optionally filtered by domain\n" +
    "  contribute Build and validate a new 4D cycle interactively, then PR it\n" +
    "  sync       Pull the latest cycles from the upstream GitHub repo"
  )
  .version("0.1.3");

registerScore(program);
registerCompare(program);
registerList(program);
registerContribute(program);
registerSync(program);

program.parseAsync(process.argv);
