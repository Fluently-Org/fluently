#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';
import { knowledgeEntrySchema } from '../packages/scorer/dist/schema.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');

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
      
      // Validate against Zod schema
      const result = knowledgeEntrySchema.safeParse(data);
      
      if (!result.success) {
        hasErrors = true;
        results.push({
          file,
          status: 'FAIL',
          errors: result.error.flatten().fieldErrors
        });
        console.error(`❌ ${file}`);
        console.error(`   Errors: ${JSON.stringify(result.error.flatten(), null, 2)}`);
      } else {
        results.push({
          file,
          status: 'PASS',
          entry: result.data
        });
        console.log(`✅ ${file}`);
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
