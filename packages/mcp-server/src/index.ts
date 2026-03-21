import {
  Server,
} from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadKnowledgeEntries } from "@fluently/scorer";
import { knowledgeEntrySchema } from "@fluently/scorer/schema";
import fs from "fs";
import path from "path";
import type { z } from "zod";

type KnowledgeEntry = z.infer<typeof knowledgeEntrySchema>;

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

const { version: SERVER_VERSION } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
);
const KNOWLEDGE_DIR = fs.existsSync(path.join(__dirname, "../knowledge"))
  ? path.join(__dirname, "../knowledge")
  : path.join(process.cwd(), "knowledge");

// Initialize server with metadata
const server = new Server({
  name: "fluently",
  version: SERVER_VERSION,
  description:
    "AI Fluency 4D Framework tools for scoring human-AI collaboration quality",
});

// Helper: Simple cosine similarity for finding top matches
function keywordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
}

function cosineSimilarity(setA: Set<string>, setB: Set<string>): number {
  const all = new Set([...setA, ...setB]);
  let dot = 0,
    magA = 0,
    magB = 0;
  for (const word of all) {
    const a = setA.has(word) ? 1 : 0;
    const b = setB.has(word) ? 1 : 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

// Load knowledge base
function getKnowledgeEntries(): KnowledgeEntry[] {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return [];
  }
  return loadKnowledgeEntries(KNOWLEDGE_DIR);
}

// Tool 1: compare_problem_space
const compareToolDef: Tool = {
  name: "compare_problem_space",
  description:
    "Returns top 3 similar past Fluently 4D cycles from knowledge base with similarity scores",
  inputSchema: {
    type: "object",
    properties: {
      task_description: {
        type: "string",
        description: "Description of the problem or task",
      },
      domain: {
        type: "string",
        enum: [
          "coding",
          "writing",
          "research",
          "customer-support",
          "education",
          "legal",
          "healthcare",
          "general",
        ],
        description: "Optional: domain to filter by",
      },
    },
    required: ["task_description"],
  },
};

// Tool 2: score_delegation
const scoreDelegationToolDef: Tool = {
  name: "score_delegation",
  description:
    "Returns Delegation + Description dimension scores with improvement advice",
  inputSchema: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "The task or problem to evaluate",
      },
      delegation_intent: {
        type: "string",
        description:
          "How you intend to delegate this task (automated, augmented, agentic)",
      },
    },
    required: ["task", "delegation_intent"],
  },
};

// Tool 3: evaluate_discernment
const evaluateDiscernmentToolDef: Tool = {
  name: "evaluate_discernment",
  description:
    "Returns a discernment rubric score: checks for hallucination risk, confidence calibration, human review need",
  inputSchema: {
    type: "object",
    properties: {
      ai_output: {
        type: "string",
        description: "The AI-generated output to evaluate",
      },
      original_task: {
        type: "string",
        description: "The original task or prompt given to the AI",
      },
    },
    required: ["ai_output", "original_task"],
  },
};

// Tool 4: check_diligence
const checkDiligenceToolDef: Tool = {
  name: "check_diligence",
  description:
    "Returns a diligence checklist: transparency requirements, accountability steps, disclosure needs",
  inputSchema: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "The task to evaluate for diligence requirements",
      },
      domain: {
        type: "string",
        description: "The domain or context of the task",
      },
    },
    required: ["task", "domain"],
  },
};

// Tool 5: get_4d_score
const get4DScoreToolDef: Tool = {
  name: "get_4d_score",
  description:
    "Master tool: returns complete 4D Score (0-100 per dimension + overall) with one-sentence improvement tip per dimension",
  inputSchema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Description of the task or scenario",
      },
      delegation: {
        type: "string",
        description: "How the task is being delegated to AI",
      },
      output: {
        type: "string",
        description: "Optional: the AI output to evaluate (for discernment)",
      },
    },
    required: ["description", "delegation"],
  },
};

// Register tools
server.setRequestHandler("tools/list" as any, async () => {
  return {
    tools: [
      compareToolDef,
      scoreDelegationToolDef,
      evaluateDiscernmentToolDef,
      checkDiligenceToolDef,
      get4DScoreToolDef,
    ],
  };
});

// Handler for tool calls
server.setRequestHandler("tools/call" as any, async (request: any) => {
  const { name, arguments: toolArgs } = request.params;

  if (name === "compare_problem_space") {
    const { task_description, domain } = toolArgs as {
      task_description: string;
      domain?: string;
    };

    const entries = getKnowledgeEntries();
    if (entries.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No knowledge entries found. Please ensure the knowledge/ directory contains YAML files.",
          },
        ],
      } as any;
    }

    const taskSet = keywordSet(task_description);
    const scored = entries
      .filter((e: KnowledgeEntry) => !domain || e.domain === domain)
      .map((entry: KnowledgeEntry) => {
        const entrySet = keywordSet(
          entry.title +
            " " +
            entry.domain +
            " " +
            Object.values(entry.dimensions)
              .map((d) => d.description)
              .join(" ")
        );
        const similarity = cosineSimilarity(taskSet, entrySet);
        return { entry, similarity };
      });

    scored.sort((a, b) => b.similarity - a.similarity);
    const top3 = scored.slice(0, 3);

    const results = top3.map(({ entry, similarity }: { entry: KnowledgeEntry; similarity: number }) => ({
      id: entry.id,
      title: entry.title,
      domain: entry.domain,
      similarity_score: (similarity * 100).toFixed(1),
      dimensions: entry.dimensions,
      tags: entry.tags,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    } as any;
  }

  if (name === "score_delegation") {
    const { task, delegation_intent } = toolArgs as {
      task: string;
      delegation_intent: string;
    };

    const entries = getKnowledgeEntries();
    const taskSet = keywordSet(task + " " + delegation_intent);

    const scored = entries.map((entry: KnowledgeEntry) => {
      const entrySet = keywordSet(
        entry.title + " " + Object.values(entry.dimensions).map((d) => d.description).join(" ")
      );
      const similarity = cosineSimilarity(taskSet, entrySet);
      return {
        entry,
        similarity,
        delegationScore: Math.min(100, Math.round(similarity * entry.score_hints.delegation * 400)),
        descriptionScore: Math.min(100, Math.round(similarity * entry.score_hints.description * 400)),
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    const topMatch = scored[0];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              task,
              delegation_intent,
              delegation_score: topMatch.delegationScore,
              description_score: topMatch.descriptionScore,
              recommendation: {
                delegation: `Improve delegation approach: ${topMatch.entry.dimensions.delegation.antipattern}`,
                description: `Improve task description: ${topMatch.entry.dimensions.description.antipattern}`,
              },
              reference_entry: topMatch.entry.title,
            },
            null,
            2
          ),
        },
      ],
    } as any;
  }

  if (name === "evaluate_discernment") {
    const { ai_output, original_task } = toolArgs as {
      ai_output: string;
      original_task: string;
    };

    const entries = getKnowledgeEntries();
    const taskSet = keywordSet(original_task + " " + ai_output);

    const scored = entries.map((entry: KnowledgeEntry) => {
      const entrySet = keywordSet(
        entry.title + " " + entry.dimensions.discernment.description
      );
      const similarity = cosineSimilarity(taskSet, entrySet);
      return {
        entry,
        discernmentScore: Math.min(100, Math.round(similarity * entry.score_hints.discernment * 400)),
      };
    });

    scored.sort((a, b) => b.discernmentScore - a.discernmentScore);
    const topMatch = scored[0];

    const hallucination_risk = Math.max(0, 100 - topMatch.discernmentScore);
    const confidence_calibration = Math.min(100, topMatch.discernmentScore + 20);
    const human_review_needed =
      hallucination_risk > 50 || confidence_calibration < 60;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              discernment_score: topMatch.discernmentScore,
              hallucination_risk_percent: hallucination_risk,
              confidence_calibration_percent: confidence_calibration,
              human_review_needed,
              guidance: topMatch.entry.dimensions.discernment.example,
              antipattern_to_avoid:
                topMatch.entry.dimensions.discernment.antipattern,
            },
            null,
            2
          ),
        },
      ],
    } as any;
  }

  if (name === "check_diligence") {
    const { task, domain } = toolArgs as {
      task: string;
      domain: string;
    };

    const entries = getKnowledgeEntries().filter((e: KnowledgeEntry) => e.domain === domain);

    if (entries.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                domain,
                checklist: [
                  "Define clear human accountability roles",
                  "Establish review and approval process",
                  "Document AI involvement in decision",
                  "Create audit trail of decisions",
                  "Define escalation criteria",
                ],
                transparency_requirements: [
                  "Disclose AI participation to stakeholders",
                  "Explain AI limitations and confidence",
                  "Provide human decision-maker contact",
                ],
                accountability_steps: [
                  "Assign human reviewer",
                  "Log all AI recommendations",
                  "Document approval/rejection decisions",
                ],
              },
              null,
              2
            ),
          },
        ],
      } as any;
    }

    const topEntry = entries[0];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              domain,
              task,
              diligence_guidance: topEntry.dimensions.diligence.description,
              best_practice_example:
                topEntry.dimensions.diligence.example,
              antipattern_to_avoid:
                topEntry.dimensions.diligence.antipattern,
              checklist: [
                "Define clear human accountability roles",
                "Establish review and approval process",
                "Document AI involvement in decision",
                "Create audit trail of decisions",
                "Define escalation criteria",
              ],
              transparency_requirements: [
                "Disclose AI participation to stakeholders",
                "Explain AI limitations and confidence",
                "Provide human decision-maker contact",
              ],
              accountability_steps: [
                "Assign human reviewer",
                "Log all AI recommendations",
                "Document approval/rejection decisions",
              ],
            },
            null,
            2
          ),
        },
      ],
    } as any;
  }

  if (name === "get_4d_score") {
    const { description, delegation, output } = toolArgs as {
      description: string;
      delegation: string;
      output?: string;
    };

    const entries = getKnowledgeEntries();
    const taskSet = keywordSet(description + " " + delegation + " " + (output || ""));

    const scored = entries.map((entry: KnowledgeEntry) => {
      const entrySet = keywordSet(entry.title + " " + entry.domain);
      const similarity = cosineSimilarity(taskSet, entrySet);
      return {
        entry,
        similarity,
        delegationScore: Math.min(100, Math.round(similarity * entry.score_hints.delegation * 400)),
        descriptionScore: Math.min(100, Math.round(similarity * entry.score_hints.description * 400)),
        discernmentScore: Math.min(100, Math.round(similarity * entry.score_hints.discernment * 400)),
        diligenceScore: Math.min(100, Math.round(similarity * entry.score_hints.diligence * 400)),
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    const topMatch = scored[0];

    const delegationScore = Math.max(0, Math.min(100, topMatch.delegationScore + 30));
    const descriptionScore = Math.max(
      0,
      Math.min(100, topMatch.descriptionScore + 25)
    );
    const discernmentScore = Math.max(0, Math.min(100, output ? topMatch.discernmentScore + 20 : 50));
    const diligenceScore = Math.max(0, Math.min(100, topMatch.diligenceScore + 15));

    const overallScore = Math.round(
      (delegationScore +
        descriptionScore +
        discernmentScore +
        diligenceScore) /
        4
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              overall_score: overallScore,
              dimension_scores: {
                delegation: delegationScore,
                description: descriptionScore,
                discernment: discernmentScore,
                diligence: diligenceScore,
              },
              improvement_tips: {
                delegation: `Clarify role: ${topMatch.entry.dimensions.delegation.antipattern}`,
                description: `Better context: ${topMatch.entry.dimensions.description.antipattern}`,
                discernment: `Review more carefully: ${topMatch.entry.dimensions.discernment.antipattern}`,
                diligence: `Establish accountability: ${topMatch.entry.dimensions.diligence.antipattern}`,
              },
              reference_framework: topMatch.entry.title,
              version: SERVER_VERSION,
            },
            null,
            2
          ),
        },
      ],
    } as any;
  }

  throw new Error(
    `Unknown tool: ${name}`
  );
});

export async function start() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fluently MCP server running on stdio");
}

// Run if called directly
if (require.main === module) {
  start().catch(console.error);
}
