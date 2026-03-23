# Fluently Knowledge Base

This document is a navigation guide for agents and humans interacting with the Fluently 4D knowledge base — either directly via GitHub MCP or through a configured Fluently MCP server.

## What is a 4D cycle?

A **Fluently 4D cycle** is a validated pattern for a specific AI-assisted workflow. It describes four dimensions of good human-AI collaboration:

| Dimension | Question it answers |
|---|---|
| **Delegation** | Who owns the decision — human, AI, or both? What level of autonomy is appropriate? |
| **Description** | How should the task be framed so AI understands context fully? |
| **Discernment** | How do you evaluate whether the AI output is trustworthy? When do you push back? |
| **Diligence** | What human accountability is required after AI is involved? Who signs off? |

Each dimension includes:
- `description` — what good looks like
- `example` — a concrete, real-world instance
- `antipattern` — what to avoid

## Knowledge base structure

```
knowledge/
├── index.json                          ← pre-built index of all cycles (fetch this first)
├── coding-code-review-triage.yaml      ← individual cycle files
├── coding-test-case-generation.yaml
├── writing-content-development.yaml
└── ...
```

File naming: `{domain}-{id}.yaml`

## index.json format

```json
{
  "entries": [
    {
      "id": "code-review-triage",
      "title": "Code Review Triage",
      "domain": "coding",
      "tags": ["code-review", "triage", "automation"],
      "contributor": "Dakan & Feller",
      "version": "1.0.0",
      "summary": "...",
      "dimensions": {
        "delegation":  { "description": "...", "example": "...", "antipattern": "..." },
        "description": { "description": "...", "example": "...", "antipattern": "..." },
        "discernment": { "description": "...", "example": "...", "antipattern": "..." },
        "diligence":   { "description": "...", "example": "...", "antipattern": "..." }
      },
      "score_hints": { "delegation": 0.2, "description": 0.3, "discernment": 0.3, "diligence": 0.2 }
    }
  ]
}
```

## Available domains

coding · writing · research · education · legal · healthcare · general

## How to find a relevant cycle (GitHub MCP path)

1. Fetch `knowledge/index.json` — this gives you all cycles in one read
2. Reason over the entries to find the best match for the task at hand
3. Fetch the specific YAML file for full dimension detail if needed

Raw URL (no auth required — public repo):
```
https://raw.githubusercontent.com/Fluently-Org/fluently/main/knowledge/index.json
```

## How to contribute a new cycle (GitHub MCP path)

Contributions require a GitHub token. The cycle must:
1. Follow the YAML schema (all 4 dimensions, each with description + example + antipattern)
2. Have a unique `id` (kebab-case slug)
3. Belong to one of the supported domains
4. Include `score_hints` that sum to 1.0
5. Include a `collaboration` block with `pattern`, `description`, `sequence` (≥2 steps), and `transitions` (≥1)

Steps:
1. Fork https://github.com/Fluently-Org/fluently
2. Add your YAML to `knowledge/{domain}-{id}.yaml`
3. Open a pull request — CI will validate the full schema automatically (including collaboration)

## How to use the Fluently MCP server instead

Install and run:
```bash
npm install -g fluently-mcp-server
fluently-mcp-server
```

Configure in any MCP-compatible client (Claude Desktop, Claude Code, VS Code Copilot, Cursor, Continue, Cline…):
```json
{
  "mcpServers": {
    "fluently": { "command": "fluently-mcp-server" }
  }
}
```

Default connector: `github-public` (fetches live from this repo, no auth needed).
For private knowledge, see `packages/mcp-server/README.md`.

## Collaboration block (required)

Every cycle must include a `collaboration` block describing how the 4Ds sequence as human↔AI conversation clusters. This is how a cycle captures its structural pattern — linear, iterative, cyclic, etc.

```yaml
collaboration:
  pattern: linear_with_loops     # linear | linear_with_loops | cyclic | iterative | branching
  description: "Human defines scope, AI drafts, human reviews and either approves or loops back"
  sequence:
    - step: 1
      d: delegation
      label: "Define scope and autonomy"
      example_prompts:
        - { speaker: human, text: "Review this PR for logic errors only, flag but don't fix style issues." }
        - { speaker: ai,    text: "Understood. I'll focus on logic correctness and flag style separately." }
      triggers_next: "Scope and constraints are clear to both parties"
    - step: 2
      d: description
      label: "Provide full context"
      triggers_next: "AI has enough context to begin"
      loop_back: { to: delegation, condition: "Scope is unclear", reason: "Must clarify ownership before describing" }
    - step: 3
      d: discernment
      label: "Evaluate AI output"
      triggers_next: "Human accepts or rejects suggestions"
    - step: 4
      d: diligence
      label: "Human approves and merges"
      triggers_next: "PR is merged or escalated"
      can_restart: true
  transitions:
    - { from: delegation, to: description, trigger: "Scope agreed" }
    - { from: description, to: discernment, trigger: "Context provided" }
    - { from: discernment, to: diligence, trigger: "Output accepted" }
    - { from: discernment, to: description, trigger: "Output unclear — need more context", is_loop_back: true }
    - { from: diligence, to: delegation, trigger: "Scope changed — restart needed", is_cycle_restart: true }
```

The `collaboration` block is required and validated by the schema. All `d` values must be one of `delegation | description | discernment | diligence`. See `CONTRIBUTING.md` for the full schema reference.

## index.json fields

The auto-generated `index.json` contains every field needed for search and rendering:

| Field | Type | Description |
|---|---|---|
| `id` | string | Kebab-case unique slug |
| `framework_id` | string | Framework this entry belongs to (default: `4d-framework`) |
| `title` | string | Human-readable name |
| `domain` | string | One of the supported domains |
| `tags` | string[] | Search/filter tags |
| `contributor` | string | Author name |
| `version` | string | Semver |
| `summary` | string | One-sentence description |
| `file` | string | Filename in knowledge/ |
| `dimensions` | object | All dimensions with description, example, antipattern — keys match the framework's dimension keys |
| `score_hints` | object | Relative weights per dimension key (sum to 1.0) |

## Frameworks

Fluently is framework-agnostic. The `frameworks/` directory contains YAML definitions for each supported collaboration framework:

```
frameworks/
├── index.json              ← pre-built index of all frameworks (fetch this first)
└── 4d-framework.yaml       ← the bundled AI Fluency 4D Framework
```

Each framework defines:
- `id` — kebab-case unique identifier (e.g. `4d-framework`)
- `name` — human-readable name
- `version` — semver
- `contributor` — author
- `dimensions` — list of dimension objects with `key`, `label`, `description`, and `canonical_order`
- `tags` — optional search tags
- `reference` — optional URL

Knowledge cycles belong to a framework via `framework_id`. Validation uses the framework's dimension keys — so a 4D entry must have `delegation`, `description`, `discernment`, and `diligence`, but a different framework's entry must match that framework's own keys.

### Frameworks index URL

```
https://raw.githubusercontent.com/Fluently-Org/fluently/main/frameworks/index.json
```

### Contributing a new framework

Three paths:

**1. Manual PR**
- Create `frameworks/{id}.yaml` following the schema
- CI will validate with `scripts/validate-frameworks.js` and regenerate `index.json`
- Add knowledge cycles with `framework_id: your-framework-id`

**2. Via GitHub MCP (agents)**
- Use the Fluently MCP server's `contribute_cycle` tool with `framework_id` set
- Use `list_frameworks` and `get_framework_detail` to discover existing frameworks

**3. Private MCP**
- Fork the repo and add your framework YAML privately
- Configure `FLUENTLY_GITHUB_REPO` to point to your fork
