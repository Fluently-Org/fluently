PROJECT: fluently
PURPOSE: An open-source CLI + MCP server + knowledge base that operationalizes the AI Fluency 4D Framework (Delegation, Description, Discernment, Diligence) by Dakan & Feller. Licensed CC BY-NC-SA. Works with any AI agent — Claude, GPT, Gemini, Mistral, Copilot, and more.

ARCHITECTURE:
- /knowledge/ — YAML Fluently 4D cycles, community-contributed, organized by dimension and domain
- /packages/cli/ — Node.js CLI (`fluent` command) using commander.js; multi-provider AI support
- /packages/mcp-server/ — MCP server exposing knowledge as AI-callable tools (any MCP-compatible agent)
- /packages/scorer/ — Shared scoring + schema validation engine used by both CLI and MCP server
- /site/ — GitHub Pages static site (plain HTML + Tailwind CDN + vanilla JS)

RULES:
- Never hardcode API keys
- All knowledge entries must have all 4D fields present
- Schema validation runs before any PR merges
- Test files live alongside source in __tests__ folders
- Knowledge YAML must pass Zod schema before being accepted
- Use ESM imports throughout (no require()); mixed require/import is a bug

STACK: TypeScript, Node.js 20+, Zod, commander.js, Anthropic SDK (claude-sonnet-4-6), Vitest, GitHub Actions
