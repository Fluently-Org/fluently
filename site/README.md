# Fluently GitHub Pages Site

A static GitHub Pages site built with plain HTML + Tailwind CSS (no build step required).

## Pages

- **index.html** — Landing page with hero section, 4D Framework explanation, GitHub stats
- **knowledge.html** — Interactive knowledge base browser with filtering
- **contribute.html** — Contribution guide with YAML template and validation checklist

## Local Development

No build step needed! Simply open the files in a browser or serve locally:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js
npx http-server

# Then visit: http://localhost:8000/site/
```

## GitHub Pages Configuration

The site is configured to deploy from the `/site` directory:

1. **_config.yml** — GitHub Pages configuration
   - Source: `/site` directory
   - Theme: None (plain HTML + Tailwind CDN)
   - URL: `https://fluently-org.github.io/fluently`

2. **GitHub Settings** (admin only):
   - Go to: Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` / `master`
   - Folder: `/ (root)` → Should be changed to `/site`

## File Structure

```
/site/
├── index.html       # Landing page
├── knowledge.html   # Knowledge base browser
└── contribute.html  # Contribution guide
```

## Technology Stack

- **HTML5** — Semantic markup
- **Tailwind CSS** — Utility-first CSS via CDN (no build)
- **Font Awesome** — Icons via CDN
- **Vanilla JavaScript** — No dependencies
  - Fetches knowledge entries from GitHub API
  - GitHub stats (stars, contributors) via GitHub API
  - Client-side filtering and rendering

## Key Features

### Landing Page (index.html)

- Hero section with call-to-action
- 4D Framework cards (Delegation, Description, Discernment, Diligence)
- Live "example" section with a sample 4D play
- Get Started section
- GitHub stars and contributor count (fetched dynamically)

### Knowledge Browser (knowledge.html)

- Fetches knowledge entries from GitHub API
- Falls back to fetching individual YAML files if JSON index unavailable
- Filter by domain and tags
- Card view with title, domain, tags, contributor, link to source
- Responsive grid layout

### Contribution Guide (contribute.html)

- Step-by-step walkthrough (5 steps from fork to PR)
- Visual schema explanation with Domain, Title, ID, Score Hints cards
- Detailed 4D dimension guidance
- Copy-paste YAML template with "Copy to Clipboard" button
- Validation checklist
- PR description template
- Links to GitHub issues and discussions

## GitHub API Integration

The site fetches data from GitHub API without authentication:

```javascript
// Fetch GitHub stats
fetch('https://api.github.com/repos/Fluently-Org/fluently')

// Fetch contributor count
fetch('https://api.github.com/repos/Fluently-Org/fluently/contributors')

// Fetch knowledge entries
fetch('https://api.github.com/repos/Fluently-Org/fluently/contents/knowledge')
```

**Note:** GitHub API rate limits (60 req/hr unauthenticated). For production, consider adding a GitHub PAT.

## Deployment

Once you push to the `main` branch:

1. GitHub automatically builds and deploys from `/site`
2. Site is live at: `https://fluently-org.github.io/fluently`
3. Changes appear within a few seconds

## Customization

- **Colors**: Edit Tailwind classes in HTML (e.g., `bg-blue-600` → `bg-green-600`)
- **Fonts**: Add custom font sizes or families via Tailwind CDN
- **Content**: Edit section text and headings directly in HTML
- **Icons**: Use Font Awesome icons (search at fontawesome.com)

## Future Enhancements

- [ ] Build knowledge/index.json during CI and commit to repo
- [ ] Add search functionality (client-side or via Algolia)
- [ ] Create individual pages for each knowledge entry
- [ ] Add changelog or "What's New" section
- [ ] Dark mode toggle
- [ ] Smooth page transitions

## Troubleshooting

**Site not updating:**
- GitHub Pages can take a minute to deploy
- Check GitHub Actions → Pages deployment
- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)

**Knowledge entries not loading:**
- Check GitHub API rate limits (curl https://api.github.com/rate_limit)
- Verify YAML files exist in `/knowledge/`
- Check browser console for API errors

**Styling issues:**
- Tailwind classes must be in HTML; inline styles won't be purged
- Test in latest Chrome, Firefox, Safari

## License

MIT — same as main Fluently project
