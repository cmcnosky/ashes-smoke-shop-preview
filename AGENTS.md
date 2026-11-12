# Ashes website publishing requirements

- The primary website preview is GitHub Pages: https://cmcnosky.github.io/ashes-smoke-shop-preview/
- Repository: https://github.com/cmcnosky/ashes-smoke-shop-preview
- Keep publishing subsequent revisions to this same GitHub Pages URL. Do not substitute a Sites/chatgpt.site preview unless the user explicitly requests it.
- GitHub Pages serves the main branch /docs directory and automatically deploys pushes.
- Build with `python3 build.py`, then check with `python3 scripts/verify_static.py` before committing and pushing.
- Source facts are in content.json, layout is in build.py, and CSS/JS/assets are in docs/assets. Generated HTML is committed with each change.
- Preserve the V4 visual direction and conventional navigation unless the user requests changes.
- Verify the Pages deployment and public file bytes. Use Chrome for visual/browser checks; do not use Safari.
- Keep credentials, private audits, internal hosting metadata, and unrelated documents out of this public repository.
