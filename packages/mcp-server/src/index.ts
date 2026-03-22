import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createConnector } from "./connectors/factory.js";
import type { KnowledgeConnector } from "./connectors/types.js";
import { refreshKnowledge } from "./knowledge.js";
import { TOOLS } from "./tools/definitions.js";
import {
  handleListDomains,
  handleFindRelevantCycles,
  handleGetCycleDetail,
  handleGetCollaborationPattern,
  handleGetDimensionGuidance,
  handleRefreshKnowledge,
  handleContributeCycle,
} from "./tools/handlers.js";

const { version: SERVER_VERSION } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
);

// ── Connector ────────────────────────────────────────────────────────────────

let connector: KnowledgeConnector;
try {
  connector = createConnector();
} catch (err: any) {
  console.error(`[fluently] Connector error: ${err.message}`);
  process.exit(1);
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "fluently",
    version: SERVER_VERSION,
  },
  {
    capabilities: { tools: {} },
    instructions:
      "Fluently 4D Framework knowledge tools. Retrieves community or private AI workflow cycles " +
      "so an agent can reason over them and assess fit — no hardcoded scoring.",
  }
);

// ── Request handlers ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as { name: string; arguments: any };

  const content = await (() => {
    switch (name) {
      case "list_domains":           return handleListDomains(connector);
      case "find_relevant_cycles":   return handleFindRelevantCycles(args, connector);
      case "get_cycle_detail":       return handleGetCycleDetail(args, connector);
      case "get_collaboration_pattern": return handleGetCollaborationPattern(args, connector);
      case "get_dimension_guidance": return handleGetDimensionGuidance(args, connector);
      case "refresh_knowledge":      return handleRefreshKnowledge(connector);
      case "contribute_cycle":       return handleContributeCycle(args, connector);
      default: throw new Error(`Unknown tool: ${name}`);
    }
  })();

  return { content } as any;
});

// ── Start ─────────────────────────────────────────────────────────────────────

export async function start() {
  const connectorInfo = `${connector.name}${
    process.env.FLUENTLY_GITHUB_REPO ? ` (${process.env.FLUENTLY_GITHUB_REPO})` : ""
  }`;
  console.error(`[fluently] MCP server v${SERVER_VERSION} — connector: ${connectorInfo}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[fluently] Ready`);

  refreshKnowledge(connector).catch((err: any) => {
    console.error(`[fluently] Warning: could not pre-load knowledge: ${err.message}`);
  });
}
