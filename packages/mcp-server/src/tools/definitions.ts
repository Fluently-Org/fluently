/**
 * tools/definitions.ts
 *
 * MCP tool definitions (name, description, inputSchema).
 * Pure data — no business logic here.
 *
 * Adding a new tool:
 *   1. Add its definition to TOOLS below.
 *   2. Add its handler to tools/handlers.ts.
 *   3. That's it — server/index.ts picks up both automatically.
 */

export const TOOLS = [
  {
    name: "list_domains",
    description:
      "List all domains in the knowledge base with cycle counts. " +
      "Start here to orient yourself before searching for relevant cycles.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  {
    name: "find_relevant_cycles",
    description:
      "Return the most relevant Fluently 4D cycles for a task. " +
      "Results include the collaboration pattern (how the 4Ds sequence as conversation clusters) " +
      "and a step-by-step sequence summary. " +
      "No numeric scores — reason over the candidates and use get_cycle_detail for full guidance.",
    inputSchema: {
      type: "object",
      properties: {
        task_description: {
          type: "string",
          description: "Plain-language description of the AI-assisted task",
        },
        domain: {
          type: "string",
          description:
            "Optional domain filter: coding | writing | research | customer-support | " +
            "education | legal | healthcare | general",
        },
        limit: {
          type: "number",
          description: "Maximum cycles to return (default 3, max 10)",
        },
      },
      required: ["task_description"],
    },
  },

  {
    name: "get_cycle_detail",
    description:
      "Get the complete 4D cycle for a specific ID, including all antipatterns, " +
      "examples, and the full collaboration block. " +
      "Call this after find_relevant_cycles to read the best-fit cycle in full.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Cycle ID (from find_relevant_cycles results)",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "get_collaboration_pattern",
    description:
      "Explain how the 4 dimensions sequence as conversation clusters for a specific cycle. " +
      "Returns the ordered D-clusters, example human↔AI prompt exchanges, transition triggers, " +
      "and any loop-back conditions. " +
      "Use this to understand the recommended conversation shape for a task — not rigid steps, " +
      "but checkpoints that indicate when to move on or revisit an earlier D.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Cycle ID (from find_relevant_cycles results)",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "get_dimension_guidance",
    description:
      "Get antipatterns and examples for one 4D dimension across all cycles in a domain. " +
      "Use this to understand what good and bad looks like for delegation, description, " +
      "discernment, or diligence across a set of related workflows.",
    inputSchema: {
      type: "object",
      properties: {
        dimension: {
          type: "string",
          description: "One of: delegation | description | discernment | diligence",
        },
        domain: {
          type: "string",
          description: "Optional domain filter",
        },
      },
      required: ["dimension"],
    },
  },

  {
    name: "refresh_knowledge",
    description:
      "Re-fetch the knowledge base from the configured connector without restarting the server. " +
      "Use after new cycles are merged or published to get the latest patterns.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  {
    name: "list_frameworks",
    description:
      "List all registered collaboration frameworks in the knowledge base. " +
      "Each framework defines its own dimension keys, labels, and canonical order. " +
      "Use this to discover available frameworks before filtering cycles by framework.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  {
    name: "get_framework_detail",
    description:
      "Get the full definition of a specific framework by id, including dimensions, " +
      "canonical order, dimension_combinations (synergies/prerequisites/tensions), " +
      "best_practices (actionable guidance per dimension), and evaluation_criteria " +
      "(keyword-signal checks for compliance assessment). " +
      "Call list_frameworks first to discover available framework ids.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Framework id (e.g. '4d-framework')",
        },
      },
      required: ["id"],
    },
  },

  {
    name: "compare_frameworks",
    description:
      "For a task description, find the best matching cycle from each available framework " +
      "and return them side by side for comparison. " +
      "Useful when multiple frameworks are registered and you want to understand " +
      "which framework's approach best fits the task.",
    inputSchema: {
      type: "object",
      properties: {
        task_description: {
          type: "string",
          description: "Plain-language description of the AI-assisted task",
        },
        domain: {
          type: "string",
          description: "Optional domain filter",
        },
      },
      required: ["task_description"],
    },
  },

  {
    name: "evaluate_compliance",
    description:
      "Evaluate a collaboration description against a framework's evaluation_criteria. " +
      "Each criterion has keyword signals and a pass threshold; the function checks " +
      "the text for those signals and returns a 0-100 weighted compliance score, " +
      "the list of passed and failed criteria, and per-criterion details including " +
      "which keywords were matched. " +
      "Use this during or after a collaboration session to check framework adherence " +
      "and identify which dimensions need more attention. " +
      "Returns score: 0 when the framework has no evaluation_criteria defined.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "The collaboration text to evaluate — may include the task description, " +
            "conversation transcript, or any prose describing the collaboration session.",
        },
        framework_id: {
          type: "string",
          description: "Framework id to evaluate against (default: '4d-framework')",
        },
      },
      required: ["text"],
    },
  },

  {
    name: "contribute_cycle",
    description:
      "Validate and submit a new 4D cycle to the configured knowledge source. " +
      "A privacy/confidentiality scan runs automatically before submission — " +
      "secrets (API keys, tokens, PII) are always blocked; softer warnings " +
      "(emails, internal URLs, ticket IDs) require explicit acknowledgment. " +
      "Set contribute_to_public=true from a private connector to bridge the cycle " +
      "to the community public repo — this triggers strict mode where all warnings " +
      "also block until resolved.\n\n" +
      "Connectors:\n" +
      "  github-public  — returns validated YAML + fork-and-PR instructions\n" +
      "  github-private — opens a PR automatically (requires FLUENTLY_GITHUB_TOKEN)\n" +
      "  local          — writes the YAML file to the configured directory",
    inputSchema: {
      type: "object",
      properties: {
        cycle: {
          type: "object",
          description:
            "Complete 4D cycle object with id, title, domain, tags, contributor, version, " +
            "dimensions (delegation/description/discernment/diligence), score_hints, " +
            "and optionally a collaboration block.",
        },
        acknowledge_privacy_warnings: {
          type: "boolean",
          description:
            "Set to true to proceed despite soft privacy warnings (emails, internal URLs, " +
            "ticket IDs, etc.). Has no effect on hard blocks — those must be fixed first. " +
            "Not applicable in strict/bridge mode where all warnings are hard blocks.",
        },
        contribute_to_public: {
          type: "boolean",
          description:
            "Set to true when you want to bridge a cycle from a private knowledge source " +
            "(local or github-private connector) to the public community repository. " +
            "Activates strict mode: all privacy warnings are promoted to hard blocks so " +
            "nothing confidential reaches the public repo. Requires FLUENTLY_GITHUB_TOKEN.",
        },
      },
      required: ["cycle"],
    },
  },
] as const;
