# 🎯 Fluently — The Open Standard for Human-AI Collaboration Quality

[![npm version](https://img.shields.io/npm/v/fluently-cli?label=fluently-cli&style=flat-square&color=3B82F6)](https://www.npmjs.com/package/fluently-cli)
[![CI Status](https://img.shields.io/github/actions/workflow/status/faical-yannick-congo/fluently/ci.yml?branch=main&style=flat-square&color=10B981)](https://github.com/faical-yannick-congo/fluently/actions)
[![License](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0%20%2B%20MIT-blueviolet?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/faical-yannick-congo/fluently?style=flat-square&color=FFB800)](https://github.com/faical-yannick-congo/fluently/stargazers)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-6B6CB5?style=flat-square)](https://modelcontextprotocol.io)
[![Works with](https://img.shields.io/badge/works%20with-Claude%20%7C%20GPT%20%7C%20Gemini%20%7C%20Mistral%20%7C%20Copilot-D4602A?style=flat-square)](https://faical-yannick-congo.github.io/fluently/)

---

## Why 4D Fluency?

AI is powerful—but not magic. Teams shipping with AI today face a hard truth: **output quality depends entirely on clarity**. You need to know *what to delegate*, *how to describe it*, *how to verify it works*, and *who's accountable*. That's the **4D Framework**: Delegation, Description, Discernment, Diligence.

**Fluently operationalizes the 4D Framework.** It gives you a CLI, MCP server, and a growing knowledge base of best practices—built on Anthropic's AI Fluency research by Dakan & Feller. Score your team's AI workflows. Learn from the community's Fluently 4D cycles. Ship with confidence.

---

## See It in Action

**Real-world example:** Compare your code review process against community best practices:

```bash
$ fluent compare --task "Automated code review with human sign-off"

┌─────────────────────────────────────────────────────────┐
│ TOP 3 SIMILAR FLUENTLY 4D CYCLES FROM KNOWLEDGE BASE     │
├─────────────────────────────────────────────────────────┤
│ 1. Code Review: Review Depth vs. Speed Tradeoffs        │
│    Delegation: 75  Description: 82  Discernment: 78     │
│    Diligence: 71   OVERALL: 76/100                      │
│                                                          │
│ 2. Bug Fix Prioritization                               │
│    Delegation: 68  Description: 74  Discernment: 71     │
│    Diligence: 69   OVERALL: 71/100                      │
│                                                          │
│ 3. Test Case Generation                                 │
│    Delegation: 72  Description: 76  Discernment: 70     │
│    Diligence: 68   OVERALL: 72/100                      │
└─────────────────────────────────────────────────────────┘
```

Each suggestion links to the full Fluently 4D cycle—delegation guidelines, framing prompts, hallucination patterns to watch for, and approval workflows.

---

## Install in 30 Seconds

**Option 1 — Zero install (browser):** Use the [live scorer](https://faical-yannick-congo.github.io/fluently/) right now. No setup required.

**Option 2 — Zero install (terminal):** Run instantly with npx — no PATH changes needed:
```bash
npx fluently-cli score "Automated bug triage with human review"
```

**Option 3 — Permanent install:**
```bash
npm install -g fluently-cli
fluent --help
```

Requires Node.js 20+. The CLI is self-contained — no configuration files needed.

---

## What's Inside

**CLI** — Run `fluent` in your terminal to score 4D workflows, compare against community patterns, and contribute new Fluently 4D cycles.

**MCP Server** — Embed 4D scoring into any AI agent or MCP-compatible client (Claude Desktop, Claude Code, VS Code Copilot, Cursor, Continue, and more). Expose tools like `find_relevant_cycles()`, `get_dimension_guidance()`, and `contribute_cycle()` to your agent.

**Knowledge Base** — 50+ community-contributed Fluently 4D cycles organized by domain (coding, writing, research, management, product, etc.). Each cycle is scored on the 4D dimensions and peer-reviewed before merge.

---

## The Knowledge Base Matters

This isn't just a framework—it's a **commons for AI fluency**. Every Fluently 4D cycle you contribute teaches thousands of teams how to collaborate smarter with AI.

Built on the **AI Fluency 4D Framework** by Dakan & Feller / Anthropic, distributed under **CC BY-NC-SA 4.0**. Code (CLI, MCP, scorer) is MIT. Mix and match.

[Browse the Knowledge Base →](https://faical-yannick-congo.github.io/fluently/)

---

## Get Started

### For Teams Using AI

1. **Install the CLI** and run `fluent compare --task "your workflow"` to see how others solve similar problems.
2. **Check the Fluently 4D cycles** — find your use case in the knowledge base above.
3. **Score your process** — run `fluent score` with your delegation intent to identify gaps.

### For Teams Building AI Tools

1. **Integrate the MCP server** into your AI agent or IDE plugin (any MCP-compatible client).
2. **Expose 4D scoring** to your users — let them verify AI output quality before shipping.
3. **Use the scorer engine** directly — `const { scoreTask } = require('@fluently/scorer')`.

### For Contributors

**Share your Fluently 4D cycles and help the community.** We're looking for patterns, anti-patterns, and real-world lessons from teams shipping AI features.

→ [**Contributing Guide**](CONTRIBUTING.md) — Detailed walkthrough for submitting a new Fluently 4D cycle.

---

## How 4D Scoring Works

Every task, workflow, or prompt gets scored across four dimensions:

| Dimension | Question | What We Measure |
|-----------|----------|-----------------|
| **Delegation** | *Who decides?* | Clarity on AI autonomy vs. human oversight. Escalation triggers matter. |
| **Description** | *What context?* | Quality of framing + examples + constraints. Reduces ambiguity. |
| **Discernment** | *Is it right?* | Your ability to spot hallucinations and overconfidence. Red flags & green signals. |
| **Diligence** | *Who's accountable?* | Governance, review workflows, audit trails. Who approves before shipping. |

Each scores 0–100. The framework doesn't replace human judgment—it sharpens it.

---

## Roadmap

**Embeddings-based similarity** — Replace keyword matching with semantic search so `find_similar_cycles()` surfaces truly relevant patterns regardless of terminology.

**VS Code extension** — Inline 4D scoring in your editor. @fluently in comments to get suggestions while you write, review, or debug.

**Web playground** — Try 4D scoring live without installing. Experiment with Fluently 4D cycles. Generate your own.

---

## Tech Stack

```
CLI          → Commander.js + multi-provider AI SDK
MCP Server   → Model Context Protocol (stdio)
Scorer       → Zod schema validation + keyword matching
Knowledge    → YAML + JSON + GitHub API
Tests        → Vitest
```

**Language**: TypeScript • **Runtime**: Node.js 20+ • **Module**: ESM

---

## Contribution is Free

- **Share a Fluently 4D cycle** — Takes 15 minutes. Write YAML. Open a PR. CI validates schema.
- **Improve the scorer** — Suggest semantic improvements, new dimensions, new domains.
- **Build an integration** — MCP server is stable. Write a Slack app. A GitHub Action. A web service.

**By contributing, you help us scale the standard.** Every Fluently 4D cycle in the knowledge base teaches thousands of teams.

---

## Quick Links

- 🌐 [Live Site & Knowledge Browser](https://faical-yannick-congo.github.io/fluently/)
- 📖 [Full Documentation](packages/cli/README.md)
- 💬 [GitHub Discussions](https://github.com/faical-yannick-congo/fluently/discussions)
- 🐛 [Report Issues](https://github.com/faical-yannick-congo/fluently/issues)
- 🤝 [Contributing Guide](CONTRIBUTING.md)

---

## Credits

**The 4D Framework** was developed by **Dakan & Feller** at Anthropic as a collaborative model for operationalizing AI fluency.

**Fluently** brings that framework to life as an open-source tool + knowledge commons.

- Framework & research: [Anthropic AI Fluency](https://www.anthropic.com/)
- Community standards: CC BY-NC-SA 4.0
- Implementation: MIT

---

## License

- **Knowledge base** (YAML Fluently 4D cycles): [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- **Code** (CLI, MCP, scorer): [MIT](LICENSE)

Mix and match. Share freely. Build better AI collaboration.

---

Happy shipping. 🚀


