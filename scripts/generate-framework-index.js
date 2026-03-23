#!/usr/bin/env node
/**
 * generate-framework-index.js
 *
 * Reads all YAML files from frameworks/, validates them,
 * and writes frameworks/index.json.
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { frameworkDefinitionSchema } from "../packages/scorer/dist/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frameworksDir = resolve(__dirname, "../frameworks");

const files = readdirSync(frameworksDir).filter(f => f.endsWith(".yaml"));
const frameworks = [];

for (const file of files) {
  const raw = yaml.load(readFileSync(resolve(frameworksDir, file), "utf8"));
  const parsed = frameworkDefinitionSchema.parse(raw);
  frameworks.push(parsed);
}

const index = {
  generated: new Date().toISOString(),
  total: frameworks.length,
  frameworks,
};

writeFileSync(resolve(frameworksDir, "index.json"), JSON.stringify(index, null, 2));
console.log(`Generated frameworks/index.json with ${frameworks.length} framework(s)`);
