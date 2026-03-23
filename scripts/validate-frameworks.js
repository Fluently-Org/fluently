#!/usr/bin/env node
/**
 * validate-frameworks.js
 *
 * Validates every YAML file in the frameworks/ directory against
 * the frameworkDefinitionSchema from @fluently/scorer/schema.
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { frameworkDefinitionSchema } from "../packages/scorer/dist/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frameworksDir = resolve(__dirname, "../frameworks");

const files = readdirSync(frameworksDir).filter(f => f.endsWith(".yaml"));
let passed = 0;
let failed = 0;

console.log(`\nValidating ${files.length} framework(s) in frameworks/\n`);

for (const file of files) {
  const filePath = resolve(frameworksDir, file);
  try {
    const raw = yaml.load(readFileSync(filePath, "utf8"));
    frameworkDefinitionSchema.parse(raw);
    console.log(`  ✅ ${file}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${file}: ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
