# FLUENTLY SKILL: carbon_tracker
# ============================================================
# Skill type:   transversal (applies across all frameworks)
# Trigger:      carbon | CO₂ | emissions | token cost | sustainability
# Requires:     CARBON_KNOWLEDGE.md in context (or as attached knowledge)
# Code needed:  NO — pure reasoning + arithmetic
# ============================================================

---

## SKILL IDENTITY

name:        carbon_tracker
version:     0.1.0
type:        transversal
category:    observability
description: >
  Track, calculate, and report CO₂ emissions from LLM token consumption
  across any conversation, session, or project. Compare emissions across
  Fluently framework approaches. No code or library required.

---

## WHEN THIS SKILL ACTIVATES

Activate when the user or calling agent:
- Asks about carbon, CO₂, emissions, environmental impact, or energy use
- Asks to compare frameworks by efficiency (not just output quality)
- Asks "how much has this cost in CO₂?"
- Asks "which framework is greener?"
- Enables carbon tracking at session or project start
- Requests a summary at end of task

---

## INPUTS

```yaml
inputs:
  required:
    - model:          string    # e.g. "claude-sonnet-4-6"
    - input_tokens:   integer
    - output_tokens:  integer

  optional:
    - framework:      string    # "4D" | "linear" | "cyclic" | null
    - domain:         string    # e.g. "rfp_drafting"
    - difficulty:     enum      # "low" | "medium" | "high"
    - scope:          enum      # "call" | "session" | "project"
    - compare_runs:   list      # list of {label, framework, input_tokens, output_tokens}
    - show_analogy:   boolean   # default true
    - show_comparison: boolean  # default false
```

---

## SKILL STEPS

### STEP 1 — Identify model key

Match `model` string to reference table key using substring rules
defined in CARBON_KNOWLEDGE.md.

Output: `model_key`, `input_rate`, `output_rate`, `confidence`

---

### STEP 2 — Calculate CO₂

```
input_co2  = input_tokens  × input_rate
output_co2 = output_tokens × output_rate
total_co2  = input_co2 + output_co2         (in gCO₂eq)
total_tokens = input_tokens + output_tokens
per_100k   = (total_co2 / total_tokens) × 100,000
range_min  = total_co2 × 0.60
range_max  = total_co2 × 1.40
```

---

### STEP 3 — Accumulate (if scope = session or project)

Add to running totals maintained in agent memory or conversation state:
```
session.total_co2     += total_co2
session.input_tokens  += input_tokens
session.output_tokens += output_tokens
```

---

### STEP 4 — Select analogy

From the analogies table in CARBON_KNOWLEDGE.md, find the closest match
to `total_co2` and format as a plain-language equivalent.

---

### STEP 5 — Render output

Use the output format defined in CARBON_KNOWLEDGE.md.

If `scope = call`: use the full carbon block format.
If `scope = session` or `project`: prepend cumulative totals.
If `show_comparison = true` and `compare_runs` provided: use comparison format.

Always append the honest caveats section.

---

## OUTPUTS

```yaml
outputs:
  total_co2_gCO2eq:     float    # e.g. 0.034
  range_min_gCO2eq:     float
  range_max_gCO2eq:     float
  per_100k_gCO2eq:      float    # normalised rate
  total_tokens:         integer
  model_key:            string
  confidence:           string   # "high" | "medium" | "low"
  analogy:              string   # human-readable equivalent
  formatted_block:      string   # ready-to-display text block
  comparison:           object   # only if compare_runs provided
    most_efficient:     string
    baseline:           string
    runs:               list
```

---

## COMPARISON SUB-SKILL

When `compare_runs` is provided, execute comparison:

For each run in `compare_runs`:
1. Calculate CO₂ using STEP 1–2
2. Calculate `per_100k`

Then:
```
baseline_run   = run where framework is null, or highest per_100k if none
for each run:
  saving_pct = (1 - run.per_100k / baseline_run.per_100k) × 100
```

Rank runs by `per_100k` ascending (most efficient first).

Format using the comparison block from CARBON_KNOWLEDGE.md.

---

## EXAMPLE INVOCATIONS

### Single call tracking
```
Skill: carbon_tracker
Inputs:
  model: "claude-sonnet-4-6"
  input_tokens: 843
  output_tokens: 400
  framework: "4D"
  domain: "rfp_drafting"
  scope: "call"
```

Expected output:
```
┌── Carbon Estimate ──────────────────────────────────┐
  Model          claude-sonnet-4-6
  Framework      4D
  Domain         rfp_drafting
  Tokens         1,243  (in: 843 / out: 400)
  CO₂ estimate   0.034 gCO₂eq  [0.020 – 0.048]
  Per 100k       2.7 g / 100k tokens
  Equivalent     ~1% of a smartphone charge
  Confidence     medium
  Reference      Fluently Carbon · RATE_TABLE 2026-03
└────────────────────────────────────────────────────┘
⚠   Anthropic does not disclose inference energy data.
   Values are modelled estimates. Source: EcoLogits (ecologits.ai).
```

### Framework comparison
```
Skill: carbon_tracker
Inputs:
  domain: "rfp_drafting"
  difficulty: "medium"
  show_comparison: true
  compare_runs:
    - label: "no_framework"  framework: null  input_tokens: 1100  output_tokens: 620
    - label: "fluently_4D"   framework: "4D"  input_tokens: 843   output_tokens: 400
    - label: "fluently_linear" framework: "linear" input_tokens: 920 output_tokens: 480
```

---

## SKILL CONSTRAINTS

- Never fabricate CO₂ numbers. If model is unknown, use DEFAULT key and mark confidence "low".
- Never claim figures are measured — always say "estimate" or "modelled estimate".
- Never omit the honest caveats when reporting to a user.
- Reasoning / extended thinking: always note the ×5–10 multiplier if active.
- If input_tokens and output_tokens are both 0: return null with message
  "No token data available — carbon estimate requires token counts."

---

## SKILL METADATA

```yaml
metadata:
  depends_on:
    knowledge: CARBON_KNOWLEDGE.md
    code: optional (ecologits via fluently[carbon])
  compatible_with:
    frameworks: [4D, linear, cyclic, none]
    providers: [anthropic, openai, google, mistral, cohere, huggingface]
  output_formats: [block, compact, json, markdown_table]
  tags: [carbon, co2, sustainability, observability, transversal]
  reference_url: https://ecologits.ai/latest/
  license: MIT (EcoLogits methodology)
```
