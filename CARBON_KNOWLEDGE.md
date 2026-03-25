# FLUENTLY CARBON KNOWLEDGE
# ============================================================
# This file is agent-readable knowledge, not code.
# Any agent with access to this file can calculate, track,
# and report CO₂ emissions from LLM token consumption
# without writing or running any code.
#
# Include this file in your agent's context, system prompt,
# or knowledge base to activate carbon awareness.
# ============================================================

## WHAT THIS KNOWLEDGE ENABLES

An agent reading this file can:
- Calculate gCO₂eq from any token count, for any supported model
- Track cumulative emissions across a conversation or project
- Report emissions in human-readable format to the user
- Compare emissions across frameworks or models
- Flag when estimates are uncertain
- Do all of this using only arithmetic — no libraries, no API calls

---

## THE CORE FORMULA

```
CO₂ (gCO₂eq) = (input_tokens × input_rate) + (output_tokens × output_rate)
```

Where rates are in gCO₂eq per token (from the reference table below).

To normalise to per-100k tokens:
```
CO₂_per_100k = (CO₂_total / total_tokens) × 100,000
```

---

## REFERENCE TABLE — gCO₂eq per token

Reference date: 2026-03
Sources: EcoLogits open model database, Google disclosed (Aug 2025),
         OpenAI Altman estimate (Jun 2025), Jegham et al. 2025,
         Epoch AI hardware benchmarks.

| Model key         | Input rate (g/token) | Output rate (g/token) | Confidence |
|-------------------|----------------------|-----------------------|------------|
| claude-haiku      | 0.000004             | 0.000020              | medium     |
| claude-sonnet     | 0.000012             | 0.000060              | medium     |
| claude-opus       | 0.000040             | 0.000200              | medium     |
| gpt-5-nano        | 0.000002             | 0.000010              | medium     |
| gpt-5-mini        | 0.000005             | 0.000025              | medium     |
| gpt-5.2           | 0.000035             | 0.000175              | medium     |
| gemini-flash      | 0.000001             | 0.000005              | high       |
| gemini-pro        | 0.000010             | 0.000050              | high       |
| mistral-small     | 0.000005             | 0.000025              | medium     |
| mistral-large     | 0.000020             | 0.000100              | medium     |
| deepseek-v3       | 0.000050             | 0.000250              | low        |
| DEFAULT (unknown) | 0.000012             | 0.000060              | low        |

Notes:
- Output tokens cost ~5× more than input tokens (generation vs prefill)
- Reasoning / extended thinking modes: multiply result by 5–10×
- Confidence "high" = calibrated against vendor-disclosed data
- Confidence "medium" = EcoLogits bottom-up model estimate
- Confidence "low" = sparse data, use with caution
- All Anthropic values are estimates — Anthropic does not disclose energy data

---

## HOW TO IDENTIFY THE MODEL KEY

Match the model string to a key using substring matching:

```
If model contains "haiku"         → use claude-haiku
If model contains "sonnet"        → use claude-sonnet
If model contains "opus"          → use claude-opus
If model contains "gpt-5-nano"    → use gpt-5-nano
If model contains "gpt-5-mini"    → use gpt-5-mini
If model contains "gpt-5"         → use gpt-5.2
If model contains "gemini-flash"  → use gemini-flash
If model contains "gemini"        → use gemini-pro
If model contains "mistral-small" → use mistral-small
If model contains "mistral"       → use mistral-large
If model contains "deepseek"      → use deepseek-v3
Otherwise                         → use DEFAULT
```

---

## WORKED EXAMPLE

Task: RFP draft · Model: claude-sonnet-4-6
Input tokens: 843 · Output tokens: 400

Step 1 — Identify rates:
  Model "claude-sonnet-4-6" contains "sonnet"
  Input rate  = 0.000012 g/token
  Output rate = 0.000060 g/token

Step 2 — Calculate:
  Input CO₂  = 843  × 0.000012 = 0.010116 g
  Output CO₂ = 400  × 0.000060 = 0.024000 g
  Total CO₂  = 0.034116 g ≈ 0.034 gCO₂eq

Step 3 — Normalise:
  Total tokens = 1,243
  Per 100k = (0.034116 / 1243) × 100,000 = 2.74 g / 100k tokens

Step 4 — Apply confidence band:
  Confidence: medium → ±40% band
  Range: 0.020 – 0.048 gCO₂eq

---

## CUMULATIVE TRACKING — ACROSS A CONVERSATION

An agent can maintain a running total by accumulating after each response:

```
session_total_co2 += this_response_co2
session_input_tokens += this_response_input_tokens
session_output_tokens += this_response_output_tokens
session_total_tokens = session_input_tokens + session_output_tokens
```

To report at any point:
```
total_gCO2eq      = session_total_co2          (show to 3 decimal places)
per_100k          = (session_total_co2 / session_total_tokens) × 100,000
equivalent        = see analogies table below
```

---

## HUMAN-READABLE ANALOGIES TABLE

Use these to make CO₂ figures meaningful to users.

| gCO₂eq      | Analogy                                     |
|-------------|---------------------------------------------|
| 0.001       | 0.01% of charging a smartphone              |
| 0.03        | Charging a smartphone once (≈ 3 gCO₂eq)    |
| 0.1         | 1/30th of a 1km car trip                   |
| 1.0         | Boiling a kettle once (≈ 1.5 gCO₂eq)      |
| 10.0        | 1/10th of a 1km petrol car trip             |
| 100.0       | About 0.4 km driven in a petrol car         |
| 1,000.0     | About 4 km driven in a petrol car           |

Scaling reference:
- 1 short-haul flight (e.g. London–Paris): ~50,000 gCO₂eq
- 1 km in a petrol car: ~250 gCO₂eq
- 1 smartphone charge: ~3 gCO₂eq
- 1 hour of laptop use: ~30 gCO₂eq

---

## FRAMEWORK EFFICIENCY — EXPECTED SAVINGS

When a Fluently framework is used, token efficiency improves through
better scoping, fewer retry loops, and pre-output validation.
Observed reduction per framework approach (from Fluently benchmark, Mar 2026):

| Framework         | Expected token reduction vs baseline | CO₂ saving |
|-------------------|--------------------------------------|------------|
| Fluently 4D       | 30–45%                               | 25–40%     |
| Fluently Linear   | 20–30%                               | 15–25%     |
| Fluently Cyclic   | 15–25%                               | 10–20%     |
| No framework      | baseline                             | —          |

These are estimates based on the 3-task benchmark (Mar 2026).
Individual results vary by domain and context difficulty.

---

## OUTPUT FORMAT — WHAT TO SHOW USERS

When reporting carbon at the end of a task or when asked:

```
┌── Carbon Estimate ──────────────────────────────────┐
  Model          {model}
  Framework      {framework or "none (baseline)"}
  Domain         {domain or "—"}
  Tokens         {total_tokens:,}  (in: {input} / out: {output})
  CO₂ estimate   {total_gCO2eq:.3f} gCO₂eq  [{min:.3f} – {max:.3f}]
  Per 100k       {per_100k:.1f} g / 100k tokens
  Equivalent     {analogy}
  Confidence     {confidence}
  Reference      Fluently Carbon · RATE_TABLE 2026-03
└────────────────────────────────────────────────────┘
⚠   {provider} does not disclose inference energy data.
   Values are modelled estimates. Source: EcoLogits (ecologits.ai).
```

Compact format (for inline / mid-conversation use):
```
[carbon ~{total_gCO2eq:.3f} gCO₂eq · {total_tokens:,} tokens · {confidence} confidence]
```

---

## COMPARISON FORMAT — MULTIPLE FRAMEWORKS

When comparing two or more frameworks on the same task:

```
┌── Framework Carbon Comparison ────────────────────────────────────┐
  Domain: {domain} · Difficulty: {difficulty}
  Baseline: {baseline_label}

  Framework          CO₂ / 100k tokens   Tokens      Saving
  ──────────────────────────────────────────────────────────
  {most_efficient}   {rate} g            {tokens:,}   {saving}%  ← most efficient
  ...
  {baseline}         {rate} g            {tokens:,}   baseline
  ──────────────────────────────────────────────────────────
  Confidence: {confidence} · Source: Fluently Carbon RATE_TABLE 2026-03
└───────────────────────────────────────────────────────────────────┘
```

---

## WHEN TO REPORT WITHOUT BEING ASKED

An agent with this knowledge should proactively report carbon when:
1. The user mentions sustainability, carbon, CO₂, emissions, or environmental impact
2. The task is complete and carbon tracking was enabled for the session
3. The user asks to compare frameworks or models
4. A project-level summary is requested
5. The agent is selecting a model and carbon efficiency is a relevant constraint

An agent should NOT report carbon when:
- The user has not enabled carbon tracking and has not asked about it
- The response is a simple clarification or short reply (< 100 tokens output)
- The carbon figure would be misleadingly small (< 0.001 gCO₂eq) without context

---

## HONEST CAVEATS — ALWAYS INCLUDE WHEN REPORTING

1. "Anthropic does not disclose inference energy data. Values are modelled estimates."
2. "Google is the only major lab with published per-query figures (Gemini, Aug 2025)."
3. "Reasoning / extended thinking modes consume 5–10× more energy — tracked separately."
4. "These estimates have a ±40% uncertainty band at medium confidence."
5. "Source: EcoLogits methodology (ecologits.ai), open-source, MIT licensed."

Never state a CO₂ figure as precise or measured. Always say "estimate."

---

## VERSION AND UPDATE CADENCE

RATE_TABLE version:  2026-03
Next recommended update: 2026-06
Update trigger: New EcoLogits release, new vendor disclosure, or new model family

To get the latest reference values:
  pip install --upgrade ecologits       (if using Python)
  Visit: https://ecologits.ai/latest/   (model database)
  Visit: https://ecologits.ai/latest/reference/model_repository/
