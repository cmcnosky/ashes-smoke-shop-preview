# Ashes — local accessory storefront demo

[Open the storefront](https://cmcnosky.github.io/ashes-smoke-shop-preview/)

A working, disconnected retail demo for Ashes Smoke Shop. The 34 products are actual ordinary accessories referenced from five DFW/Denton retailers, with 41 published product options, 22 brands, dated sources, and locally stored product photos. They are not an Ashes inventory export or confirmation of its stock, prices, or supplier relationships.

The assortment replaces the former hypothetical apparel and merchandise options. The colorful skeleton homepage introduces the shop, with eight category links, four featured products, and both locations. The separate catalog retains brand/price filters, search, sorting, product details, variant photos, cart, quantity controls, and demonstration checkout. No payment is collected, order transmitted, or inventory reserved.

## Data and implementation

- `inventory.json`: exact source titles, concise customer names, retailer-reference prices, verified options, image references, source URLs, and November 12, 2026 checks.
- `commerce.json`: matching demo cart records; no payment endpoint or merchant connection.
- `content.json`: Ashes business information and location copy.
- `retail_builder.py`: customer-facing product, brand, catalog, cart, checkout, and reference pages.
- `build.py`: shared site frame and business pages; invokes the retail generator.
- `docs/assets/home.css`: the illustrated homepage, category shortcuts, featured products, and location layout.
- `docs/assets/retail.css` and `retail.js`: compact responsive shop layout, search, filters, sorting.
- `docs/assets/store.js` and `store.css`: cart, variant selection, example checkout totals, confirmation.
- `docs/`: generated GitHub Pages output. The main branch /docs directory is the publishing source.
- `catalog.json` and `catalog_builder.py`: preserved earlier brand research and prior generator; not used by the current build.

```sh
python3 build.py
python3 scripts/verify_static.py
python3 scripts/verify_catalog.py
node scripts/verify_store.mjs
```

Publish to the existing GitHub Pages repository. Wait for Pages deployment, compare public bytes against the committed files, and inspect the new public revision in Chrome.

## Demonstration behavior

The browser stores product/option IDs and quantities for the cart. A demo receipt is held in session storage without checkout contact or address details. Selecting pickup or shipping shows example calculations; $5 shipping and 8.25% tax are demonstration settings, not shipping quotes or tax determinations. The checkout accepts fictional example details and collects no card information.

All displayed product records are nonconsumable accessories. Regulated consumable products and vape devices are not in the demo cart catalog. The separate business category guide describes Ashes's published categories without exposing a purchasing flow for those categories.

## Before production commerce

Replace the competitor-reference assortment with Ashes-approved products, prices, stock, options and fulfillment rules. Obtain permission for continued use of competitor photographs or replace them with Ashes-owned, licensed, or supplier-authorized images. Public availability, attribution and noindex do not establish reuse permission.

Connect Ashes's own merchant and order systems with server-side pricing, stock validation and payment confirmation. Configure actual tax, shipping restrictions, pickup instructions, policies, order notifications, and fulfillment. Never place payment secrets in GitHub Pages. Changing demo mode or adding a URL alone does not make this a production payment integration.
