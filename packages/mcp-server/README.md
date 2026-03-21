# fluently-mcp-server

MCP server for the Fluently 4D Framework. Exposes knowledge retrieval and contribution tools so AI agents can find, reason over, and extend Fluently 4D cycles.

## Install

```bash
npm install -g fluently-mcp-server
fluently-mcp-server
```

## Wire to Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "fluently": { "command": "fluently-mcp-server" }
  }
}
```

## Wire to Claude Code

In your `settings.json`:

```json
{
  "mcpServers": {
    "fluently": { "command": "fluently-mcp-server" }
  }
}
```

## Tools

| Tool | Purpose |
|---|---|
| `list_domains` | List available domains and cycle counts |
| `find_relevant_cycles` | Retrieve ranked candidate cycles for a task (no scores — agent reasons) |
| `get_cycle_detail` | Full 4D cycle by ID |
| `get_dimension_guidance` | Antipatterns + examples for a dimension across all cycles |
| `refresh_knowledge` | Re-fetch from the connector without restarting |
| `contribute_cycle` | Validate and submit a new cycle to the knowledge source |

## Connectors

The server fetches knowledge from a configured source. Set `FLUENTLY_CONNECTOR` to choose.

### github-public (default)

Fetches live from the public Fluently community repo. No auth required. Points to `faical-yannick-congo/fluently` by default.

```bash
# Default — no config needed
fluently-mcp-server

# Point to a public fork
FLUENTLY_CONNECTOR=github-public \
FLUENTLY_GITHUB_REPO=your-org/your-public-fork \
fluently-mcp-server
```

Contributing requires opening a PR manually (YAML + instructions returned by `contribute_cycle`).

### github-private

Fetches from a private GitHub repo via the GitHub API. Requires a personal access token with `repo` scope. `contribute_cycle` creates branches and PRs automatically.

```bash
FLUENTLY_CONNECTOR=github-private \
FLUENTLY_GITHUB_REPO=your-org/your-private-knowledge \
FLUENTLY_GITHUB_TOKEN=ghp_xxx \
fluently-mcp-server
```

### local

Reads from a local directory. Ideal for development, air-gapped environments, or building private cycles before committing.

```bash
FLUENTLY_CONNECTOR=local \
FLUENTLY_LOCAL_PATH=/path/to/your/knowledge \
fluently-mcp-server
```

`contribute_cycle` writes YAML files directly to the configured directory.

### sql _(planned)_

Reads cycles from a SQL database (PostgreSQL, SQLite). Coming in a future release.

### nosql _(planned)_

Reads cycles from a NoSQL database (MongoDB). Coming in a future release.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `FLUENTLY_CONNECTOR` | `github-public` | Which connector to use |
| `FLUENTLY_GITHUB_REPO` | `faical-yannick-congo/fluently` | GitHub repo (`owner/repo`) |
| `FLUENTLY_GITHUB_BRANCH` | `main` | Branch to read from |
| `FLUENTLY_GITHUB_TOKEN` | _(none)_ | GitHub token — required for private repos and automated PRs |
| `FLUENTLY_LOCAL_PATH` | `./knowledge` | Local knowledge directory (local connector only) |

## Why no scoring?

Numeric scores (delegation: 34/100) are biased by writing style and user maturity. Two people describing the same workflow in different vocabulary get different scores.

This server does **retrieval** — it finds the most relevant cycles using keyword similarity and returns them for you to reason over. You assess fit in context. That's more accurate and adapts to the specifics of the situation rather than returning a false-precision number.

## Using GitHub MCP instead (community knowledge)

If you prefer to skip the custom server and work directly with the public knowledge base via GitHub MCP, read `KNOWLEDGE.md` at the repo root. The raw `index.json` is fetchable without auth and contains all cycles.

The custom MCP server is the right choice when:
- You need private knowledge that stays in your org
- You want isolation from the community repo
- You want structured tools (domain listing, dimension guidance, contribute flow)
- You need the server to handle sync and refresh automatically

## License

CC BY-NC-SA (inherited from fluently project)
