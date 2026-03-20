#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const INDEX_PATH = path.join(KNOWLEDGE_DIR, 'index.json');

function generateKnowledgeIndex() {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => 
    (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.')
  );

  const entries = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(KNOWLEDGE_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = YAML.load(content);
      
      entries.push({
        id: data.id,
        title: data.title,
        domain: data.domain,
        file: file,
        dimensions: Object.keys(data.dimensions || {}),
        summary: data.dimensions?.delegation?.description?.slice(0, 200) || '',
        tags: data.tags || [],
        contributor: data.contributor,
        version: data.version || '1.0.0'
      });
    } catch (err) {
      console.warn(`⚠️  Could not index ${file}: ${err.message}`);
    }
  }

  // Group by domain
  const byDomain = {};
  for (const entry of entries) {
    if (!byDomain[entry.domain]) {
      byDomain[entry.domain] = [];
    }
    byDomain[entry.domain].push(entry);
  }

  const index = {
    generated: new Date().toISOString(),
    total: entries.length,
    domains: Object.keys(byDomain),
    entries: entries,
    byDomain: byDomain
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  console.log(`✅ Generated knowledge index: ${entries.length} entries`);
}

try {
  generateKnowledgeIndex();
} catch (err) {
  console.error('Fatal error generating index:', err.message);
  process.exit(1);
}
