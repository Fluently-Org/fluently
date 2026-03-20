#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scoreTask } from '../packages/scorer/src/engine.js';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');

async function getChangedFiles() {
  try {
    const { stdout } = await execAsync('git diff --name-only --diff-filter=A origin/main...HEAD');
    return stdout
      .split('\n')
      .filter(f => f.startsWith('knowledge/') && (f.endsWith('.yaml') || f.endsWith('.yml')))
      .map(f => f.replace('knowledge/', ''));
  } catch {
    return [];
  }
}

async function scoreNewEntries() {
  const changedFiles = await getChangedFiles();
  
  if (changedFiles.length === 0) {
    console.log('ℹ️  No new knowledge entries added');
    return '';
  }

  const scores = [];

  for (const file of changedFiles) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry = YAML.load(content);
      
      // Score the entry
      const result = scoreTask(
        {
          description: entry.dimensions?.description?.description || entry.title,
          delegation_intent: entry.dimensions?.delegation?.description || 'unknown'
        },
        KNOWLEDGE_DIR
      );

      // Calculate overall score from top result's dimensionScores
      const topScores = result[0]?.dimensionScores || {};
      const avgScore = (
        (topScores.delegation || 0) +
        (topScores.description || 0) +
        (topScores.discernment || 0) +
        (topScores.diligence || 0)
      ) / 4;

      scores.push(`- **${entry.title}** (${entry.domain}): ${avgScore.toFixed(1)}/100`);
    } catch (err) {
      console.error(`Error scoring ${file}:`, err.message);
    }
  }

  if (scores.length > 0) {
    const output = scores.join('\n');
    console.log('::set-output name=scores::' + output.replace(/\n/g, '%0A'));
    return output;
  }

  return '';
}

scoreNewEntries().catch(err => {
  console.error('Fatal error scoring entries:', err);
  process.exit(1);
});
