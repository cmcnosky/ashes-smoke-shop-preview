# Ashes Smoke Shop website preview

[Open the website](https://cmcnosky.github.io/ashes-smoke-shop-preview/)

A colorful retail website concept for Ashes in Denton and Lewisville, with direct product-category navigation and location information.

## Editing and publishing

- Business content: `content.json`
- Page layouts: `build.py`
- Styling and browser behavior: `docs/assets/site.css` and `docs/assets/site.js`
- Public output: `docs/`

```sh
python3 build.py
python3 scripts/verify_static.py
git add build.py content.json archive-v2.json docs scripts README.md AGENTS.md .gitignore
git commit -m "Update Ashes website"
git push origin main
```

GitHub Pages publishes the `main` branch's `/docs` directory automatically. Keep this repository and URL for future revisions. Wait for deployment, compare public files to the committed build, and inspect in Chrome before reporting a revision as live.

## Content and artwork

The site is a proposed website, not a live inventory or ordering system. Store categories and business details come from Ashes's public website. Historical photographs retain their captions and credits. The V4 wordmark and illustrative artwork were created for this concept. Font license files are included with the assets. The preview asks search engines not to index it.
