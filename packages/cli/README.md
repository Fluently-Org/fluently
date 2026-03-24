# fluently-cli

**Terminal CLI for [Fluently](https://fluently-org.github.io/fluently/) — score, compare, and contribute human-AI collaboration cycles across any registered framework.**

Framework-agnostic. Bundles the AI Fluency 4D Framework as the default. Works with any AI agent: Claude, GPT-4o, Gemini, Mistral, GitHub Copilot, and more.

[![npm version](https://img.shields.io/npm/v/fluently-cli.svg)](https://www.npmjs.com/package/fluently-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

---

## Install

```bash
npm install -g fluently-cli
```

Requires Node.js 20+.

---

## Commands

| Command | What it does |
|---------|-------------|
| `fluent score <task>` | Find the 3 most relevant cycles from the knowledge base for a task |
| `fluent compare --description <desc> --delegation <intent>` | Match a task + delegation intent to the closest cycle |
| `fluent list [domain]` | Browse all cycles, optionally filtered by domain |
| `fluent contribute` | Interactive wizard to build and validate a new cycle as YAML |
| `fluent sync` | Pull the latest cycles from the upstream GitHub repo |

---

## Examples

### Score — find similar cycles

```bash
fluent score "AI generates a first draft, human edits and publishes"
```

```
#1  AI-Assisted Technical Writing  [writing]  ██████████  82%
    delegation ████████░░  80%
    description ██████████  95%
    discernment ████████░░  80%
    diligence ██████░░░░  60%
    → knowledge/writing-ai-assisted-technical-writing.yaml
```

### Compare — match with delegation intent

```bash
fluent compare \
  --description "AI reviews PRs for style issues, humans approve" \
  --delegation "augmented"
```

Delegation intent narrows the result to how much autonomy you're giving the agent:
- `automated` — AI decides without human review
- `augmented` — human and AI collaborate
- `supervised` — human decides, AI assists

### List — browse by domain

```bash
fluent list              # all cycles
fluent list coding       # coding domain only
fluent list healthcare   # healthcare domain only
```

Available domains: `coding` · `writing` · `research` · `education` · `legal` · `healthcare` · `customer-support` · `general`

### Contribute — add a new cycle

```bash
fluent contribute
```

The interactive wizard walks through each dimension of the chosen framework, validates the result against the Zod schema, and writes a `.yaml` file ready to commit and PR to the community repo.

### Sync — stay up to date

```bash
fluent sync
```

Pulls the latest cycles from upstream. For a global npm install, use `npm update -g fluently-cli` instead.

---

## Frameworks

Fluently is framework-agnostic. Any collaboration framework with named dimensions can be registered. Each cycle carries a `framework_id` that determines which dimension fields it uses.

The **AI Fluency 4D Framework** is bundled as the default:

| Dimension | Question |
|-----------|----------|
| 🤝 **Delegation** | What is delegated to AI vs. kept by humans? |
| 📝 **Description** | What context makes the AI most effective? |
| 👁️ **Discernment** | How do you evaluate and trust the AI output? |
| ✅ **Diligence** | What accountability steps follow AI involvement? |

Additional frameworks can be added by contributing a YAML definition to `/frameworks/`. Cycles for that framework will be validated and scored against its own dimension schema automatically.

Browse the full community knowledge base at **[fluently-org.github.io/fluently/knowledge.html](https://fluently-org.github.io/fluently/knowledge.html)**.

---

## Links

- **Knowledge Base** — [fluently-org.github.io/fluently/knowledge.html](https://fluently-org.github.io/fluently/knowledge.html)
- **Contribute a cycle** — [fluently-org.github.io/fluently/contribute.html](https://fluently-org.github.io/fluently/contribute.html)
- **GitHub repo** — [github.com/Fluently-Org/fluently](https://github.com/Fluently-Org/fluently)
- **Issues / discussions** — [github.com/Fluently-Org/fluently/issues](https://github.com/Fluently-Org/fluently/issues)
- **MCP server** — [npmjs.com/package/fluently-mcp-server](https://www.npmjs.com/package/fluently-mcp-server)
- **Scorer library** — [npmjs.com/package/fluently-scorer](https://www.npmjs.com/package/fluently-scorer)

---

## License

[MIT](../../LICENSE) — code and bundled knowledge cycles.
