/**
 * tools/handlers.ts
 *
 * Business logic for each MCP tool.
 *
 * Each handler receives the raw args object and the knowledge cache accessor,
 * and returns an MCP content array ready to be sent back to the client.
 *
 * Conventions:
 *   - Handlers are pure functions — they do not mutate shared state.
 *   - All errors are returned as JSON { error: "..." } content, not thrown,
 *     so the MCP client always receives a well-formed response.
 *   - No numeric scores are ever exposed to the agent — the agent reasons.
 */

import { knowledgeEntrySchema } from "@fluently/scorer/schema";
import { checkPrivacy } from "@fluently/scorer";
import type { KnowledgeConnector, KnowledgeEntry } from "../connectors/types.js";
import { GitHubPublicConnector } from "../connectors/github-public.js";
import { getKnowledge, refreshKnowledge, invalidateCache } from "../knowledge.js";
import { rankCycles } from "../ranking.js";

/** Convenience: wrap any JSON-serialisable value in MCP content format. */
function json(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value, null, 2) }];
}

// ── list_domains ─────────────────────────────────────────────────────────────

export async function handleListDomains(connector: KnowledgeConnector) {
  const { entries, source } = await getKnowledge(connector);

  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.domain] = (counts[e.domain] ?? 0) + 1;

  const summary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => `${domain}: ${count} cycle${count !== 1 ? "s" : ""}`)
    .join("\n");

  return json({ source, total: entries.length, domains: counts, summary });
}

// ── find_relevant_cycles ─────────────────────────────────────────────────────

export async function handleFindRelevantCycles(
  args: { task_description: string; domain?: string; limit?: number },
  connector: KnowledgeConnector
) {
  const { task_description, domain, limit } = args;
  const { entries, source } = await getKnowledge(connector);

  const cap = Math.min(limit ?? 3, 10);
  const ranked = rankCycles(task_description, entries, domain, cap);

  const results = ranked.map(e => ({
    id: e.id,
    title: e.title,
    domain: e.domain,
    tags: e.tags,
    contributor: e.contributor,
    summary: e.summary,
    // Collaboration metadata — lets the agent assess pattern fit before deep-reading
    collaboration_pattern: e.collaboration?.pattern ?? null,
    collaboration_description: e.collaboration?.description ?? null,
    sequence_summary: e.collaboration?.sequence.map(
      s => `${s.step}. [${s.d.toUpperCase()}] ${s.label}`
    ) ?? null,
    dimensions: {
      delegation:  { description: e.dimensions.delegation.description },
      description: { description: e.dimensions.description.description },
      discernment: { description: e.dimensions.discernment.description },
      diligence:   { description: e.dimensions.diligence.description },
    },
  }));

  return json({
    source,
    task: task_description,
    domain: domain ?? "all",
    cycles: results,
    guidance:
      "Reason over these cycles to assess fit. Each cycle includes its collaboration_pattern " +
      "(how the 4Ds sequence as conversation clusters) and a sequence_summary. " +
      "Call get_cycle_detail for full antipatterns and examples, or " +
      "get_collaboration_pattern for the full prompt-cluster sequence.",
  });
}

// ── get_cycle_detail ─────────────────────────────────────────────────────────

export async function handleGetCycleDetail(
  args: { id: string },
  connector: KnowledgeConnector
) {
  const { entries, source } = await getKnowledge(connector);
  const entry = entries.find(e => e.id === args.id);

  if (!entry) {
    return json({
      error: `Cycle "${args.id}" not found. Use list_domains or find_relevant_cycles to discover available cycles.`,
    });
  }

  return json({ source, cycle: entry });
}

// ── get_collaboration_pattern ─────────────────────────────────────────────────

export async function handleGetCollaborationPattern(
  args: { id: string },
  connector: KnowledgeConnector
) {
  const { entries, source } = await getKnowledge(connector);
  const entry = entries.find(e => e.id === args.id);

  if (!entry) {
    return json({ error: `Cycle "${args.id}" not found.` });
  }

  if (!entry.collaboration) {
    return json({
      id: entry.id,
      title: entry.title,
      note:
        "This cycle does not yet have a collaboration block. " +
        "The 4D dimensions still apply, but the conversation sequence has not been defined.",
      dimensions_only: Object.fromEntries(
        Object.entries(entry.dimensions).map(([d, v]) => [d, (v as any).description])
      ),
    });
  }

  const c = entry.collaboration;
  return json({
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
  });
}

// ── get_dimension_guidance ───────────────────────────────────────────────────

const VALID_DIMS = ["delegation", "description", "discernment", "diligence"] as const;
type DimKey = typeof VALID_DIMS[number];

export async function handleGetDimensionGuidance(
  args: { dimension: string; domain?: string },
  connector: KnowledgeConnector
) {
  const { dimension, domain } = args;

  if (!VALID_DIMS.includes(dimension as DimKey)) {
    return json({
      error: `Invalid dimension "${dimension}". Valid values: ${VALID_DIMS.join(", ")}`,
    });
  }

  const { entries, source } = await getKnowledge(connector);
  const filtered = domain ? entries.filter(e => e.domain === domain) : entries;

  const guidance = filtered.map(e => ({
    cycle: e.title,
    domain: e.domain,
    description: (e.dimensions as any)[dimension].description,
    example:     (e.dimensions as any)[dimension].example,
    antipattern: (e.dimensions as any)[dimension].antipattern,
  }));

  return json({ source, dimension, domain: domain ?? "all", guidance });
}

// ── refresh_knowledge ────────────────────────────────────────────────────────

export async function handleRefreshKnowledge(connector: KnowledgeConnector) {
  invalidateCache();
  const refreshed = await refreshKnowledge(connector);

  return json({
    success: true,
    connector: refreshed.source,
    cycles_loaded: refreshed.entries.length,
    loaded_at: new Date(refreshed.loadedAt).toISOString(),
    message: `Knowledge base refreshed from ${refreshed.source}. ${refreshed.entries.length} cycles now available.`,
  });
}

// ── contribute_cycle ─────────────────────────────────────────────────────────

/**
 * Handle a contribute_cycle tool call.
 *
 * Flow:
 *   1. Schema validation  — Zod must pass first.
 *   2. Privacy check      — runs in standard or strict mode depending on context.
 *   3. Hard blocks        — always abort; return issues to the caller.
 *   4. Soft warnings      — abort unless acknowledge_privacy_warnings=true
 *                           (not available in strict/bridge mode).
 *   5. Bridge path        — if contribute_to_public=true, use the public
 *                           connector's bridgeContribute() regardless of the
 *                           server's configured connector.
 *   6. Normal contribute  — delegate to the configured connector.
 */
export async function handleContributeCycle(
  args: {
    cycle: unknown;
    /** Acknowledge soft privacy warnings and proceed anyway. */
    acknowledge_privacy_warnings?: boolean;
    /**
     * Bridge the cycle from a private source to the public community repo.
     * Triggers strict privacy mode — all warnings become hard blocks.
     * Requires FLUENTLY_GITHUB_TOKEN.
     */
    contribute_to_public?: boolean;
  },
  connector: KnowledgeConnector
) {
  const { cycle, acknowledge_privacy_warnings = false, contribute_to_public = false } = args;

  // ── Step 1: Schema validation ─────────────────────────────────────────────
  try {
    knowledgeEntrySchema.parse(cycle);
  } catch (err: any) {
    return json({
      success: false,
      message: "Cycle validation failed. Fix the schema errors before contributing.",
      errors: err.errors ?? err.message,
    });
  }

  // ── Step 2: Privacy / confidentiality check ───────────────────────────────
  // Bridge contributions (private → public) run in strict mode so that all
  // warnings are treated as hard blocks — nothing confidential reaches the
  // public repository without an explicit fix.
  const privacyMode = contribute_to_public ? "strict" : "standard";
  const privacy     = checkPrivacy(cycle, { mode: privacyMode });

  // ── Step 3: Hard blocks always abort ──────────────────────────────────────
  if (privacy.blocks.length > 0) {
    return json({
      success:         false,
      privacy_blocked: true,
      message:         privacy.summary,
      blocks: privacy.blocks.map(i => ({
        field:         i.field,
        rule:          i.rule,
        description:   i.description,
        redacted_match: i.redactedMatch,
        suggestion:    i.suggestion,
      })),
      // Surface warnings too so the caller can fix everything in one pass
      warnings: privacy.warnings.map(i => ({
        field:         i.field,
        rule:          i.rule,
        description:   i.description,
        redacted_match: i.redactedMatch,
        suggestion:    i.suggestion,
      })),
    });
  }

  // ── Step 4: Soft warnings require acknowledgment ──────────────────────────
  // Strict mode never reaches here (all warns were promoted to blocks above).
  if (privacy.warnings.length > 0 && !acknowledge_privacy_warnings) {
    return json({
      success:                        false,
      privacy_requires_acknowledgment: true,
      message:                        privacy.summary,
      warnings: privacy.warnings.map(i => ({
        field:         i.field,
        rule:          i.rule,
        description:   i.description,
        redacted_match: i.redactedMatch,
        suggestion:    i.suggestion,
      })),
      next_step:
        "Review the warnings above. Fix any that reveal private information, then " +
        "re-submit with acknowledge_privacy_warnings: true to proceed.",
    });
  }

  // ── Step 5: Bridge path — private → public community repo ────────────────
  if (contribute_to_public) {
    // Use the public connector's dedicated bridge method regardless of the
    // server's configured connector.  The privacy gate above already ensured
    // strict-mode clean.
    const publicConnector = new GitHubPublicConnector();
    const result = await publicConnector.bridgeContribute(cycle);
    return json({
      ...result,
      privacy_check: { mode: "strict", passed: true, warnings_acknowledged: false },
    });
  }

  // ── Step 6: Normal contribution via the configured connector ──────────────
  const result = await connector.contribute(cycle);
  return json({
    ...result,
    privacy_check: {
      mode:                "standard",
      passed:              privacy.passed,
      warnings_count:      privacy.warnings.length,
      warnings_acknowledged: acknowledge_privacy_warnings,
    },
  });
}
