/**
 * commands/sync.ts
 *
 * `fluent sync` — pull the latest 4D cycles from the upstream GitHub repo
 * into the local checkout so scoring and comparison use fresh data.
 *
 * This command only makes sense in a source checkout, not in a global npm
 * install. For npm installs, run `npm update -g fluently-cli` instead.
 */

import { Command } from "commander";
import { execSync } from "child_process";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import fs from "fs";
import { knowledgeDir } from "../utils/paths.js";

export function registerSync(program: Command): void {
  program
    .command("sync")
    .description(
      "Pull the latest 4D cycles from the upstream GitHub repo.\n\n" +
      "Run this after new community cycles are merged to get fresh scoring data.\n" +
      "For a global npm install, use `npm update -g fluently-cli` instead."
    )
    .action(() => {
      const spinner = ora("Syncing knowledge from upstream…").start();

      try {
        // Resolve the repo root — __dirname is dist/commands/; root is 4 levels up
        const repoRoot = path.resolve(__dirname, "../../../../");
        execSync("git pull", { cwd: repoRoot, stdio: "pipe" });
      } catch (err: any) {
        spinner.fail("git pull failed — are you in a source checkout?");
        console.log(chalk.red(err.message));
        return;
      }

      const dir   = knowledgeDir();
      const count = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).length
        : 0;

      spinner.succeed(`Sync complete — ${count} cycles available`);
    });
}
