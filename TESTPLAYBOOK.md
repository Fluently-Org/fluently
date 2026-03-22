# Fluently Test Playbook

Two paths to interact with the Fluently 4D knowledge base. **GitHub MCP is the default community path** — no server to install, no rebuild needed, works with any AI agent.

| Path | When to use |
|---|---|
| **GitHub MCP** (default) | Community knowledge, no server, agent reads public repo directly |
| **Custom MCP server** | Private knowledge, isolation, offline, automated contributions |

---

## Path A — GitHub MCP (Community, default)

The agent reads the Fluently knowledge base directly from the public GitHub repo using the [GitHub MCP server](https://github.com/github/github-mcp-server). No auth required for reads. Knowledge updates the moment a cycle is merged — no rebuild, no redeploy.

### Wire GitHub MCP

In your agent's MCP config — `~/.claude/settings.json` (Claude Code), `claude_desktop_config.json` (Claude Desktop), or your IDE's MCP settings (VS Code Copilot, Cursor, Continue…):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

> Token is optional for read-only access to the public repo. Required only to open contribution PRs.

### Agent workflow (prompts to give your agent)

```
# Step 1 — Orient (read the guide)
Read the file KNOWLEDGE.md in repo faical-yannick-congo/fluently (main branch).
Tell me what domains are available and how cycles are structured.


# Step 2 — Discover all cycles
Read knowledge/index.json in faical-yannick-congo/fluently.
List all cycles grouped by domain with IDs and tags.


# Step 3 — Deep-read a specific cycle
Read knowledge/coding-code-review-triage.yaml in faical-yannick-congo/fluently.
Summarize the 4D guidance and the most important antipattern.


# Step 4 — Find the best fit for your task
I want to use AI to summarize daily standup notes and flag blockers automatically.
Read knowledge/index.json and the YAML files for the 2–3 most likely matching cycles.
Reason over them and tell me which fits best and why — no numeric scores, just your assessment.


# Step 5 — Contribute a new cycle (requires GitHub token)
I want to contribute a new cycle. Read KNOWLEDGE.md for the schema.
Help me fill in all 4D dimensions for:
  "AI drafts customer support responses, human reviews and sends."
Then open a PR to faical-yannick-congo/fluently adding the YAML file under knowledge/.
```

### Manual spot-checks

```bash
# Verify index.json is live and valid
curl -s "https://raw.githubusercontent.com/faical-yannick-congo/fluently/main/knowledge/index.json" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('total:', d['total'])
print('domains:', list(d['byDomain'].keys()))
"

# Read a specific cycle
curl -s "https://raw.githubusercontent.com/faical-yannick-congo/fluently/main/knowledge/coding-code-review-triage.yaml"

# Read the agent orientation guide
curl -s "https://raw.githubusercontent.com/faical-yannick-congo/fluently/main/KNOWLEDGE.md" | head -50
```

---

## Path B — Custom MCP Server

Use when you need private knowledge, offline access, or automated PRs without leaving the agent.

### Prerequisites

```bash
# From source (dev)
npm ci
npm run build -w packages/scorer
npm run build -w packages/mcp-server

# Or globally from npm
npm install -g fluently-mcp-server
```

### Run the server

```bash
# Default: github-public connector (live knowledge, no auth)
node packages/mcp-server/dist/bin.js

# Local connector (offline / private knowledge)
FLUENTLY_CONNECTOR=local \
FLUENTLY_LOCAL_PATH=./knowledge \
node packages/mcp-server/dist/bin.js

# Private GitHub repo
FLUENTLY_CONNECTOR=github-private \
FLUENTLY_GITHUB_REPO=your-org/your-knowledge-repo \
FLUENTLY_GITHUB_TOKEN=ghp_xxx \
node packages/mcp-server/dist/bin.js
```

### Tool tests (copy-paste each line)

```bash
# 1. List all tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node packages/mcp-server/dist/bin.js 2>/dev/null \
  | python3 -c "import sys,json; print([t['name'] for t in json.load(sys.stdin)['result']['tools']])"

# Expected: ['list_domains', 'find_relevant_cycles', 'get_cycle_detail',
#            'get_collaboration_pattern', 'get_dimension_guidance',
#            'refresh_knowledge', 'contribute_cycle']


# 2. List domains and cycle counts
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_domains","arguments":{}}}' \
  | node packages/mcp-server/dist/bin.js 2>/dev/null \
  | python3 -c "
import sys,json
c = json.loads(json.load(sys.stdin)['result']['content'][0]['text'])
print(c['source'], '|', c['total'], 'cycles'); print(c['summary'])
"
# Expected: source=github-public | 16 cycles, breakdown by domain


# 3. Find relevant cycles for a task
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"find_relevant_cycles","arguments":{"task_description":"AI reviews pull requests for code quality","domain":"coding","limit":3}}}' \
  | node packages/mcp-server/dist/bin.js 2>/dev/null \
  | python3 -c "
import sys,json
c = json.loads(json.load(sys.stdin)['result']['content'][0]['text'])
for x in c['cycles']: print(x['id'], '-', x['title'])
"
# Expected: ranked list of coding cycles (e.g. code-review-triage first)


# 4. Get full cycle detail
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_cycle_detail","arguments":{"id":"code-review-triage"}}}' \
  | node packages/mcp-server/dist/bin.js 2>/dev/null \
  | python3 -c "
import sys,json
c = json.loads(json.load(sys.stdin)['result']['content'][0]['text'])['cycle']
print(c['title'], '|', c['domain'])
for d in ['delegation','description','discernment','diligence']:
  print(f'  {d}: {c[\"dimensions\"][d][\"antipattern\"]}')
"
# Expected: title + 4 antipattern lines


# 5. Get dimension guidance across a domain
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_dimension_guidance","arguments":{"dimension":"discernment","domain":"coding"}}}' \
  | node packages/mcp-server/dist/bin.js 2>/dev/null \
  | python3 -c "
import sys,json
c = json.loads(json.load(sys.stdin)['result']['content'][0]['text'])
print(c['dimension'], 'in', c['domain'])
for g in c['guidance']: print(' -', g['cycle'], '|', g['antipattern'])
"
# Expected: discernment antipatterns for all coding cycles


# 6. Contribute a cycle — validation error (missing fields)
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"contribute_cycle","arguments":{"cycle":{"id":"bad","title":"Incomplete"}}}}' \
  | node packages/mcp-server/dist/bin.js 2>/dev/null \
  | python3 -c "
import sys,json
c = json.loads(json.load(sys.stdin)['result']['content'][0]['text'])
print('success:', c['success']); print('message:', c['message'])
"
# Expected: success=False, validation errors listing missing required fields


# 7. Force refresh knowledge from connector
echo '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"refresh_knowledge","arguments":{}}}' \
  | node packages/mcp-server/dist/bin.js 2>/dev/null \
  | python3 -c "
import sys,json
c = json.loads(json.load(sys.stdin)['result']['content'][0]['text'])
print(c['message'])
"
# Expected: "Knowledge base refreshed from github-public. 16 cycles now available."
```

### Wire to any MCP client

Same config block for all clients — drop it into:
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
- Claude Code: `~/.claude/settings.json`
- VS Code Copilot / Cursor / Continue: check extension MCP settings

```json
{
  "mcpServers": {
    "fluently": { "command": "fluently-mcp-server" }
  }
}
```

With private knowledge:
```json
{
  "mcpServers": {
    "fluently": {
      "command": "fluently-mcp-server",
      "env": {
        "FLUENTLY_CONNECTOR": "github-private",
        "FLUENTLY_GITHUB_REPO": "your-org/your-knowledge-repo",
        "FLUENTLY_GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

### Claude Code (alternative path)

In `.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "mcpServers": {
    "fluently": { "command": "fluently-mcp-server" }
  }
}
```

---

## Quick comparison

| | GitHub MCP (default) | Custom MCP server |
|---|---|---|
| **Setup** | Add GitHub MCP server config | `npm install -g fluently-mcp-server` |
| **Auth** | Optional for reads, required for PR | None for community, token for private |
| **Knowledge source** | Direct repo file reads (always current) | Live GitHub fetch + 1h cache + offline fallback |
| **Private knowledge** | Only if repo is private | Yes — private repo, fork, local, SQL/NoSQL |
| **Contribution** | Agent opens PR via GitHub MCP | `contribute_cycle` tool (automated or instructions) |
| **Offline** | No | Yes — bundled fallback |
| **Scoring** | None — agent reasons over raw YAML | None — agent reasons over ranked candidates |
