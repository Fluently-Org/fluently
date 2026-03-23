# @fluently/scorer

**Shared scoring engine for the [Fluently 4D Framework](https://fluently-org.github.io/fluently/).** Validates knowledge YAML against the schema and ranks cycles by keyword similarity for any AI task.

Used internally by both `fluently-cli` and `fluently-mcp-server`. Expose it in your own tools to build on top of the Fluently knowledge base.

[![npm version](https://img.shields.io/npm/v/@fluently/scorer.svg)](https://www.npmjs.com/package/@fluently/scorer)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

---

## Install

```bash
npm install @fluently/scorer
```

Requires Node.js 20+. Pure local computation — no network calls, no credentials.

---

## API

### `loadKnowledgeEntries(knowledgeDir)`

Load and Zod-validate every `.yaml` file in a directory.
Throws if any file fails schema validation — keeps CI strict about malformed entries.

```typescript
import { loadKnowledgeEntries } from '@fluently/scorer';

const entries = loadKnowledgeEntries('./knowledge');
// → KnowledgeEntry[]  (Zod-validated)

console.log(entries[0].title);   // "Code Review Triage"
console.log(entries[0].domain);  // "coding"
console.log(entries[0].tags);    // ["code-review", "triage", "automation"]
```

---

### `scoreTask(input, knowledgeDir)`

Score a task against all loaded cycles and return the top 3 matches ordered by similarity.

```typescript
import { scoreTask } from '@fluently/scorer';
import type { TaskInput } from '@fluently/scorer';

const input: TaskInput = {
    description:       'AI reviews PRs for style issues, humans approve before merge',
    delegation_intent: 'augmented',   // "automated" | "augmented" | "supervised"
};

const results = scoreTask(input, './knowledge');

results.forEach(({ entry, dimensionScores }) => {
    console.log(entry.title);
    console.log(dimensionScores);
    // { delegation: 80, description: 90, discernment: 70, diligence: 75 }
});
```

**`delegation_intent` values:**

| Value | Meaning |
|-------|---------|
| `"automated"` | AI decides without human review |
| `"augmented"` | Human and AI collaborate |
| `"supervised"` | Human decides, AI assists |

---

### `checkPrivacy(text, options?)`

Scan text for tokens that may indicate private data (names, emails, keys, etc.).
Useful as a pre-flight check before sending content to an AI provider.

```typescript
import { checkPrivacy } from '@fluently/scorer';
import type { PrivacyCheckOptions } from '@fluently/scorer';

const result = checkPrivacy('Contact john.doe@example.com about the API_KEY leak', {
    flagEmails: true,
    flagKeys:   true,
});

console.log(result.issues);
// [
//   { type: 'email', value: 'john.doe@example.com', ... },
//   { type: 'key',   value: 'API_KEY',              ... },
// ]
```

---

### Schema validation (`@fluently/scorer/schema`)

```typescript
import { knowledgeEntrySchema, domainEnum, dimensionSchema } from '@fluently/scorer/schema';

// Validate a raw YAML object
const entry = knowledgeEntrySchema.parse(rawYaml);

// Check valid domains
domainEnum.options;
// ["coding", "writing", "research", "customer-support", "education", "legal", "healthcare", "general"]

// Validate a single dimension block
const dim = dimensionSchema.parse({
    description: '...',
    example:     '...',
    antipattern: '...',
});
```

---

## TypeScript types

```typescript
import type { TaskInput, KnowledgeEntry, PrivacyCheckResult, PrivacyIssue, PrivacyCheckOptions } from '@fluently/scorer';
```

| Type | Description |
|------|-------------|
| `TaskInput` | Input to `scoreTask` — `description` + `delegation_intent` |
| `KnowledgeEntry` | Zod-inferred type of a validated YAML entry |
| `PrivacyCheckResult` | Return type of `checkPrivacy` |
| `PrivacyIssue` | Individual flagged token with type, value, position |
| `PrivacyCheckOptions` | Options for `checkPrivacy` |

---

## Design

**No network calls.** The scorer reads YAML files from disk and scores with binary cosine similarity — no API keys, no external dependencies beyond `js-yaml` and `zod`.

**No false-precision scores.** Numeric dimension scores reflect keyword overlap, not AI quality. They are signals for ranking, not ground truth assessments.

**Strict schema.** Every entry must pass the Zod schema before it is accepted. This runs in CI on every PR so the knowledge base never contains malformed cycles.

---

## Links

- **Knowledge Base** — [fluently-org.github.io/fluently/knowledge.html](https://fluently-org.github.io/fluently/knowledge.html)
- **GitHub repo** — [github.com/Fluently-Org/fluently](https://github.com/Fluently-Org/fluently)
- **CLI** — [npmjs.com/package/fluently-cli](https://www.npmjs.com/package/fluently-cli)
- **MCP server** — [npmjs.com/package/fluently-mcp-server](https://www.npmjs.com/package/fluently-mcp-server)

---

## License

[MIT](../../LICENSE)
