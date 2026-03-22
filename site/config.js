/**
 * site/config.js — Fluently site configuration.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ FORK OWNERS: edit the three values in "Configure your fork" below.       │
 * │ Every GitHub link, raw-content URL, and knowledge-index URL across all   │
 * │ four site pages is derived from these values and applied automatically.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * This script must be loaded synchronously (no async/defer) so that
 * window.FLUENTLY is available to all page-level scripts.
 */
(function () {
  'use strict';

  // ── Configure your fork ───────────────────────────────────────────────────

  /** GitHub username or organisation that owns the repository. */
  var GITHUB_OWNER = 'Fluently-Org';

  /** Repository name (the part after the slash in owner/repo). */
  var GITHUB_REPO = 'fluently';

  /** Default branch used for raw-content and blob links. */
  var DEFAULT_BRANCH = 'main';

  /**
   * Custom GitHub Pages domain (optional).
   * Set to your domain WITHOUT the protocol, e.g. 'docs.mycompany.com'.
   * Leave blank to auto-derive: https://<owner>.github.io/<repo>
   */
  var CUSTOM_DOMAIN = 'fluently.ctrl6.com';

  // ── Derived URLs — do not edit below this line ────────────────────────────

  var ownerLower  = GITHUB_OWNER.toLowerCase();
  var pagesOrigin = CUSTOM_DOMAIN
    ? ('https://' + CUSTOM_DOMAIN)
    : ('https://' + ownerLower + '.github.io');
  var pagesBase = CUSTOM_DOMAIN
    ? pagesOrigin
    : (pagesOrigin + '/' + GITHUB_REPO);
  var githubBase = 'https://github.com/' + GITHUB_OWNER + '/' + GITHUB_REPO;
  var rawBase    = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/' + DEFAULT_BRANCH;
  var blobBase   = githubBase + '/blob/' + DEFAULT_BRANCH;
  var treeBase   = githubBase + '/tree/' + DEFAULT_BRANCH;

  /** Public API — consumed by all page scripts. */
  window.FLUENTLY = {
    owner:        GITHUB_OWNER,
    repo:         GITHUB_REPO,
    fullRepo:     GITHUB_OWNER + '/' + GITHUB_REPO,
    branch:       DEFAULT_BRANCH,
    githubBase:   githubBase,
    rawBase:      rawBase,
    blobBase:     blobBase,
    treeBase:     treeBase,
    pagesBase:    pagesBase,
    /** Full URL to knowledge/index.json — used by the match-finder and cards. */
    indexJsonUrl: rawBase + '/knowledge/index.json',
  };

  // ── Link resolver ─────────────────────────────────────────────────────────

  /**
   * Resolve a data-fluently key to an absolute URL.
   *
   * Supported keys:
   *   repo | issues | pulls | discussions | compare | contributing |
   *   knowledge-md | knowledge | contribute | guide | home |
   *   blob:<path>   e.g.  blob:packages/mcp-server/README.md
   *   tree:<path>   e.g.  tree:knowledge
   *   raw:<path>    e.g.  raw:knowledge/index.json
   *
   * @param {string} key
   * @returns {string|null}
   */
  function resolve(key) {
    if (!key) return null;
    var F = window.FLUENTLY;
    switch (key) {
      case 'repo':          return F.githubBase;
      case 'issues':        return F.githubBase + '/issues';
      case 'pulls':         return F.githubBase + '/pulls';
      case 'discussions':   return F.githubBase + '/discussions';
      case 'compare':       return F.githubBase + '/compare';
      case 'contributing':  return F.blobBase   + '/CONTRIBUTING.md';
      case 'knowledge-md':  return F.blobBase   + '/KNOWLEDGE.md';
      case 'knowledge':     return F.pagesBase  + '/knowledge.html';
      case 'contribute':    return F.pagesBase  + '/contribute.html';
      case 'guide':         return F.pagesBase  + '/guide.html';
      case 'home':          return F.pagesBase  + '/';
      default:
        if (key.indexOf('blob:') === 0) return F.blobBase + '/' + key.slice(5);
        if (key.indexOf('tree:') === 0) return F.treeBase + '/' + key.slice(5);
        if (key.indexOf('raw:')  === 0) return F.rawBase  + '/' + key.slice(4);
        return null;
    }
  }

  // ── DOM rewriter ──────────────────────────────────────────────────────────

  /**
   * Walk the DOM and apply resolved URLs / text to annotated elements.
   *
   * data-fluently="<key>"       → sets href on <a> elements
   * data-fluently-text="<key>"  → sets textContent; supported keys:
   *                               full-repo | owner | repo | branch
   */
  function rewriteLinks() {
    // Rewrite hrefs
    document.querySelectorAll('a[data-fluently]').forEach(function (el) {
      var url = resolve(el.getAttribute('data-fluently'));
      if (url) el.href = url;
    });

    // Rewrite visible text (e.g. terminal demo repo names)
    document.querySelectorAll('[data-fluently-text]').forEach(function (el) {
      var F   = window.FLUENTLY;
      var key = el.getAttribute('data-fluently-text');
      var text =
        key === 'full-repo' ? F.fullRepo :
        key === 'owner'     ? F.owner    :
        key === 'repo'      ? F.repo     :
        key === 'branch'    ? F.branch   : null;
      if (text !== null) el.textContent = text;
    });
  }

  // Run after DOM is ready; config.js loads synchronously in <head> so the
  // DOM is not yet built — we must defer until DOMContentLoaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewriteLinks);
  } else {
    rewriteLinks();
  }

})();
