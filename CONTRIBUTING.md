# Contributing to Fluently

Thank you for your interest in contributing to Fluently! This document explains how to submit new Fluently 4D cycles and contribute to the codebase.

## Table of Contents

- [Adding a New Fluently 4D Cycle](#adding-a-new-fluently-4d-cycle)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Schema Requirements](#schema-requirements)
- [Code Contributions](#code-contributions)

## Adding a New Fluently 4D Cycle

The easiest way to contribute is by adding a new **Fluently 4D cycle** — a structured knowledge entry that teaches the AI Fluency Framework dimensions: Delegation, Description, Discernment, and Diligence.

### Step 1: Create a YAML File

Create a new `.yaml` file in the `/knowledge/` directory with a descriptive name matching your topic:

```bash
# Example: /knowledge/coding-async-pattern-best-practices.yaml
```

### Step 2: Structure Your Entry

Use this template and fill in all four sections:

```yaml
id: unique-id-for-entry
title: "Clear, actionable title"
domain: coding  # or: writing, research, customer-support, education, legal, healthcare, general

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
  delegation: 0.25
  description: 0.25
  discernment: 0.25
  diligence: 0.25

tags:
  - async
  - patterns
  - best-practices

contributor: "Your Name"
version: "1.0.0"
```

### Step 3: Understand the Schema

Each field is required and validated:

- **id**: Unique identifier (kebab-case, no spaces)
- **title**: Human-readable name (max 100 chars recommended)
- **domain**: Category for organization (see domain list below)
- **dimensions**: Four entries, each with `description`, `example`, and `antipattern` strings
  - `delegation`: Automation targets and human touch points
  - `description`: How to brief an AI on this task
  - `discernment`: Quality signals and failure modes
  - `diligence`: Accountability, review, escalation
- **score_hints**: Relative weights (must sum to 1.0)
- **tags**: Keywords for searchability
- **contributor**: Your name or GitHub handle
- **version**: Semantic version (start at 1.0.0)

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
2. All required fields are present
3. score_hints sum to 1.0
4. The entry matches the Zod schema

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
- [x] Schema validation passes locally (`npm test`)
- [x] All 4 dimensions are complete
- [x] score_hints sum to 1.0
- [x] score_hints reflect relative importance
```

### What Happens Next

After you submit:

1. **Automated Validation** — CI checks that your YAML is valid
2. **Fluency Scoring** — Bot comments with the 4D score of your entry
3. **Review** — Community and maintainers discuss the guidance quality
4. **Merge** — Once approved, your contribution becomes part of the shared knowledge base

## Schema Requirements

Your YAML entry must adhere to this Zod schema (enforced by CI):

```typescript
const knowledgeEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  domain: z.enum(["coding", "writing", "research", "customer-support", "education", "legal", "healthcare", "general"]),

  dimensions: z.object({
    delegation: z.object({ description: z.string(), example: z.string(), antipattern: z.string() }),
    description: z.object({ description: z.string(), example: z.string(), antipattern: z.string() }),
    discernment: z.object({ description: z.string(), example: z.string(), antipattern: z.string() }),
    diligence:   z.object({ description: z.string(), example: z.string(), antipattern: z.string() }),
  }),

  score_hints: z.object({
    delegation: z.number().min(0).max(1),
    description: z.number().min(0).max(1),
    discernment: z.number().min(0).max(1),
    diligence: z.number().min(0).max(1),
  }).refine(obj => Object.values(obj).reduce((a, b) => a + b, 0) === 1, {
    message: "score_hints must sum to 1.0"
  }),

  tags: z.array(z.string()),
  contributor: z.string(),
  version: z.string(),
});
```

**Common validation failures:**

| Error | Solution |
|-------|----------|
| `score_hints must sum to 1.0` | Make sure delegation + description + discernment + diligence = 1.0 |
| `domain not recognized` | Use only: coding, writing, research, customer-support, education, legal, healthcare, general |
| `dimension missing field` | Each dimension needs `description`, `example`, and `antipattern` strings |

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
