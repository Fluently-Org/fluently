# fluently-mcp-server

**MCP server for [Fluently](https://fluently-org.github.io/fluently/) — exposes knowledge retrieval and contribution tools so any AI agent can find, reason over, and extend collaboration cycles across any registered framework, without hardcoded scores.**

Framework-agnostic. Bundles the AI Fluency 4D Framework as the default. Any framework with named dimensions can be registered.

Works with Claude, GPT-4o, Gemini, Mistral, Llama, GitHub Copilot, Cursor, Cline, and any other MCP-compatible agent.

[![npm version](https://img.shields.io/npm/v/fluently-mcp-server.svg)](https://www.npmjs.com/package/fluently-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

---

## Install

```bash
npm install -g fluently-mcp-server
```

Requires Node.js 20+.

---

## Wire to your agent

The same config block works for any MCP-compatible client. The server speaks stdio.

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "fluently": { "command": "fluently-mcp-server" }
  }
}
```

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "fluently": { "command": "fluently-mcp-server" }
  }
}
```

**VS Code Copilot / Continue / Cursor / Cline** — paste the same block into your extension's MCP settings.

---

## Tools

| Tool | Purpose |
|------|---------|
| `list_domains` | List available knowledge domains and cycle counts |
| `find_relevant_cycles` | Retrieve ranked candidate cycles for a task — agent reasons, no false-precision scores |
| `get_cycle_detail` | Full cycle by ID — all dimension fields for its registered framework |
| `get_dimension_guidance` | Antipatterns + examples for one dimension across all cycles |
| `refresh_knowledge` | Re-fetch from the connector without restarting the server |
| `contribute_cycle` | Validate a new cycle and submit it to the knowledge source |

---

## Connectors

Set `FLUENTLY_CONNECTOR` to choose where knowledge comes from.

### `github-public` (default)

Fetches live from the public community repo. No auth required.

```bash
# Default — no configuration needed
fluently-mcp-server

# Point to a public fork
FLUENTLY_CONNECTOR=github-public \
FLUENTLY_GITHUB_REPO=your-org/your-fork \
fluently-mcp-server
```

`contribute_cycle` returns a YAML template + PR instructions for the community repo.

### `github-private`

Fetches from a private GitHub repo. Requires a PAT with `repo` scope.
`contribute_cycle` creates branches and opens PRs automatically.

```bash
FLUENTLY_CONNECTOR=github-private \
FLUENTLY_GITHUB_REPO=your-org/your-private-knowledge \
FLUENTLY_GITHUB_TOKEN=ghp_xxx \
fluently-mcp-server
```

### `local`

Reads from a local directory — ideal for development, air-gapped environments, or building private cycles before publishing.

```bash
FLUENTLY_CONNECTOR=local \
FLUENTLY_LOCAL_PATH=/path/to/your/knowledge \
fluently-mcp-server
```

`contribute_cycle` writes YAML directly to the configured directory.

### `sql` _(planned)_

PostgreSQL / SQLite. Coming in a future release.

### `nosql` _(planned)_

MongoDB. Coming in a future release.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLUENTLY_CONNECTOR` | `github-public` | Connector to use |
| `FLUENTLY_GITHUB_REPO` | `Fluently-Org/fluently` | GitHub repo (`owner/repo`) |
| `FLUENTLY_GITHUB_BRANCH` | `main` | Branch to read from |
| `FLUENTLY_GITHUB_TOKEN` | _(none)_ | Required for private repos and automated PRs |
| `FLUENTLY_LOCAL_PATH` | `./knowledge` | Local knowledge directory (local connector only) |

---

## Why no scores?

Numeric scores (e.g., "delegation: 34/100") are biased by writing style — two people describing the same workflow in different vocabulary get different numbers.

The server does **retrieval**: it surfaces the most relevant cycles using keyword similarity and returns them for your agent to reason over in context. You assess fit. That's more accurate, and it adapts to what your situation actually needs rather than returning a false-precision number.

---

## When to use this vs. GitHub MCP

If you only need occasional lookups from the public knowledge base, the raw [`index.json`](https://raw.githubusercontent.com/Fluently-Org/fluently/main/knowledge/index.json) is fetchable without auth via any HTTP tool.

Use this server when you need:
- Private knowledge that stays in your org
- Isolation from the community repo
- Structured tools (domain listing, dimension guidance, contribute flow)
- Automatic sync and refresh without restarting your agent

---

## Links

- **Knowledge Base** — [fluently-org.github.io/fluently/knowledge.html](https://fluently-org.github.io/fluently/knowledge.html)
- **Contribute a cycle** — [fluently-org.github.io/fluently/contribute.html](https://fluently-org.github.io/fluently/contribute.html)
- **GitHub repo** — [github.com/Fluently-Org/fluently](https://github.com/Fluently-Org/fluently)
- **CLI** — [npmjs.com/package/fluently-cli](https://www.npmjs.com/package/fluently-cli)
- **Scorer library** — [npmjs.com/package/fluently-scorer](https://www.npmjs.com/package/fluently-scorer)

---

## License

[MIT](../../LICENSE) — code and bundled knowledge cycles.
