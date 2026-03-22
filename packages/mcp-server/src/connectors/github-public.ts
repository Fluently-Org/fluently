import type { KnowledgeConnector, KnowledgeEntry, ContributionResult } from './types.js';
import yaml from 'js-yaml';

export class GitHubPublicConnector implements KnowledgeConnector {
  readonly name = 'github-public';
  private repo: string;
  private branch: string;
  private rawBase: string;

  constructor() {
    this.repo   = process.env.FLUENTLY_GITHUB_REPO   ?? 'faical-yannick-congo/fluently';
    this.branch = process.env.FLUENTLY_GITHUB_BRANCH ?? 'main';
    this.rawBase = `https://raw.githubusercontent.com/${this.repo}/${this.branch}`;
  }

  async load(): Promise<KnowledgeEntry[]> {
    const res = await fetch(`${this.rawBase}/knowledge/index.json`);
    if (!res.ok) throw new Error(`Failed to fetch knowledge index: HTTP ${res.status}`);
    const data = await res.json() as { entries: KnowledgeEntry[] };
    return data.entries;
  }

  /**
   * Standard public contribution — returns the validated YAML and fork-and-PR
   * instructions.  If FLUENTLY_GITHUB_TOKEN is set, a future release will open
   * the PR automatically; for now the instructions are explicit.
   */
  async contribute(cycle: unknown): Promise<ContributionResult> {
    const entry    = cycle as any;
    const yamlStr  = yaml.dump(cycle);
    const filename = `${entry.domain}-${entry.id}.yaml`;
    const token    = process.env.FLUENTLY_GITHUB_TOKEN;
    const prUrl    = `https://github.com/${this.repo}/compare`;

    return {
      success: true,
      message: token
        ? `Cycle validated. Use the YAML below to open a PR at ${prUrl}. ` +
          `A future release will automate this step with your token.`
        : `Cycle validated. To contribute to the community:\n` +
          `1. Fork https://github.com/${this.repo}\n` +
          `2. Add the YAML below to knowledge/${filename}\n` +
          `3. Open a PR at ${prUrl}`,
      url:  prUrl,
      yaml: yamlStr,
    };
  }

  /**
   * Bridge contribution — called when the agent is working from a private
   * knowledge source and wants to push a sanitised cycle to the public repo.
   *
   * Requires FLUENTLY_GITHUB_TOKEN.  Opens a PR automatically with a
   * "bridge contribution" label so maintainers know to do an extra review.
   *
   * The privacy check must have already passed in STRICT mode before this
   * method is called — this is enforced by handleContributeCycle.
   */
  async bridgeContribute(cycle: unknown): Promise<ContributionResult> {
    const token = process.env.FLUENTLY_GITHUB_TOKEN;
    if (!token) {
      return {
        success: false,
        message:
          'FLUENTLY_GITHUB_TOKEN is required to bridge a cycle to the public community repo. ' +
          'Set the env var and restart the server.',
      };
    }

    const entry    = cycle as any;
    const yamlStr  = yaml.dump(cycle);
    const filename = `${entry.domain}-${entry.id}.yaml`;
    const newBranch = `fluently/bridge-${entry.id}-${Date.now()}`;

    const headers: Record<string, string> = {
      Authorization:       `Bearer ${token}`,
      Accept:              'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type':      'application/json',
    };

    // ── Get base branch SHA ───────────────────────────────────────────────
    const branchRes = await fetch(
      `https://api.github.com/repos/${this.repo}/git/ref/heads/${this.branch}`,
      { headers }
    );
    if (!branchRes.ok) {
      return { success: false, message: `Could not read branch SHA: HTTP ${branchRes.status}` };
    }
    const { object: { sha } } = await branchRes.json() as { object: { sha: string } };

    // ── Create feature branch ─────────────────────────────────────────────
    const createRef = await fetch(`https://api.github.com/repos/${this.repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
    });
    if (!createRef.ok) {
      return { success: false, message: `Could not create branch: HTTP ${createRef.status}` };
    }

    // ── Commit the YAML file ──────────────────────────────────────────────
    const fileRes = await fetch(
      `https://api.github.com/repos/${this.repo}/contents/knowledge/${filename}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `feat(knowledge): bridge contribution — ${entry.title}`,
          content: Buffer.from(yamlStr).toString('base64'),
          branch:  newBranch,
        }),
      }
    );
    if (!fileRes.ok) {
      return { success: false, message: `Could not commit file: HTTP ${fileRes.status}` };
    }

    // ── Open PR with bridge label ─────────────────────────────────────────
    const prRes = await fetch(`https://api.github.com/repos/${this.repo}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `feat(knowledge): bridge contribution — ${entry.title}`,
        head:  newBranch,
        base:  this.branch,
        body:
          `## Bridge Contribution\n\n` +
          `This cycle was originally authored in a private knowledge base and has passed ` +
          `a strict privacy check before being submitted here.\n\n` +
          `**Title:** ${entry.title}\n` +
          `**Domain:** ${entry.domain}\n` +
          `**Contributor:** ${entry.contributor}\n\n` +
          `> Maintainers: please verify that no confidential details remain even after ` +
          `the automated privacy scan.\n\n` +
          `_Generated by Fluently MCP server via \`contribute_to_public: true\`._`,
        labels: ['bridge-contribution'],
      }),
    });
    if (!prRes.ok) {
      return { success: false, message: `Could not open PR: HTTP ${prRes.status}` };
    }
    const pr = await prRes.json() as { html_url: string; number: number };

    return {
      success: true,
      message: `Bridge PR #${pr.number} opened. Maintainers will do a final review before merging.`,
      url:     pr.html_url,
      yaml:    yamlStr,
    };
  }
}
