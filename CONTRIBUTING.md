# Contributing to Fluently

Thank you for your interest in contributing to Fluently! This document explains how to submit new Fluently 4D cycles, contribute new frameworks, and contribute to the codebase.

## Table of Contents

- [Adding a New Fluently 4D Cycle](#adding-a-new-fluently-4d-cycle)
- [Contributing a New Framework](#contributing-a-new-framework)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Schema Requirements](#schema-requirements)
- [Code Contributions](#code-contributions)

## Contributing a New Framework

Fluently is framework-agnostic. You can register any collaboration framework that structures human-AI tasks into named dimensions.

### Framework YAML schema

Create `frameworks/{your-framework-id}.yaml`:

```yaml
id: my-framework           # kebab-case, unique
name: My Collaboration Framework
version: 1.0.0
contributor: Your Name
description: >
  One-paragraph description of what the framework is and what problem it solves.
dimensions:
  - key: plan              # kebab-case dimension key
    label: Plan
    description: What planning looks like in this framework.
    canonical_order: 1     # determines rendering/scoring order (must be unique positive int)
  - key: execute
    label: Execute
    description: How execution is handled.
    canonical_order: 2
  - key: review
    label: Review
    description: How outputs are reviewed.
    canonical_order: 3
tags:
  - optional-tag
reference: https://your-framework-reference.example   # optional
```

### CI validation

Every `frameworks/*.yaml` file is validated by `scripts/validate-frameworks.js` against `frameworkDefinitionSchema`. The CI step also regenerates `frameworks/index.json`.

### Adding knowledge cycles for your framework

Once your framework YAML is merged, knowledge cycles can reference it:

```yaml
id: my-cycle
framework_id: my-framework   # must match your framework's id
title: My Cycle Title
domain: coding
dimensions:
  plan:
    description: ...
    example: ...
    antipattern: ...
  execute:
    description: ...
    example: ...
    antipattern: ...
  review:
    description: ...
    example: ...
    antipattern: ...
score_hints:
  plan: 0.34
  execute: 0.33
  review: 0.33
# ... collaboration block required
```

Dimension keys in `dimensions` and `score_hints` must exactly match your framework's dimension keys. The Zod schema is built dynamically per framework, so a typo will fail CI validation.

## Adding a New Fluently 4D Cycle

The easiest way to contribute is by adding a new **Fluently 4D cycle** — a structured knowledge entry that teaches the AI Fluency Framework dimensions: Delegation, Description, Discernment, and Diligence.

### Step 1: Create a YAML File

Create a new `.yaml` file in the `/knowledge/` directory with a descriptive name matching your topic:

```bash
# Example: /knowledge/coding-async-pattern-best-practices.yaml
```

### Step 2: Structure Your Entry

Use this template — every field including `collaboration` is required:

```yaml
id: unique-id-for-entry
title: "Clear, actionable title"
domain: coding  # coding, writing, research, customer-support, education, legal, healthcare, general

dimensions:
  delegation:
    description: How should delegation/augmentation of this task work?
    example: Use AI to suggest options, human makes the final call.
    antipattern: Fully automating without any human checkpoint.
  description:
    description: What context/framing makes the AI most useful here?
    example: Provide repo context, examples of desired output, and explicit constraints.
    antipattern: Vague or missing context leads to irrelevant suggestions.
  discernment:
    description: How do you evaluate if the AI output is trustworthy?
    example: Cross-check AI suggestions against established benchmarks or peer review.
    antipattern: Accepting AI output without verification.
  diligence:
    description: What human accountability is required after AI involvement?
    example: Lead signs off before the output is acted on.
    antipattern: No approval process or audit trail.

score_hints:
  delegation: 0.25  # Must sum to 1.0
  description: 0.25
  discernment: 0.25
  diligence: 0.25

# The collaboration block is required. It captures how the 4Ds sequence as
# human-AI conversation clusters — not single prompts, but chains of related prompts.
# pattern: linear | linear_with_loops | cyclic | iterative | branching
collaboration:
  pattern: linear_with_loops
  description: "One-line description of how the Ds flow for this task."
  sequence:
    - step: 1
      d: delegation
      label: "Negotiate AI scope and autonomy"
      example_prompts:
        - speaker: human
          text: "Can you handle X automatically and flag Y for me?"
        - speaker: ai
          text: "I can flag Y with confidence levels — want me to auto-handle only Z?"
        - speaker: human
          text: "Yes — auto-handle Z, surface everything else."
      triggers_next: "Autonomy boundaries agreed."
    - step: 2
      d: description
      label: "Provide context and constraints"
      example_prompts:
        - speaker: human
          text: "Here is the context, constraints, and examples."
        - speaker: ai
          text: "Should I prioritize A or B?"
        - speaker: human
          text: "A first, then B."
      triggers_next: "AI has sufficient context."
    - step: 3
      d: discernment
      label: "Evaluate AI output"
      example_prompts:
        - speaker: human
          text: "Item 3 looks like a false positive — is it?"
        - speaker: ai
          text: "Possibly — given X, this could be dismissed."
        - speaker: human
          text: "Agreed, dismiss it."
      triggers_next: "Output validated."
      loop_back:
        to: delegation
        condition: "If quality is consistently poor."
        reason: "Scope or autonomy level needs renegotiation."
    - step: 4
      d: diligence
      label: "Approve and document"
      example_prompts:
        - speaker: human
          text: "Approving and logging the decisions."
      triggers_next: "Cycle complete. Restarts for next instance."
      can_restart: true
  transitions:
    - from: delegation
      to: description
      trigger: "Scope agreed."
    - from: description
      to: discernment
      trigger: "AI delivers output."
    - from: discernment
      to: diligence
      trigger: "Output validated."
    - from: discernment
      to: delegation
      trigger: "Quality too low — re-scope."
      is_loop_back: true
    - from: diligence
      to: delegation
      trigger: "Next instance — restart."
      is_cycle_restart: true

tags:
  - your-topic
  - category

contributor: "Your Name"
version: "1.0.0"
```

### Step 3: Understand the Schema

All fields are required and validated by CI:

- **id**: Unique identifier (kebab-case, no spaces)
- **title**: Human-readable name
- **domain**: One of the supported domains (see list below)
- **dimensions**: Four entries, each with `description`, `example`, and `antipattern` strings
  - `delegation`: Automation targets and human touch points
  - `description`: How to brief an AI on this task
  - `discernment`: Quality signals and failure modes
  - `diligence`: Accountability, review, escalation
- **score_hints**: Relative weights — must sum to exactly 1.0
- **tags**: Keywords for searchability
- **contributor**: Your name or GitHub handle
- **version**: Semantic version (start at `1.0.0`)
- **reference** *(optional)*: URL to a related resource, paper, or standard
- **collaboration**: The structural pattern of how the 4Ds flow as human↔AI conversation clusters — **required**
  - `pattern`: One of `linear`, `linear_with_loops`, `cyclic`, `iterative`, `branching`
  - `description`: One-line explanation of the collaboration shape
  - `sequence`: Ordered list of D-clusters (min 2). Each cluster has:
    - `step`: Positive integer (1, 2, 3…)
    - `d`: One of `delegation`, `description`, `discernment`, `diligence`
    - `label`: Short name for the cluster
    - `triggers_next`: Condition that ends this cluster and moves to the next
    - `example_prompts` *(recommended)*: Array of `{ speaker: human|ai, text: "..." }` showing the actual conversation
    - `loop_back` *(if applicable)*: `{ to: d, condition: "...", reason: "..." }` — where to loop if quality fails
    - `can_restart` *(on last step)*: `true` when this step can restart the entire cycle
  - `transitions`: Explicit edges between D-clusters (min 1). Each has:
    - `from` / `to`: D-cluster names
    - `trigger`: What causes the transition
    - `is_loop_back: true` for backward transitions
    - `is_cycle_restart: true` for transitions that restart from the top

### Supported Domains

Choose one domain that best fits your entry:

- `coding` — Software development, debugging, refactoring
- `writing` — Documentation, communication, content
- `research` — Analysis, literature review, synthesis
- `customer-support` — Ticketing, escalation, response drafting
- `education` — Tutoring, curriculum, assessment
- `legal` — Contracts, compliance, risk review
- `healthcare` — Clinical, administrative, patient communication
- `general` — Cross-domain best practices

### Step 4: Test Your Entry

Before submitting, validate locally:

```bash
npm run build
npm test
node scripts/validate-knowledge.js
```

The CI will validate that:
1. Your YAML syntax is correct
2. All required fields are present (including the `collaboration` block)
3. `score_hints` sum to 1.0
4. `collaboration.sequence` has at least 2 steps and `collaboration.transitions` has at least 1
5. All `d` values are valid (`delegation`, `description`, `discernment`, `diligence`)
6. The entry matches the full Zod schema

### Example: Complete Entry

```yaml
id: code-review-tradeoffs
title: "Code Review: Review Depth vs. Speed Tradeoffs"
domain: coding

dimensions:
  delegation:
    description: Code review can be partially delegated to AI for initial triage, but human sign-off is required before merge.
    example: AI flags comments needing attention; senior dev approves before merge.
    antipattern: Merging based solely on AI triage with no human review.
  description:
    description: When briefing AI for code review, specify the context and scope explicitly.
    example: "Review this PR for logical correctness, performance regressions, and security in handleUserAuth(). Ignore style — we use Prettier."
    antipattern: No context, leading to generic or irrelevant suggestions.
  discernment:
    description: Watch for hallucination patterns — AI claiming unused variables, suggesting unnecessary refactors, or missing the real bug.
    example: Cross-check AI findings against test suite results and peer judgment.
    antipattern: Accepting AI review findings without independent verification.
  diligence:
    description: Security-sensitive changes need a human reviewer; breaking API changes require architect approval.
    example: Author reviews AI suggestions, security lead approves auth changes, architect approves API breaks.
    antipattern: No escalation path for security or architecture concerns.

score_hints:
  delegation: 0.3
  description: 0.25
  discernment: 0.25
  diligence: 0.2

collaboration:
  pattern: linear_with_loops
  description: "Human negotiates AI review scope, provides context, evaluates findings, and signs off — looping back if false-positive rate is too high."
  sequence:
    - step: 1
      d: delegation
      label: "Negotiate AI review scope"
      example_prompts:
        - speaker: human
          text: "Can you automatically approve style-only comments and flag logic issues for me?"
        - speaker: ai
          text: "I can flag logic and security issues with high confidence — want me to auto-close only style nits?"
        - speaker: human
          text: "Yes — auto-close style, surface everything else with a severity label."
      triggers_next: "Autonomy boundaries and severity thresholds agreed."
    - step: 2
      d: description
      label: "Provide PR context"
      example_prompts:
        - speaker: human
          text: "Here's the PR diff, our style guide, and the three issues this PR addresses."
        - speaker: ai
          text: "Should I cross-reference open issues when flagging findings?"
        - speaker: human
          text: "Yes — link any finding to the relevant issue if there's a match."
      triggers_next: "AI has sufficient context to begin triage."
    - step: 3
      d: discernment
      label: "Evaluate AI findings"
      example_prompts:
        - speaker: human
          text: "Flag #3 looks like a false positive — the variable is used in the test suite."
        - speaker: ai
          text: "Confirmed — removing it. Do you want me to adjust confidence thresholds?"
        - speaker: human
          text: "Yes, raise the bar for 'unused variable' flags."
      triggers_next: "Findings validated and false positives resolved."
      loop_back:
        to: delegation
        condition: "False-positive rate exceeds 30%."
        reason: "AI scope or severity thresholds need renegotiation."
    - step: 4
      d: diligence
      label: "Approve and document"
      example_prompts:
        - speaker: human
          text: "Senior engineer, please sign off on the remaining flags and log your decision."
      triggers_next: "PR approved and decisions documented."
      can_restart: true
  transitions:
    - from: delegation
      to: description
      trigger: "Autonomy level and severity thresholds agreed."
    - from: description
      to: discernment
      trigger: "AI completes triage analysis."
    - from: discernment
      to: diligence
      trigger: "Findings validated."
    - from: discernment
      to: delegation
      trigger: "False-positive rate too high — re-scope."
      is_loop_back: true
    - from: diligence
      to: delegation
      trigger: "New PR arrives — restart cycle."
      is_cycle_restart: true

tags:
  - code-review
  - collaboration
  - quality-assurance

contributor: "Jane Smith"
version: "1.0.0"
```

## Submitting a Pull Request

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/fluently.git
cd fluently
```

### 2. Create a Feature Branch

```bash
git checkout -b knowledge/add-your-topic
# Example: git checkout -b knowledge/add-async-patterns
```

### 3. Add Your Knowledge Entry

```bash
# Create your YAML file in /knowledge/
vim knowledge/your-topic.yaml
```

### 4. Commit and Push

```bash
git add knowledge/your-topic.yaml
git commit -m "docs: add Fluently 4D cycle for [topic]"
git push origin knowledge/add-your-topic
```

### 5. Open a Pull Request

Go to [GitHub](https://github.com/Fluently-Org/fluently) and open a PR with:

**Title:**
```
docs: add Fluently 4D cycle for [topic]
```

**Description:**
```markdown
## What's the Fluently 4D cycle about?
Brief explanation of the topic and why it matters.

## When should this be used?
Real-world scenarios where this guidance helps.

## Verification
- [x] Schema validation passes locally (`node scripts/validate-knowledge.js`)
- [x] All 4 dimensions are complete (description, example, antipattern)
- [x] score_hints sum to 1.0
- [x] score_hints reflect relative importance
- [x] collaboration block is present with at least 2 sequence steps and 1 transition
- [x] collaboration.pattern is one of: linear, linear_with_loops, cyclic, iterative, branching
- [x] example_prompts show realistic human↔AI exchanges
```

### What Happens Next

After you submit:

1. **Automated Validation** — CI checks that your YAML is valid
2. **Fluency Scoring** — Bot comments with the 4D score of your entry
3. **Review** — Community and maintainers discuss the guidance quality
4. **Merge** — Once approved, your contribution becomes part of the shared knowledge base

## Schema Requirements

Your YAML entry must adhere to this Zod schema (enforced by CI via `scripts/validate-knowledge.js`):

```typescript
// D dimension names
const dEnum = z.enum(["delegation", "description", "discernment", "diligence"]);

// Each dimension block
const dimensionSchema = z.object({
  description: z.string(),
  example: z.string(),
  antipattern: z.string(),
});

// One step in the collaboration sequence (a D-cluster)
const promptClusterSchema = z.object({
  step: z.number().int().positive(),
  d: dEnum,
  label: z.string(),
  example_prompts: z.array(z.object({    // recommended
    speaker: z.enum(["human", "ai"]),
    text: z.string(),
  })).optional(),
  triggers_next: z.string(),
  loop_back: z.object({                  // if applicable
    to: dEnum,
    condition: z.string(),
    reason: z.string(),
  }).optional(),
  can_restart: z.boolean().optional(),   // true on the last Dil step
});

// One edge in the transition graph
const transitionSchema = z.object({
  from: dEnum,
  to: dEnum,
  trigger: z.string(),
  is_loop_back: z.boolean().optional(),
  is_cycle_restart: z.boolean().optional(),
});

// The collaboration block
const collaborationSchema = z.object({
  pattern: z.enum(["linear", "linear_with_loops", "cyclic", "iterative", "branching"]),
  description: z.string(),
  sequence: z.array(promptClusterSchema).min(2),
  transitions: z.array(transitionSchema).min(1),
});

// Full entry schema
const knowledgeEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  domain: z.enum(["coding", "writing", "research", "customer-support",
                  "education", "legal", "healthcare", "general"]),
  dimensions: z.object({
    delegation:  dimensionSchema,
    description: dimensionSchema,
    discernment: dimensionSchema,
    diligence:   dimensionSchema,
  }),
  score_hints: z.object({
    delegation: z.number().min(0).max(1),
    description: z.number().min(0).max(1),
    discernment: z.number().min(0).max(1),
    diligence: z.number().min(0).max(1),
  }).refine(obj => Math.abs(Object.values(obj).reduce((a, b) => a + b, 0) - 1) < 1e-9, {
    message: "score_hints must sum to 1.0"
  }),
  tags: z.array(z.string()),
  contributor: z.string(),
  reference: z.string().optional(),     // optional URL
  version: z.string(),
  collaboration: collaborationSchema,   // required
});
```

**Common validation failures:**

| Error | Solution |
|-------|----------|
| `collaboration` missing | Add the full collaboration block — it is required |
| `score_hints must sum to 1.0` | delegation + description + discernment + diligence must equal 1.0 |
| `domain not recognized` | Use only the listed domains (see above) |
| `dimension missing field` | Each dimension needs `description`, `example`, and `antipattern` |
| `sequence too short` | `collaboration.sequence` requires at least 2 steps |
| `transitions too short` | `collaboration.transitions` requires at least 1 entry |
| `invalid d value` | `d` must be one of: `delegation`, `description`, `discernment`, `diligence` |

## Code Contributions

Want to improve the CLI, MCP server, or scorer engine?

### Getting Started

```bash
# Install dependencies
npm install

# TypeScript compilation
npm run build

# Run tests
npm test -- --run

# Development with watch mode
npm run dev
```

### File Structure

```
fluently/
├── packages/
│   ├── cli/              # fluent CLI (binary: fluent)
│   ├── mcp-server/       # MCP server for Claude/other models
│   └── scorer/           # Shared 4D scoring engine
├── knowledge/            # Fluently 4D cycles YAML database
├── scripts/              # CI/CD and utility scripts
└── .github/workflows/    # GitHub Actions workflows
```

### Testing Requirements

- Add tests for new features in `__tests__/` folders
- All tests must pass: `npm test -- --run`
- Aim for >80% code coverage

### Pull Request Standards

1. **One concern per PR** — Don't mix refactoring with features
2. **Describe the why** — Explain motivation, not just what changed
3. **Reference issues** — Link to GitHub issues when applicable
4. **Test coverage** — New code needs tests
5. **Update docs** — README, comments, or CONTRIBUTING.md if needed

## Questions?

- **GitHub Issues** — For bugs, feature requests, or discussions
- **Discussions** — Community Q&A and ideas

## Code of Conduct

We welcome contributions from everyone. Please be respectful and constructive in all interactions.

---

**Happy contributing! Your Fluently 4D cycles make the knowledge base smarter for everyone.** 🚀
