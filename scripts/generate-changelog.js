#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateChangelog() {
  try {
    // Get last tag
    let lastTag = '';
    try {
      const { stdout } = await execAsync('git describe --tags --abbrev=0 2>/dev/null || echo ""');
      lastTag = stdout.trim();
    } catch {
      // No previous tag
    }

    let logCommand = 'git log --oneline --pretty=format:"%h - %s"';
    if (lastTag) {
      logCommand += ` ${lastTag}..HEAD`;
    } else {
      logCommand += ' --all';
    }

    const { stdout: commits } = await execAsync(logCommand);
    
    const changelog = `
## Changes

${commits
  .split('\n')
  .filter(line => line.trim())
  .map(line => `- ${line}`)
  .join('\n')}

## Installation

### CLI
\`\`\`bash
npm install -g fluently-cli
# or zero-install:
npx fluently-cli --help
\`\`\`

### MCP Server
\`\`\`bash
npm install fluently-mcp-server
\`\`\`

---
**Thank you to all contributors!** 🎉
`.trim();

    console.log(changelog);
  } catch (err) {
    console.error('Error generating changelog:', err.message);
    console.log('## No changes detected in this release');
  }
}

generateChangelog().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
