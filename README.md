# Ashes Smoke Shop storefront preview

[Open the store](https://cmcnosky.github.io/ashes-smoke-shop-preview/merchandise.html)

A working, disconnected storefront preview hosted on GitHub Pages. Ordinary merchandise has example options/prices, a persistent cart, quantity controls, pickup/shipping choices, checkout validation, demo totals, and an in-browser confirmation. No payment is taken and no order is sent to Ashes.

The global preview banner and price labels distinguish sample merchandise data from business information. Other product categories remain browsing-only. Background evidence is retained inside collapsed product-detail sections. Historical-only non-merchandise records are tucked behind the collection filter.

## Source and build

- `content.json`: store addresses, hours, and business copy.
- `catalog.json`: researched brand/product background plus customer-facing names and summaries.
- `commerce.json`: isolated, clearly marked sample merchandise options/prices and disconnected checkout settings.
- `build.py` and `catalog_builder.py`: generated page layouts.
- `docs/assets/catalog.js` and `catalog.css`: search, filters, saved items, and presentation.
- `docs/assets/store.js` and `store.css`: demo cart and checkout.
- `docs/`: public GitHub Pages output.

```sh
python3 build.py
python3 scripts/verify_static.py
python3 scripts/verify_catalog.py
node scripts/verify_store.mjs
```

GitHub Pages publishes the main branch /docs directory. Keep the existing URL. Wait for deployment, compare public bytes, and verify the revision in Chrome.

## Connecting real commerce later

This release is intentionally in `demo` mode. Do not remove the preview labels or enable real ordering merely by changing a URL. Replace sample prices/options with Ashes-approved product records and availability; connect an Ashes-owned merchant and server-side checkout endpoint; configure shipping, tax, return policies, and order fulfillment; and verify the payment webhook/order handling end to end. Secrets belong only on a backend, never in GitHub Pages or commerce.json. Customer-provided prices must never be trusted by a payment backend.

Browser storage contains cart item IDs, option IDs, and quantities. Demo receipt storage must exclude contact/address information. The demo checkout does not collect card numbers. It creates no real transaction, inventory reservation, delivery commitment, or message.

## Artwork and background

The V4 artwork is retained. Product category illustrations are illustrative; undated shop photographs keep their date context on detail pages. Source dates, source URLs, and shop-specific evidence remain in catalog.json and collapsed product-background sections. Sample commerce options are a prototype, not a recovered inventory export.
