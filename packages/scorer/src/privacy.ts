/**
 * privacy.ts
 *
 * Confidentiality and privacy scanner for Fluently 4D cycles.
 *
 * Why this exists
 * ───────────────
 * Knowledge cycles often originate in private or enterprise contexts — internal
 * tools, client workflows, proprietary systems.  Before a cycle is contributed
 * to the public community repository, every text field must be checked for
 * content that should never be public: API keys, emails, internal URLs, PII,
 * and confidentiality markers.
 *
 * Two check modes
 * ───────────────
 * STANDARD — used for all contributions.
 *   • BLOCK: proven secrets (API keys, tokens, credentials, SSNs, card numbers)
 *   • WARN:  likely-private content (emails, IPs, internal URLs, PII patterns)
 *
 * STRICT — used when bridging from a private knowledge source to the public
 *   community repo.  All WARN-level findings are promoted to BLOCK so nothing
 *   slips through without an explicit fix.
 *
 * How to use
 * ──────────
 *   const result = checkPrivacy(cycleObject, { mode: 'strict' });
 *   if (!result.passed) { /* show result.blocks to the user *\/ }
 *   if (result.warnings.length) { /* present warnings for acknowledgment *\/ }
 *
 * Extending
 * ─────────
 * Add a new rule to RULES below.  Each rule is independently tested so adding
 * one here automatically covers CLI, MCP server, and any future integrations.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Severity of a detected privacy issue. */
export type PrivacySeverity = "block" | "warn";

/** A single privacy finding in one text field of the cycle. */
export interface PrivacyIssue {
  /** Whether this is a hard stop or a soft warning. */
  severity: PrivacySeverity;
  /** Dot-path to the field where the issue was found, e.g. "dimensions.delegation.example" */
  field: string;
  /** Short machine-readable rule identifier. */
  rule: string;
  /** Human-readable description of what was found. */
  description: string;
  /**
   * The matched text, partially redacted to avoid leaking secrets
   * in the response itself (first 4 chars visible, rest replaced with ****).
   */
  redactedMatch: string;
  /** Concrete suggestion for how to fix the issue. */
  suggestion: string;
}

/** Result returned by `checkPrivacy`. */
export interface PrivacyCheckResult {
  /**
   * True only when there are zero BLOCK-severity issues.
   * Warnings alone do not set passed=false — but they should be reviewed.
   */
  passed: boolean;
  /** Issues that must be fixed before contributing (secrets, hard PII). */
  blocks: PrivacyIssue[];
  /**
   * Issues that should be reviewed and either fixed or explicitly acknowledged.
   * In STRICT mode (private→public bridge) these are promoted to blocks.
   */
  warnings: PrivacyIssue[];
  /** Summary message suitable for showing to the user or agent. */
  summary: string;
}

/** Options for `checkPrivacy`. */
export interface PrivacyCheckOptions {
  /**
   * "standard" — default; only proven secrets block contribution.
   * "strict"   — for private→public bridges; all warnings also block.
   */
  mode?: "standard" | "strict";
}

// ── Detection rules ───────────────────────────────────────────────────────────

interface Rule {
  id: string;
  severity: PrivacySeverity;
  pattern: RegExp;
  description: string;
  suggestion: string;
}

/**
 * Ordered list of detection rules.
 *
 * Rules are tested in order; each match produces one PrivacyIssue.
 * A single field can trigger multiple rules.
 *
 * Pattern hygiene:
 *   - All patterns use the `i` flag (case-insensitive) unless precision matters.
 *   - Avoid catastrophic backtracking — keep alternations short and anchored.
 */
const RULES: Rule[] = [

  // ── Hard blocks — proven secrets ──────────────────────────────────────────

  {
    id: "api_key_assignment",
    severity: "block",
    // Matches patterns like: api_key = "abc123...", token: "ghp_..."
    pattern: /(?:api[_\-]?key|access[_\-]?token|auth[_\-]?token|secret[_\-]?key|client[_\-]?secret)\s*[:=]\s*['"]?([A-Za-z0-9\-_./+]{16,})/i,
    description: "Possible API key or secret assignment",
    suggestion: 'Replace with a placeholder, e.g. "API_KEY" or "[redacted]".',
  },

  {
    id: "github_token",
    severity: "block",
    // GitHub personal access tokens start with ghp_, gho_, etc.
    pattern: /\b(ghp_|gho_|ghs_|ghr_|github_pat_)[A-Za-z0-9]{20,}/,
    description: "GitHub personal access token",
    suggestion: "Remove the token. Never include tokens in knowledge entries.",
  },

  {
    id: "aws_access_key",
    severity: "block",
    pattern: /\bAKIA[A-Z0-9]{16}\b/,
    description: "AWS access key ID",
    suggestion: "Remove the AWS key. Use IAM roles instead of embedded credentials.",
  },

  {
    id: "google_api_key",
    severity: "block",
    pattern: /\bAIza[A-Za-z0-9\-_]{35}\b/,
    description: "Google API key",
    suggestion: "Remove the Google API key.",
  },

  {
    id: "credit_card",
    severity: "block",
    // Luhn-range card numbers (13–19 digits, optionally space/hyphen separated)
    pattern: /\b(?:\d[ \-]?){13,18}\d\b/,
    description: "Possible credit card number",
    suggestion: "Replace with a generic placeholder, e.g. '4111 1111 1111 1111'.",
  },

  {
    id: "ssn",
    severity: "block",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    description: "Possible US Social Security Number (SSN)",
    suggestion: "Remove any SSN. Use 'XXX-XX-XXXX' as a placeholder in examples.",
  },

  {
    id: "password_in_text",
    severity: "block",
    // Catches: password: "abc123", Password = '...'
    pattern: /\bpassword\s*[:=]\s*['"]?[^\s'"]{6,}/i,
    description: "Hardcoded password in text",
    suggestion: "Remove the password value. Use '[password]' as a placeholder.",
  },

  // ── Warnings — likely-private, review required ────────────────────────────

  {
    id: "email_address",
    severity: "warn",
    pattern: /[\w.+\-]+@[\w\-]+\.[a-z]{2,}(?:\.[a-z]{2,})?/i,
    description: "Email address",
    suggestion: "Replace with a generic address, e.g. 'user@example.com'.",
  },

  {
    id: "private_ip",
    severity: "warn",
    // RFC-1918 private ranges: 10.x, 172.16-31.x, 192.168.x
    pattern: /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/,
    description: "Private / internal IP address",
    suggestion: "Replace with '10.0.0.1' or a clearly fictional address.",
  },

  {
    id: "internal_url",
    severity: "warn",
    // URLs pointing to internal/dev/staging hostnames
    pattern: /https?:\/\/[a-z0-9.\-]*(?:internal|intranet|corp|local|\.lan|staging|dev\.|qa\.|jira\.|confluence\.|jenkins\.|artifactory\.|nexus\.)[a-z0-9.\-/]*/i,
    description: "URL pointing to an internal or non-public host",
    suggestion: "Replace with 'https://example.com' or describe the system generically.",
  },

  {
    id: "jira_ticket",
    severity: "warn",
    // JIRA-style IDs: ABC-1234, PROJECT-567
    pattern: /\b[A-Z]{2,8}-\d{3,6}\b/,
    description: "Internal ticket ID (JIRA / Linear / GitHub issue reference)",
    suggestion: "Replace with a generic reference, e.g. 'TICKET-1234' or 'an open bug report'.",
  },

  {
    id: "confidentiality_marker",
    severity: "warn",
    pattern: /\b(?:confidential|proprietary|internal[- ]only|do[- ]not[- ]share|not[- ]for[- ]distribution|trade[- ]secret)\b/i,
    description: "Explicit confidentiality or distribution marker",
    suggestion: "Remove or rewrite the text without confidentiality language.",
  },

  {
    id: "phone_number",
    severity: "warn",
    // NANP and international formats
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/,
    description: "Possible phone number",
    suggestion: "Replace with a clearly fictional number, e.g. '+1-555-000-0000'.",
  },

  {
    id: "pii_name_pattern",
    severity: "warn",
    // "John Smith", "Jane Doe" — two capitalised words side by side
    // Low-precision heuristic — only trigger when combined with other context
    pattern: /\b(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
    description: "Possible real person's name with title prefix",
    suggestion: "Replace with a fictional name, e.g. 'Dr. A. Smith'.",
  },
];

// ── Field traversal ───────────────────────────────────────────────────────────

/**
 * Recursively walk a nested object and yield `[dotPath, value]` for every
 * string leaf.  Non-string, non-object values are skipped.
 */
function* stringFields(
  obj: unknown,
  prefix = ""
): Generator<[string, string]> {
  if (typeof obj === "string") {
    yield [prefix, obj];
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      yield* stringFields(obj[i], `${prefix}[${i}]`);
    }
  } else if (obj !== null && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      yield* stringFields(val, prefix ? `${prefix}.${key}` : key);
    }
  }
}

// ── Redaction helper ──────────────────────────────────────────────────────────

/**
 * Partially redact a matched string so the response does not itself contain
 * the sensitive value.  Shows up to 4 characters then replaces the rest with ★.
 */
function redact(match: string): string {
  if (match.length <= 4) return "★".repeat(match.length);
  return match.slice(0, 4) + "★".repeat(Math.min(match.length - 4, 12));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan every string field of a cycle object for privacy/confidentiality issues.
 *
 * @param cycle  - The raw cycle object (pre or post Zod parse, either works)
 * @param options - `mode: "strict"` promotes warnings to blocks (for bridge contributions)
 * @returns      PrivacyCheckResult with blocks, warnings, and a summary message
 */
export function checkPrivacy(
  cycle: unknown,
  options: PrivacyCheckOptions = {}
): PrivacyCheckResult {
  const { mode = "standard" } = options;
  const blocks:   PrivacyIssue[] = [];
  const warnings: PrivacyIssue[] = [];

  for (const [field, value] of stringFields(cycle)) {
    for (const rule of RULES) {
      const match = rule.pattern.exec(value);
      if (!match) continue;

      const issue: PrivacyIssue = {
        severity:     rule.severity,
        field,
        rule:         rule.id,
        description:  rule.description,
        redactedMatch: redact(match[0]),
        suggestion:   rule.suggestion,
      };

      // In strict mode all findings become blocks — nothing slips through
      if (rule.severity === "block" || mode === "strict") {
        blocks.push({ ...issue, severity: "block" });
      } else {
        warnings.push(issue);
      }
    }
  }

  const passed = blocks.length === 0;

  const summary = buildSummary(passed, blocks, warnings, mode);

  return { passed, blocks, warnings, summary };
}

/** Compose a human-readable summary for the check result. */
function buildSummary(
  passed: boolean,
  blocks: PrivacyIssue[],
  warnings: PrivacyIssue[],
  mode: "standard" | "strict"
): string {
  const modeLabel = mode === "strict" ? " (strict / bridge mode)" : "";
  if (passed && warnings.length === 0) {
    return `Privacy check passed${modeLabel}. No issues detected.`;
  }
  const parts: string[] = [];
  if (blocks.length > 0) {
    parts.push(
      `${blocks.length} blocking issue${blocks.length > 1 ? "s" : ""} must be resolved before contributing`
    );
  }
  if (warnings.length > 0 && mode === "standard") {
    parts.push(
      `${warnings.length} warning${warnings.length > 1 ? "s" : ""} should be reviewed (pass acknowledge_privacy_warnings: true to proceed despite them)`
    );
  }
  return `Privacy check${modeLabel}: ${parts.join("; ")}.`;
}
