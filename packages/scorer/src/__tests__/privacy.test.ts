/**
 * privacy.test.ts
 *
 * Tests for the privacy/confidentiality scanner.
 *
 * Structure:
 *   1. Individual rule triggers — one test per detection rule
 *   2. Field traversal — issues are found in nested objects and arrays
 *   3. Standard vs strict mode — warnings become blocks in strict mode
 *   4. Redaction — matched values are never returned in plaintext
 *   5. Clean cycles — no false positives on well-formed data
 */

import { describe, it, expect } from "vitest";
import { checkPrivacy } from "../privacy.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal valid cycle — used as a clean baseline for mutations. */
const cleanCycle = {
  id:          "safe-cycle",
  title:       "Safe Test Cycle",
  domain:      "coding",
  tags:        ["testing"],
  contributor: "Test Author",
  version:     "1.0.0",
  dimensions: {
    delegation:  { description: "Human decides",       example: "Human approves merge",    antipattern: "Blind automation" },
    description: { description: "Clear task context",  example: "PR has full description",  antipattern: "Vague prompt" },
    discernment: { description: "Review AI output",    example: "Spot hallucinations",       antipattern: "Accept without check" },
    diligence:   { description: "Human accountable",   example: "Team lead signs off",       antipattern: "No audit trail" },
  },
  score_hints: { delegation: 0.25, description: 0.25, discernment: 0.25, diligence: 0.25 },
};

/** Return a copy of cleanCycle with one field replaced. */
function withField(dotPath: string, value: string): object {
  const copy = JSON.parse(JSON.stringify(cleanCycle));
  const keys  = dotPath.split(".");
  let obj: any = copy;
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = value;
  return copy;
}

// ── 1. Individual rule triggers ───────────────────────────────────────────────

describe("checkPrivacy — blocking rules", () => {
  it("blocks an API key assignment pattern", () => {
    const r = checkPrivacy(withField("dimensions.delegation.example", 'Set api_key = "sk-live-abc123def456ghi789"'));
    expect(r.passed).toBe(false);
    expect(r.blocks.some(i => i.rule === "api_key_assignment")).toBe(true);
  });

  it("blocks a GitHub personal access token", () => {
    const r = checkPrivacy(withField("dimensions.description.example", "Use token ghp_abc123XYZdef456UVWxyz789QRS0"));
    expect(r.passed).toBe(false);
    expect(r.blocks.some(i => i.rule === "github_token")).toBe(true);
  });

  it("blocks an AWS access key ID", () => {
    const r = checkPrivacy(withField("title", "Configure AKIAIOSFODNN7EXAMPLE key"));
    expect(r.passed).toBe(false);
    expect(r.blocks.some(i => i.rule === "aws_access_key")).toBe(true);
  });

  it("blocks a US SSN pattern", () => {
    const r = checkPrivacy(withField("dimensions.diligence.example", "Verify user 123-45-6789 is authorised"));
    expect(r.passed).toBe(false);
    expect(r.blocks.some(i => i.rule === "ssn")).toBe(true);
  });

  it("blocks a hardcoded password", () => {
    const r = checkPrivacy(withField("dimensions.discernment.antipattern", 'password: "MySecretP@ss"'));
    expect(r.passed).toBe(false);
    expect(r.blocks.some(i => i.rule === "password_in_text")).toBe(true);
  });
});

describe("checkPrivacy — warning rules (standard mode)", () => {
  it("warns on an email address", () => {
    const r = checkPrivacy(withField("dimensions.delegation.example", "Send to john.doe@example.com for approval"));
    expect(r.passed).toBe(true); // no blocks
    expect(r.warnings.some(i => i.rule === "email_address")).toBe(true);
  });

  it("warns on a private IP address", () => {
    const r = checkPrivacy(withField("dimensions.description.example", "Deploy to 192.168.1.42 first"));
    expect(r.warnings.some(i => i.rule === "private_ip")).toBe(true);
  });

  it("warns on an internal URL", () => {
    const r = checkPrivacy(withField("dimensions.delegation.description", "File ticket at https://jira.internal.corp/browse/PROJ-1"));
    expect(r.warnings.some(i => i.rule === "internal_url")).toBe(true);
  });

  it("warns on a JIRA-style ticket ID", () => {
    const r = checkPrivacy(withField("dimensions.diligence.example", "Close ticket PROJ-4521 after approval"));
    expect(r.warnings.some(i => i.rule === "jira_ticket")).toBe(true);
  });

  it("warns on a confidentiality marker", () => {
    const r = checkPrivacy(withField("title", "Internal Only — Code Review Process"));
    expect(r.warnings.some(i => i.rule === "confidentiality_marker")).toBe(true);
  });

  it("warns on a person's name with title prefix", () => {
    const r = checkPrivacy(withField("dimensions.diligence.example", "Dr. John Smith reviews and signs off"));
    expect(r.warnings.some(i => i.rule === "pii_name_pattern")).toBe(true);
  });
});

// ── 2. Field traversal ────────────────────────────────────────────────────────

describe("checkPrivacy — field traversal", () => {
  it("detects issues in nested dimension fields", () => {
    const r = checkPrivacy(withField("dimensions.discernment.example", "email alice@secret.org for approval"));
    expect(r.warnings.some(i => i.field.startsWith("dimensions.discernment"))).toBe(true);
  });

  it("detects issues in array values (tags)", () => {
    const cycle = { ...cleanCycle, tags: ["internal-only", "coding"] };
    const r = checkPrivacy(cycle);
    expect(r.warnings.some(i => i.field.includes("tags"))).toBe(true);
  });

  it("reports the correct field path for deeply nested matches", () => {
    const cycle = JSON.parse(JSON.stringify(cleanCycle));
    cycle.collaboration = {
      pattern: "linear",
      description: "test",
      sequence: [{
        step: 1, d: "delegation", label: "Setup",
        triggers_next: "done",
        example_prompts: [
          { speaker: "human", text: "Send to admin@corp.internal for review" },
        ],
      }],
      transitions: [],
    };
    const r = checkPrivacy(cycle);
    const emailIssue = r.warnings.find(i => i.rule === "email_address");
    expect(emailIssue).toBeDefined();
    expect(emailIssue?.field).toContain("collaboration");
  });
});

// ── 3. Standard vs strict mode ────────────────────────────────────────────────

describe("checkPrivacy — strict mode (bridge)", () => {
  it("promotes warnings to blocks in strict mode", () => {
    const cycle = withField("dimensions.delegation.example", "Send results to user@company.com");
    const standard = checkPrivacy(cycle, { mode: "standard" });
    const strict   = checkPrivacy(cycle, { mode: "strict" });

    // Standard: warning (not a block)
    expect(standard.passed).toBe(true);
    expect(standard.warnings.length).toBeGreaterThan(0);

    // Strict: same finding becomes a block
    expect(strict.passed).toBe(false);
    expect(strict.blocks.length).toBeGreaterThan(0);
    expect(strict.warnings).toHaveLength(0); // all promoted, none left as warnings
  });

  it("still blocks secrets in strict mode", () => {
    const r = checkPrivacy(
      withField("dimensions.delegation.example", "token: ghp_abc123XYZdef456UVWxyz789QRS0"),
      { mode: "strict" }
    );
    expect(r.passed).toBe(false);
    expect(r.blocks.some(i => i.rule === "github_token")).toBe(true);
  });
});

// ── 4. Redaction ──────────────────────────────────────────────────────────────

describe("checkPrivacy — redaction", () => {
  it("never returns the full secret in redactedMatch", () => {
    const secret = "ghp_ABCDEF1234567890XYZABC";
    const r = checkPrivacy(withField("title", `Use token ${secret}`));
    const issue = r.blocks.find(i => i.rule === "github_token");
    expect(issue).toBeDefined();
    // redactedMatch must not contain the full secret
    expect(issue!.redactedMatch).not.toBe(secret);
    expect(issue!.redactedMatch).toContain("★");
  });
});

// ── 5. Clean cycle — no false positives ───────────────────────────────────────

describe("checkPrivacy — clean cycle", () => {
  it("passes with no issues on a well-formed cycle", () => {
    const r = checkPrivacy(cleanCycle);
    expect(r.passed).toBe(true);
    expect(r.blocks).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it("passes on a cycle with a generic email placeholder", () => {
    const r = checkPrivacy(withField("dimensions.delegation.example", "Send to user@example.com for review"));
    // example.com is a real domain but the pattern should still flag it as a warning
    // (it's correct behaviour — users should confirm example.com is intentional)
    expect(r.blocks).toHaveLength(0);
  });
});
