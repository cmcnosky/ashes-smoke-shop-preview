# Ashes website publishing requirements

- The primary website preview is GitHub Pages: https://cmcnosky.github.io/ashes-smoke-shop-preview/
- Repository: https://github.com/cmcnosky/ashes-smoke-shop-preview
- Keep publishing subsequent revisions to this same GitHub Pages URL. Do not substitute a Sites/chatgpt.site preview unless the user explicitly requests it.
- GitHub Pages serves the main branch /docs directory and automatically deploys pushes.
- Build with `python3 build.py`, then check with `python3 scripts/verify_static.py` `python3 scripts/verify_catalog.py`, and `node scripts/verify_store.mjs` before committing and pushing.
- Business facts are in content.json; brand/product data and public sources are in catalog.json. Layouts are in build.py and catalog_builder.py. Demo merchandise and connection settings are in commerce.json. CSS/JS/assets are in docs/assets, including catalog.css, catalog.js, store.css, and store.js. Generated HTML is committed with each change.
- Keep source dates and evidence labels in collapsed product-background details. Keep catalog cards customer-facing. Do not turn older carry lists, event associations, or manufacturer directories into live stock, prices, or unverified variants. Saved products are browser-local. Ordinary merchandise supports a demo cart and checkout; the global preview label and sample-price labels must remain visible until a real merchant connection and approved product records are configured. Never send a demo order or take payment.
- Preserve the V4 visual direction and conventional navigation unless the user requests changes.
- Verify the Pages deployment and public file bytes. Use Chrome for visual/browser checks; do not use Safari.
- Keep credentials, private audits, internal hosting metadata, and unrelated documents out of this public repository.
