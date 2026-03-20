PROJECT: fluently
PURPOSE: An open-source CLI + MCP server + knowledge base that operationalizes the AI Fluency 4D Framework (Delegation, Description, Discernment, Diligence) by Dakan & Feller / Anthropic. Licensed CC BY-NC-SA.

ARCHITECTURE:
- /knowledge/ — YAML Fluently 4D cycles, community-contributed, organized by dimension and domain
- /packages/cli/ — Node.js CLI (`fluent` command) using commander.js and Anthropic SDK
- /packages/mcp-server/ — MCP server exposing knowledge as AI-callable tools
- /packages/scorer/ — Shared scoring engine used by both CLI and MCP server
- /site/ — GitHub Pages static site (Astro or plain HTML)

RULES:
- Never hardcode API keys
- All knowledge entries must have all 4D fields present
- Schema validation runs before any PR merges
- Test files live alongside source in __tests__ folders
- Knowledge YAML must pass Zod schema before being accepted

STACK: TypeScript, Node.js 20+, Zod, commander.js, Anthropic SDK (claude-sonnet-4-20250514), Vitest, GitHub Actions
