/**
 * utils/display.ts
 *
 * Terminal output helpers shared by all CLI commands.
 *
 * Keeping rendering logic here means each command file only contains
 * business logic — not ANSI escape sequences or bar-chart maths.
 */

import chalk from "chalk";

// ── Score bar ─────────────────────────────────────────────────────────────────

const BAR_WIDTH = 10;

/**
 * Render a single 4D dimension score row, e.g.:
 *   delegation     ████████░░   80  ✅ Strong
 */
export function renderScoreRow(dim: string, score: number): string {
  const filled  = Math.round((score / 100) * BAR_WIDTH);
  const bar     = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const label   = scoreLabel(score);
  return `  ${chalk.cyan(dim.padEnd(14))} ${bar}  ${chalk.yellow(String(score).padStart(3))}  ${label}`;
}

/** Return a coloured status string based on score threshold. */
function scoreLabel(score: number): string {
  if (score >= 80) return chalk.green("✅ Strong");
  if (score >= 50) return chalk.yellow("⚠️  Improve");
  return chalk.red("❌ Weak");
}

// ── Entry header ──────────────────────────────────────────────────────────────

/**
 * Render a ranked entry title line, e.g.:
 *   #1  Code Review Triage  (coding)  overall: 74/100
 */
export function renderEntryHeader(
  rank: number,
  title: string,
  domain: string,
  overallScore: number
): string {
  return (
    chalk.bold.white(`#${rank}  ${title}`) +
    chalk.gray(`  (${domain})`) +
    chalk.yellow(`  overall: ${overallScore}/100`)
  );
}

/** Compute the arithmetic mean of an array of numbers, rounded to integer. */
export function averageScore(scores: number[]): number {
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
