# Ashes Smoke Shop website preview

[Open the website](https://cmcnosky.github.io/ashes-smoke-shop-preview/)

A colorful retail website concept for Ashes in Denton and Lewisville, with a searchable informational catalog, a brand directory, and location information.

- [Product catalog](https://cmcnosky.github.io/ashes-smoke-shop-preview/explore.html): 21 documented product entries, search, category/brand filters, listing-history and location filters, sorting, and browser-local saved products.
- [Brand directory](https://cmcnosky.github.io/ashes-smoke-shop-preview/brands.html): 29 brand profiles with direct detail pages.
- [Category guide](https://cmcnosky.github.io/ashes-smoke-shop-preview/categories.html): the original broad category descriptions.

The catalog is informational. It does not accept orders or payments. Current published carry statements, manufacturer directory entries, dated posts, undated sources, and historical/event records have distinct labels. Prices, stock counts, and unverified variants are not invented. Saved products remain on the visitor's browser and are not sent to a shop.

## Editing and publishing

- Business content: `content.json`
- Brand/product content and public source records: `catalog.json`
- Page layouts: `build.py`
- Catalog generation: `catalog_builder.py`
- Styling and browser behavior: `docs/assets/site.css` and `docs/assets/site.js`
- Catalog styling and browser behavior: `docs/assets/catalog.css` and `docs/assets/catalog.js`
- Public output: `docs/`

```sh
python3 build.py
python3 scripts/verify_static.py
python3 scripts/verify_catalog.py
git add build.py catalog_builder.py content.json catalog.json archive-v2.json docs scripts README.md AGENTS.md .gitignore
git commit -m "Update Ashes website"
git push origin main
```

GitHub Pages publishes the `main` branch's `/docs` directory automatically. Keep this repository and URL for future revisions. Wait for deployment, compare public files to the committed build, and inspect in Chrome before reporting a revision as live.

## Content and artwork

The site is a proposed website, not a live inventory or ordering system. Store categories and business details come from Ashes's public website. Brand and product records include public source provenance checked November 12, 2026. Manufacturer directory inclusion is not a stock guarantee. Photographs retain their historical or undated context. Category illustrations do not represent a specific model. The V4 wordmark and illustrative artwork were created for this concept. Font license files are included with the assets. The preview asks search engines not to index it.

Every product and brand is rendered as static HTML, including direct detail links, so reading and navigation work without JavaScript. JavaScript adds filtering, URL persistence, saved products, result counts, and copy-link behavior. Older category anchors redirect to their original meaning in the category guide.
