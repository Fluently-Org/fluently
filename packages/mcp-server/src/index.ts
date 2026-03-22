import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { knowledgeEntrySchema } from "@fluently/scorer/schema";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { createConnector } from "./connectors/factory.js";
import type { KnowledgeConnector, KnowledgeEntry } from "./connectors/types.js";

const { version: SERVER_VERSION } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
);

const BUNDLED_KNOWLEDGE = path.join(__dirname, "../knowledge");

// ── Connector ────────────────────────────────────────────────────────────────

let connector: KnowledgeConnector;
try {
  connector = createConnector();
} catch (err: any) {
  console.error(`[fluently] Connector error: ${err.message}`);
  process.exit(1);
}

// ── Knowledge cache ───────────────────────────────────────────────────────────

interface Cache {
  entries: KnowledgeEntry[];
  loadedAt: number;
  source: string;
}

let cache: Cache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getKnowledge(): Promise<Cache> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  return refreshKnowledge();
}

async function refreshKnowledge(): Promise<Cache> {
  try {
    const entries = await connector.load();
    cache = { entries, loadedAt: Date.now(), source: connector.name };
    console.error(`[fluently] Loaded ${entries.length} cycles from ${connector.name}`);
    return cache;
  } catch (err: any) {
    console.error(`[fluently] Failed to load from ${connector.name}: ${err.message}`);
    if (cache) {
      console.error(`[fluently] Using cached knowledge (${cache.entries.length} entries)`);
      return cache;
    }
    // Fall back to bundled knowledge
    if (fs.existsSync(BUNDLED_KNOWLEDGE)) {
      console.error(`[fluently] Falling back to bundled knowledge`);
      const files = fs.readdirSync(BUNDLED_KNOWLEDGE).filter(f => f.endsWith('.yaml'));
      const entries = files.map(f => yaml.load(fs.readFileSync(path.join(BUNDLED_KNOWLEDGE, f), 'utf8')) as KnowledgeEntry);
      cache = { entries, loadedAt: Date.now(), source: 'bundled-fallback' };
      return cache;
    }
    throw new Error(`No knowledge available: ${err.message}`);
  }
}

// ── Keyword retrieval (for ranking — no scores exposed) ───────────────────────

function keywordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 2));
}

function cosineSimilarity(a: Set<string>, b: Set<string>): number {
  const all = new Set([...a, ...b]);
  let dot = 0, magA = 0, magB = 0;
  for (const w of all) {
    const av = a.has(w) ? 1 : 0;
    const bv = b.has(w) ? 1 : 0;
    dot += av * bv; magA += av * av; magB += bv * bv;
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

function rankCycles(task: string, entries: KnowledgeEntry[], domain?: string, limit = 5): KnowledgeEntry[] {
  const taskSet = keywordSet(task);
  return entries
    .filter(e => !domain || e.domain === domain)
    .map(e => ({
      entry: e,
      sim: cosineSimilarity(taskSet, keywordSet(
        [e.title, e.domain, e.summary ?? '', ...e.tags,
          e.dimensions.delegation.description,
          e.dimensions.description.description,
          e.dimensions.discernment.description,
          e.dimensions.diligence.description,
        ].join(' ')
      ))
    }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map(r => r.entry);
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

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_domains",
    description:
      "List all domains available in the knowledge base with cycle counts. " +
      "Use this to orient yourself before searching for relevant cycles.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "find_relevant_cycles",
    description:
      "Retrieve the most relevant Fluently 4D cycles for a task. " +
      "Returns ranked candidates (no numeric scores) for you to reason over and assess fit. " +
      "Each cycle includes delegation, description, discernment, and diligence guidance.",
    inputSchema: {
      type: "object",
      properties: {
        task_description: { type: "string", description: "Plain-language description of the AI task" },
        domain: { type: "string", description: "Optional domain filter: coding | writing | research | education | legal | healthcare | general" },
        limit: { type: "number", description: "Max cycles to return (default 3, max 10)" },
      },
      required: ["task_description"],
    },
  },
  {
    name: "get_cycle_detail",
    description:
      "Get the full 4D cycle for a specific ID. " +
      "Use after find_relevant_cycles to read the complete guidance for a candidate cycle.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The cycle ID (from find_relevant_cycles results)" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_dimension_guidance",
    description:
      "Get antipatterns and examples for a specific 4D dimension across all cycles in a domain. " +
      "Use to understand what good and bad looks like for delegation, description, discernment, or diligence.",
    inputSchema: {
      type: "object",
      properties: {
        dimension: { type: "string", description: "One of: delegation | description | discernment | diligence" },
        domain: { type: "string", description: "Optional domain filter" },
      },
      required: ["dimension"],
    },
  },
  {
    name: "refresh_knowledge",
    description:
      "Re-fetch the knowledge base from the configured connector without restarting the server. " +
      "Use after new cycles have been merged or published to get the latest patterns.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_collaboration_pattern",
    description:
      "Explain the collaboration pattern of a cycle — how the 4 dimensions sequence as " +
      "conversation clusters between human and AI. Returns the ordered D-clusters, " +
      "example prompts for each cluster, transition triggers, and any loop-back conditions. " +
      "Use this to understand the recommended conversation shape for a workflow.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Cycle ID (from find_relevant_cycles)" },
      },
      required: ["id"],
    },
  },
  {
    name: "contribute_cycle",
    description:
      "Validate and submit a new 4D cycle to the configured knowledge source. " +
      "For github-public: returns validated YAML + PR instructions. " +
      "For github-private: opens a PR automatically (requires FLUENTLY_GITHUB_TOKEN). " +
      "For local: writes the YAML file to the configured directory.",
    inputSchema: {
      type: "object",
      properties: {
        cycle: {
          type: "object",
          description: "The complete 4D cycle object with id, title, domain, tags, contributor, version, dimensions, and score_hints",
        },
      },
      required: ["cycle"],
    },
  },
];

// ── Request handlers ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as { name: string; arguments: any };

  // ── list_domains ────────────────────────────────────────────────────────────
  if (name === "list_domains") {
    const { entries, source } = await getKnowledge();
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.domain] = (counts[e.domain] ?? 0) + 1;
    const rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => `${domain}: ${count} cycle${count !== 1 ? 's' : ''}`)
      .join('\n');
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ source, total: entries.length, domains: counts, summary: rows }, null, 2),
      }],
    } as any;
  }

  // ── find_relevant_cycles ────────────────────────────────────────────────────
  if (name === "find_relevant_cycles") {
    const { task_description, domain, limit } = args as {
      task_description: string; domain?: string; limit?: number;
    };
    const { entries, source } = await getKnowledge();
    const cap = Math.min(limit ?? 3, 10);
    const ranked = rankCycles(task_description, entries, domain, cap);

    const results = ranked.map(e => ({
      id: e.id,
      title: e.title,
      domain: e.domain,
      tags: e.tags,
      contributor: e.contributor,
      summary: e.summary,
      // Collaboration pattern — how the 4Ds flow as conversation clusters
      collaboration_pattern: e.collaboration?.pattern ?? null,
      collaboration_description: e.collaboration?.description ?? null,
      // Sequence summary: ordered list of D-cluster labels
      sequence_summary: e.collaboration?.sequence.map(s => `${s.step}. [${s.d.toUpperCase()}] ${s.label}`) ?? null,
      dimensions: {
        delegation:  { description: e.dimensions.delegation.description },
        description: { description: e.dimensions.description.description },
        discernment: { description: e.dimensions.discernment.description },
        diligence:   { description: e.dimensions.diligence.description },
      },
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source,
          task: task_description,
          domain: domain ?? "all",
          cycles: results,
          guidance: "Reason over these cycles to assess fit. Each cycle includes its collaboration_pattern (how the 4Ds sequence as conversation clusters) and sequence_summary. Use get_cycle_detail for full antipatterns, example prompts, and transitions.",
        }, null, 2),
      }],
    } as any;
  }

  // ── get_cycle_detail ────────────────────────────────────────────────────────
  if (name === "get_cycle_detail") {
    const { id } = args as { id: string };
    const { entries, source } = await getKnowledge();
    const entry = entries.find(e => e.id === id);
    if (!entry) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Cycle "${id}" not found. Use list_domains or find_relevant_cycles to discover available cycles.` }) }],
      } as any;
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ source, cycle: entry }, null, 2) }],
    } as any;
  }

  // ── get_dimension_guidance ──────────────────────────────────────────────────
  if (name === "get_dimension_guidance") {
    const { dimension, domain } = args as { dimension: string; domain?: string };
    const validDims = ['delegation', 'description', 'discernment', 'diligence'];
    if (!validDims.includes(dimension)) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Invalid dimension "${dimension}". Valid: ${validDims.join(', ')}` }) }],
      } as any;
    }
    const { entries, source } = await getKnowledge();
    const filtered = domain ? entries.filter(e => e.domain === domain) : entries;
    const guidance = filtered.map(e => ({
      cycle: e.title,
      domain: e.domain,
      description: (e.dimensions as any)[dimension].description,
      example:     (e.dimensions as any)[dimension].example,
      antipattern: (e.dimensions as any)[dimension].antipattern,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ source, dimension, domain: domain ?? 'all', guidance }, null, 2) }],
    } as any;
  }

  // ── refresh_knowledge ───────────────────────────────────────────────────────
  if (name === "refresh_knowledge") {
    cache = null;
    const refreshed = await refreshKnowledge();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          connector: refreshed.source,
          cycles_loaded: refreshed.entries.length,
          loaded_at: new Date(refreshed.loadedAt).toISOString(),
          message: `Knowledge base refreshed from ${refreshed.source}. ${refreshed.entries.length} cycles now available.`,
        }, null, 2),
      }],
    } as any;
  }

  // ── get_collaboration_pattern ───────────────────────────────────────────────
  if (name === "get_collaboration_pattern") {
    const { id } = args as { id: string };
    const { entries, source } = await getKnowledge();
    const entry = entries.find(e => e.id === id);
    if (!entry) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Cycle "${id}" not found.` }) }],
      } as any;
    }
    if (!entry.collaboration) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            id: entry.id,
            title: entry.title,
            note: "This cycle does not yet have a collaboration block. The 4D dimensions still apply, but the conversation sequence has not been defined.",
            dimensions_only: Object.fromEntries(
              Object.entries(entry.dimensions).map(([d, v]) => [d, (v as any).description])
            ),
          }, null, 2),
        }],
      } as any;
    }
    const c = entry.collaboration;
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source,
          id: entry.id,
          title: entry.title,
          pattern: c.pattern,
          description: c.description,
          sequence: c.sequence,
          transitions: c.transitions,
          guidance:
            "The sequence shows how human↔AI conversation clusters are ordered and when they transition. " +
            "Loop-backs indicate when the conversation must revisit an earlier D. " +
            "Use this to structure your interaction with the AI — not as rigid steps but as checkpoints.",
        }, null, 2),
      }],
    } as any;
  }

  // ── contribute_cycle ────────────────────────────────────────────────────────
  if (name === "contribute_cycle") {
    const { cycle } = args as { cycle: unknown };
    // Validate schema
    try {
      knowledgeEntrySchema.parse(cycle);
    } catch (err: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            message: "Cycle validation failed. Fix the errors before contributing.",
            errors: err.errors ?? err.message,
          }, null, 2),
        }],
      } as any;
    }
    const result = await connector.contribute(cycle);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    } as any;
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ── Start ─────────────────────────────────────────────────────────────────────

export async function start() {
  const connectorInfo = `${connector.name}${
    process.env.FLUENTLY_GITHUB_REPO ? ` (${process.env.FLUENTLY_GITHUB_REPO})` : ''
  }`;
  console.error(`[fluently] MCP server v${SERVER_VERSION} — connector: ${connectorInfo}`);

  // Connect transport first so stdin is not missed while knowledge loads
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[fluently] Ready`);

  // Pre-load knowledge in background after transport is connected
  refreshKnowledge().catch((err: any) => {
    console.error(`[fluently] Warning: could not pre-load knowledge: ${err.message}`);
  });
}

