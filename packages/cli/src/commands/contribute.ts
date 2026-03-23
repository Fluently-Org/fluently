/**
 * commands/contribute.ts
 *
 * `fluent contribute` — interactive wizard that walks the user through each
 * dimension of the selected framework, validates the result against the Zod
 * schema, then writes a YAML file ready to be committed and PR'd.
 */

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { buildKnowledgeSchemas, BUNDLED_4D_FRAMEWORK } from "@fluently/scorer/schema";
import { checkPrivacy } from "@fluently/scorer";
import type { FrameworkDefinition } from "@fluently/scorer";

const DOMAINS = ["coding", "writing", "research", "customer-support", "education", "legal", "healthcare", "general"] as const;

/** Load framework definitions from the frameworks/ directory. */
function loadFrameworks(): FrameworkDefinition[] {
  // __dirname is the compiled dist/commands/ dir
  const frameworksDir = path.resolve(__dirname, "../../../frameworks");
  if (!fs.existsSync(frameworksDir)) return [BUNDLED_4D_FRAMEWORK];

  try {
    const indexPath = path.join(frameworksDir, "index.json");
    if (!fs.existsSync(indexPath)) return [BUNDLED_4D_FRAMEWORK];

    const raw = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { frameworks: FrameworkDefinition[] };
    return raw.frameworks.length > 0 ? raw.frameworks : [BUNDLED_4D_FRAMEWORK];
  } catch {
    return [BUNDLED_4D_FRAMEWORK];
  }
}

export function registerContribute(program: Command): void {
  program
    .command("contribute")
    .description(
      "Build a new cycle interactively and save it as validated YAML.\n\n" +
      "Walks you through selecting a framework, then each dimension —\n" +
      "validates schema before writing the file.\n" +
      "Open a PR against Fluently-Org/fluently to share with the community."
    )
    .action(async () => {
      // ── Step 0: Framework selection ────────────────────────────────────────
      const frameworks = loadFrameworks();
      let selectedFramework: FrameworkDefinition = BUNDLED_4D_FRAMEWORK;

      if (frameworks.length > 1) {
        const { frameworkId } = await inquirer.prompt([{
          type: "list",
          name: "frameworkId",
          message: "Which framework are you contributing to?",
          choices: frameworks.map(f => ({
            name: `${f.name} (${f.id}) — ${f.dimensions.length} dimensions`,
            value: f.id,
          })),
        }]);
        selectedFramework = frameworks.find(f => f.id === frameworkId) ?? BUNDLED_4D_FRAMEWORK;
      } else {
        console.log(chalk.cyan(`Using framework: ${selectedFramework.name}`));
      }

      const DIMENSIONS = selectedFramework.dimensions
        .sort((a, b) => a.canonical_order - b.canonical_order)
        .map(d => d.key);

      // ── Step 1: Basic metadata ─────────────────────────────────────────────
      const basic = await inquirer.prompt([
        { type: "input", name: "id",          message: "Slug (unique kebab-case id):" },
        { type: "input", name: "title",        message: "Title:" },
        { type: "list",  name: "domain",       message: "Domain:", choices: [...DOMAINS] },
        { type: "input", name: "tags",         message: "Tags (comma-separated):" },
        { type: "input", name: "contributor",  message: "Contributor name:" },
        { type: "input", name: "version",      message: "Version (semver):", default: "1.0.0" },
      ]);

      // ── Step 2: Framework dimensions ──────────────────────────────────────
      const dimensions: Record<string, unknown> = {};
      for (const dim of DIMENSIONS) {
        const dimDef = selectedFramework.dimensions.find(d => d.key === dim);
        const label = dimDef?.label ?? dim;
        console.log(chalk.bold.cyan(`\n— ${label.toUpperCase()} —`));
        if (dimDef?.description) {
          console.log(chalk.gray(`  ${dimDef.description}`));
        }
        dimensions[dim] = await inquirer.prompt([
          { type: "input", name: "description", message: `What does good ${label} look like?` },
          { type: "input", name: "example",     message: `Concrete example of good ${label}:` },
          { type: "input", name: "antipattern", message: `What is the most common ${label} mistake?` },
        ]);
      }

      // ── Step 3: Dimension weights (must sum to 1.0) ────────────────────────
      console.log(chalk.bold.cyan("\n— SCORE HINTS (weights must sum to 1.0) —"));
      const hintsRaw = await inquirer.prompt(
        DIMENSIONS.map((dim) => ({
          type: "input",
          name: dim,
          message: `Weight for ${dim} (0–1):`,
        }))
      );

      // ── Assemble and validate ──────────────────────────────────────────────
      const candidate = {
        ...basic,
        framework_id: selectedFramework.id,
        tags: basic.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
        dimensions,
        score_hints: Object.fromEntries(
          Object.entries(hintsRaw).map(([k, v]) => [k, parseFloat(v as string)])
        ),
      };

      const { knowledgeEntrySchema } = buildKnowledgeSchemas(selectedFramework);

      try {
        knowledgeEntrySchema.parse(candidate);
      } catch (err: any) {
        console.log(chalk.red("\nValidation failed:"));
        (err.errors ?? [err]).forEach((e: any) => console.log(chalk.red(`  • ${e.message ?? e}`)));
        return;
      }

      // ── Privacy / confidentiality check ────────────────────────────────────
      const privacy = checkPrivacy(candidate, { mode: "standard" });

      if (privacy.blocks.length > 0) {
        console.log(chalk.red.bold("\n🔒  Privacy check FAILED — the following must be fixed:\n"));
        privacy.blocks.forEach(issue => {
          console.log(chalk.red(`  ✗ [${issue.field}] ${issue.description}`));
          console.log(chalk.red(`      Found:  ${issue.redactedMatch}`));
          console.log(chalk.yellow(`      Fix:    ${issue.suggestion}\n`));
        });
        console.log(chalk.red("No file written. Fix all blocking issues and run contribute again."));
        return;
      }

      if (privacy.warnings.length > 0) {
        console.log(chalk.yellow.bold("\n⚠️   Privacy warnings — please review:\n"));
        privacy.warnings.forEach(issue => {
          console.log(chalk.yellow(`  ⚠ [${issue.field}] ${issue.description}`));
          console.log(chalk.yellow(`      Found:  ${issue.redactedMatch}`));
          console.log(chalk.gray(`      Fix:    ${issue.suggestion}\n`));
        });

        const { proceed } = await inquirer.prompt([{
          type:    "confirm",
          name:    "proceed",
          message: "These warnings may indicate private or sensitive content. Proceed anyway?",
          default: false,
        }]);

        if (!proceed) {
          console.log(chalk.yellow("Aborted. Edit the cycle to resolve the warnings and try again."));
          return;
        }
      }

      // ── Write YAML ─────────────────────────────────────────────────────────
      // __dirname is the compiled dist/commands/ dir; knowledge is at dist/../../knowledge
      const outputDir  = path.resolve(__dirname, "../../../knowledge");
      const outputFile = path.join(outputDir, `${candidate.domain}-${candidate.id}.yaml`);

      fs.writeFileSync(outputFile, yaml.dump(candidate, { lineWidth: 100 }));
      console.log(chalk.green(`\n✅  Cycle written to ${outputFile}`));
      if (privacy.warnings.length > 0) {
        console.log(chalk.yellow("⚠️  You acknowledged privacy warnings — double-check the YAML before opening a PR."));
      }
      console.log(chalk.yellow("Next: git add . && git commit -m 'feat(knowledge): add <your-id>'"));
      console.log(chalk.yellow("Then open a PR to Fluently-Org/fluently"));
    });
}
