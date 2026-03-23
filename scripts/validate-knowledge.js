#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';
import { buildKnowledgeSchemas } from '../packages/scorer/dist/schema.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const FRAMEWORKS_INDEX = path.join(__dirname, '..', 'frameworks', 'index.json');

// Load frameworks index at startup
let frameworksIndex = { frameworks: [] };
try {
  frameworksIndex = JSON.parse(fs.readFileSync(FRAMEWORKS_INDEX, 'utf-8'));
} catch (err) {
  console.warn(`⚠️  Could not load frameworks/index.json: ${err.message}`);
  console.warn('    Falling back to 4d-framework only.');
}

/** Find a framework definition by id, falling back to a minimal 4D definition. */
function findFramework(frameworkId) {
  const found = frameworksIndex.frameworks.find(f => f.id === frameworkId);
  if (found) return found;

  // Hard-coded 4D fallback so validation works even without a built scorer
  return {
    id: '4d-framework',
    name: 'AI Fluency 4D Framework',
    version: '1.0.0',
    contributor: 'Dakan & Feller',
    description: 'Four dimensions of good human-AI collaboration.',
    dimensions: [
      { key: 'delegation',  label: 'Delegation',  description: '', canonical_order: 1 },
      { key: 'description', label: 'Description', description: '', canonical_order: 2 },
      { key: 'discernment', label: 'Discernment', description: '', canonical_order: 3 },
      { key: 'diligence',   label: 'Diligence',   description: '', canonical_order: 4 },
    ],
  };
}

let hasErrors = false;
const results = [];

try {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  if (files.length === 0) {
    console.log('ℹ️  No knowledge YAML files found');
    process.exit(0);
  }

  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = YAML.load(content);

      // Determine which framework this entry belongs to (default: 4d-framework)
      const frameworkId = data.framework_id ?? '4d-framework';
      const framework = findFramework(frameworkId);
      const { knowledgeEntrySchema } = buildKnowledgeSchemas(framework);

      // Validate against the framework-specific Zod schema
      const result = knowledgeEntrySchema.safeParse(data);

      if (!result.success) {
        hasErrors = true;
        results.push({
          file,
          status: 'FAIL',
          errors: result.error.flatten().fieldErrors
        });
        console.error(`❌ ${file} [framework: ${frameworkId}]`);
        console.error(`   Errors: ${JSON.stringify(result.error.flatten(), null, 2)}`);
      } else {
        results.push({
          file,
          status: 'PASS',
          entry: result.data
        });
        console.log(`✅ ${file} [framework: ${frameworkId}]`);
      }
    } catch (err) {
      hasErrors = true;
      results.push({
        file,
        status: 'ERROR',
        message: err.message
      });
      console.error(`❌ ${file}: ${err.message}`);
    }
  }

  const summary = `\n📊 Validation Summary: ${results.filter(r => r.status === 'PASS').length}/${results.length} passed`;
  console.log(summary);

  if (hasErrors) {
    process.exit(1);
  }
} catch (err) {
  console.error('Fatal error during validation:', err.message);
  process.exit(1);
}
