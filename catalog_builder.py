"""Customer storefront with secondary source details and isolated demo commerce."""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / 'catalog.json').read_text())
BRANDS = {b['id']: b for b in DATA['brands']}
CATEGORIES = {c['id']: c for c in DATA['categories']}
SOURCES = DATA['sources']
COMMERCE = json.loads((ROOT / 'commerce.json').read_text())
MERCH_ITEMS = {p['id']: p for p in COMMERCE['items']}
RECENT = {'current_published', 'manufacturer_listed'}
COLORS = ['mint', 'yellow', 'lavender', 'peach']
MERCH_IDS = {'ashes-logo-apparel', 'cookies-backpacks-product-family', 'ashes-beanies', 'ashes-event-apparel', 'wildberry-incense-holders'}

def title_for(record):
    return record.get('display_name', record['name'])

def summary_for(record):
    return record.get('customer_summary', record.get('summary', ''))

def archived(record):
    return record['evidence_status'] in {'historical', 'promotional_only'} and record['id'] not in MERCH_IDS

def purchase_button(record, detail=False):
    if record['id'] not in MERCH_IDS: return ''
    if not detail and len(MERCH_ITEMS[record['id']]['options']) > 1:
        return f'<a class="button dark add-to-cart" href="product-{e(record["id"])}.html">Choose options <span aria-hidden="true">→</span></a>'
    return f'<button class="button dark add-to-cart" type="button" data-cart-add="{e(record["id"])}" hidden>Add to cart <span aria-hidden="true">+</span></button>'



def e(value):
    return html.escape(str(value), quote=True)


def list_text(value):
    if isinstance(value, list):
        return ' '.join(str(v) for v in value)
    return str(value or '')


def location_text(record):
    locations = record.get('locations', [])
    return ' + '.join(x.title() for x in locations) if locations else 'Branch not established by source'


def status_text(record):
    labels = {'current_published': 'Named on store pages', 'manufacturer_listed': 'Manufacturer listing',
              'dated_feature': 'Dated product feature', 'undated_profile': 'Undated carry list',
              'undated_photo': 'Undated shop photo', 'historical': 'From the archive',
              'promotional_only': 'Event association'}
    return labels[record['evidence_status']]


def category_name(key):
    return CATEGORIES.get(key, {}).get('name', key.replace('-', ' ').title())


def category_icon(key):
    name = category_name(key).lower()
    return ('papers' if 'paper' in name else 'candle' if 'incense' in name or 'scent' in name
            else 'bag' if 'bag' in name else 'shirt' if 'merch' in name else 'accessory' if 'care' in name
            else 'pipe' if 'glass' in name else 'vape' if 'device' in name or 'vapor' in name
            else 'grinder')


def color_for(key):
    return COLORS[list(CATEGORIES).index(key) % len(COLORS)] if key in CATEGORIES else 'mint'


def merchandise_visual(record):
    key = record['id']
    shapes = {
      'ashes-logo-apparel': '<path d="M126 53 74 78l-30 72 57 24 18-37v140h164V137l18 37 57-24-30-72-52-25c-17 31-74 31-91 0Z" fill="#fff9ed"/><path d="M153 54c10 34 68 34 78 0M119 243h164M76 135l29 12M298 147l28-12"/><text x="201" y="168" text-anchor="middle" font-family="Shrikhand,Georgia,serif" font-size="33" fill="#ed684c" stroke="none">ASHES</text><text x="201" y="190" text-anchor="middle" font-family="sans-serif" font-size="9" letter-spacing="3" fill="#281b2c" stroke="none">LOCAL SOUL</text>',
      'ashes-beanies': '<path d="M109 202v-62c0-105 182-105 182 0v62Z" fill="#d7caef"/><path d="M141 188v-51M169 188V90M199 188V77M229 188V90M259 188v-51" stroke="#9d8dbc"/><rect x="96" y="190" width="208" height="76" rx="12" fill="#fff9ed"/><rect x="155" y="205" width="90" height="47" rx="3" fill="#f6cb4e"/><text x="200" y="235" text-anchor="middle" font-family="Shrikhand,Georgia,serif" font-size="19" fill="#281b2c" stroke="none">Ashes</text>',
      'cookies-backpacks-product-family': '<path d="M155 70v-9c0-37 90-37 90 0v9" fill="none"/><rect x="115" y="64" width="170" height="216" rx="47" fill="#b9e3d4"/><path d="M115 141H91v99h24M285 141h24v99h-24" fill="#91c6b5"/><path d="M143 90h115M148 108h104"/><rect x="142" y="166" width="116" height="85" rx="15" fill="#fff9ed"/><path d="M143 185h114M247 187v16"/><text x="200" y="139" text-anchor="middle" font-family="sans-serif" font-size="17" font-weight="700" fill="#281b2c" stroke="none">BACKPACK</text>',
      'ashes-event-apparel': '<path d="m95 80-37 22-22 53 41 18 15-30v126h139V143l15 30 40-18-22-53-37-22c-15 26-63 26-78 0Z" fill="#f7c5aa"/><text x="161" y="168" text-anchor="middle" font-family="Shrikhand,Georgia,serif" font-size="26" fill="#281b2c" stroke="none">ASHES</text><rect x="263" y="169" width="78" height="111" rx="12" fill="#b9e3d4"/><path d="M276 169v-19h52v19" fill="#fff9ed"/><text x="302" y="233" text-anchor="middle" font-family="Shrikhand,Georgia,serif" font-size="17" fill="#281b2c" stroke="none">Ashes</text>',
      'wildberry-incense-holders': '<ellipse cx="200" cy="254" rx="136" ry="27" fill="#f7c5aa"/><path d="M74 245c70-20 182-20 252 0l-18 19H92Z" fill="#fff9ed"/><path d="m119 238 111-149" stroke="#94734a"/><path d="M239 72c28-37-29-38 0-70M215 116c-27-29 27-37 11-62" stroke="#7d6d84"/><circle cx="113" cy="245" r="4" fill="#281b2c"/>'
    }
    colors = {'ashes-logo-apparel':'mint','ashes-beanies':'yellow','cookies-backpacks-product-family':'lavender','ashes-event-apparel':'peach','wildberry-incense-holders':'yellow'}
    return f'<div class="catalog-visual merch-visual {colors[key]}"><svg viewBox="0 0 400 320" fill="none" stroke="#281b2c" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">{shapes[key]}</svg><span class="merch-art-caption">Product illustration</span></div>'


def visual(record, icon, brand=False):
    if not brand and record['id'] in MERCH_IDS:
        return merchandise_visual(record)
    cat = (record.get('category_ids') or [record.get('category_id')])[0]
    image = record.get('image')
    if image:
        if isinstance(image, str):
            image = {'src': image, 'alt': record['name'], 'caption': 'Shop photograph · date unknown'}
        return f'<div class="catalog-visual photo"><img src="{e(image["src"])}" alt="{e(image["alt"])}" width="640" height="440" loading="lazy"></div>'
    name = record['name'] if brand else BRANDS[record['brand_id']]['name']
    return f'<div class="catalog-visual {color_for(cat)}"><span class="catalog-doodle" aria-hidden="true">{icon(category_icon(cat))}</span><span class="catalog-brand-name">{e(name)}</span><span class="catalog-art-label">{e(category_name(cat))}</span><span class="catalog-spark" aria-hidden="true">✦</span></div>'


def favorite(record):
    return f'<button class="save-product" type="button" data-save="{e(record["id"])}" data-save-name="{e(title_for(record))}" aria-pressed="false" aria-label="Save {e(title_for(record))}" hidden><span aria-hidden="true">♡</span> <span data-save-label>Save</span></button>'


def card(record, icon, brand=False):
    prefix = 'brand' if brand else 'product'
    cats = record.get('category_ids') or [record['category_id']]
    title = title_for(record)
    brand_name = record['name'] if brand else BRANDS[record['brand_id']]['name']
    search = ' '.join([title, record['name'], brand_name, summary_for(record), ' '.join(category_name(c) for c in cats)])
    freshness = 'recent' if record['evidence_status'] in RECENT else 'older'
    label = 'Past find' if archived(record) else category_name(cats[0])
    price = f'<span class="product-price" data-product-price="{e(record["id"])}"></span>' if not brand and record['id'] in MERCH_IDS else ''
    actions = '' if brand else '<div class="product-card-actions">'+purchase_button(record)+favorite(record)+'</div>'
    return f'''<article class="catalog-card" data-catalog-item data-id="{e(record['id'])}" data-name="{e(title)}" data-search="{e(search)}" data-category="{e(' '.join(cats))}" data-brand="{e(record['id'] if brand else record['brand_id'])}" data-evidence="{freshness}" data-status="{e(record['evidence_status'])}" data-location="{e(' '.join(record.get('locations', [])))}" data-date="{e(record.get('evidence_date') or '')}" data-collection="{'archive' if archived(record) else 'browse'}">
<a class="catalog-card-link" href="{prefix}-{e(record['id'])}.html">{visual(record, icon, brand)}<div class="catalog-card-body"><span class="product-category-label">{e(label)}</span><h2>{e(title)}</h2><p>{e(summary_for(record))}</p>{price}<span class="card-detail-link">{'Explore brand' if brand else 'View product'} <span aria-hidden="true">→</span></span></div></a>{actions}</article>'''


def catalog_nav(active):
    links = [('explore.html', 'Products', 'products'), ('brands.html', 'Brands A–Z', 'brands'),
             ('merchandise.html', 'Merchandise', 'merch'), ('categories.html', 'Categories', 'categories')]
    return '<nav class="catalog-subnav" aria-label="Catalog navigation">' + ''.join(
        f'<a href="{url}"'+(' aria-current="page"' if key == active else '')+f'>{name}</a>'
        for url, name, key in links) + '<a class="saved-link" href="explore.html?saved=1" data-saved-link hidden>Saved <span data-saved-count>0</span></a></nav>'


def filters(brand=False):
    options = lambda values: ''.join(f'<option value="{e(k)}">{e(v)}</option>' for k, v in values)
    categories = options((c['id'], c['name']) for c in DATA['categories'])
    product_brands = {p['brand_id'] for p in DATA['products']}
    brands = options((b['id'], b['name']) for b in sorted(DATA['brands'], key=lambda b: b['name'].casefold()) if b['id'] in product_brands)
    brand_filter = '' if brand else f'<label>Brand<select name="brand"><option value="">All brands</option>{brands}</select></label>'
    return f'''<form class="catalog-tools" data-catalog-form role="search" hidden>
<div class="catalog-search-row"><label class="catalog-search-label">Search {'brands' if brand else 'products'}<input type="search" name="q" placeholder="{'Try RAW, DynaVap or Wildberry' if brand else 'Try grinders, bags or incense'}" autocomplete="off" maxlength="160"></label><button class="button dark" type="submit">Search <span aria-hidden="true">→</span></button></div>
<div class="catalog-filter-row"><label>Category<select name="category"><option value="">All categories</option>{categories}</select></label>{brand_filter}</div><details class="catalog-more-filters"><summary>More filters <span aria-hidden="true">+</span></summary><div class="catalog-advanced-row"><label>Collection<select name="collection"><option value="browse">Browse products</option><option value="all">Include past finds</option><option value="archive">Past finds only</option></select></label><label>Location<select name="location"><option value="">All locations</option><option value="denton">Denton</option><option value="lewisville">Lewisville</option></select></label><label>Sort<select name="sort"><option value="{'az' if brand else 'featured'}">{'Name A–Z' if brand else 'Featured'}</option><option value="{'featured' if brand else 'az'}">{'Featured' if brand else 'Name A–Z'}</option><option value="za">Name Z–A</option></select></label></div></details>
<div class="catalog-filter-actions"><button class="plain-button" type="reset">Reset filters</button><button class="plain-button" type="button" data-copy-link>Copy this view’s link</button><span class="catalog-action-message" role="status" data-copy-status></span></div><div class="share-fallback" hidden><label>View link<input type="text" readonly data-share-url></label></div></form>'''


def source_details(record):
    entries = []
    for key in record['source_ids']:
        source = SOURCES[key]
        entries.append(f'<li><a href="{e(source["url"])}" target="_blank" rel="noopener">{e(source["title"])} <span aria-hidden="true">↗</span></a><span>{e(source.get("date", "Date not stated"))}</span></li>')
    notes = record.get('notes', [])
    if isinstance(notes, str):
        notes = [notes]
    extra = record.get('details', [])
    if isinstance(extra, str): extra = [extra]
    notes = notes + extra
    return '<details class="catalog-source-details"><summary>Product background & sources <span aria-hidden="true">+</span></summary><div>'+''.join(f'<p>{e(n)}</p>' for n in notes)+f'<p>{e(record["name"])} · {e(record.get("evidence_date") or "Undated source")}</p><p>{e(location_text(record))}</p><p><strong>Source type:</strong> {e(record["evidence_label"])}</p><p>Research checked November 12, 2026. A published listing or dated photograph does not confirm stock today.</p><ul>{"".join(entries)}</ul></div></details>'


def detail(record, icon, brand=False):
    cat_ids = record.get('category_ids') or [record['category_id']]
    parent = 'brands.html' if brand else 'explore.html'
    label = 'Brands' if brand else 'Products'
    title = title_for(record)
    brand_link = '' if brand else f'<a class="detail-brand-link" href="brand-{e(record["brand_id"])}.html">{e(BRANDS[record["brand_id"]]["name"])}</a>'
    categories = ''.join(f'<a href="explore.html?category={e(c)}">{e(category_name(c))}</a>' for c in cat_ids)
    image_note = record.get('image', {}).get('caption', 'Category illustration; exact style may differ.') if isinstance(record.get('image', {}), dict) else 'Shop photo; date unknown.'
    merchandise = not brand and record['id'] in MERCH_IDS
    purchase = f'<p class="product-price detail-price" data-product-price="{e(record["id"])}"></p><div class="product-buy-panel" data-product-options="{e(record["id"])}"></div><div class="detail-purchase-actions">{purchase_button(record, True)}{favorite(record)}</div><p class="small-note">Preview item. Prices and options are examples; checkout creates a demo order.</p>' if merchandise else ('' if brand else favorite(record))
    availability = '<p class="small-note">A past shop feature. Shown here as part of the Ashes collection.</p>' if archived(record) else ''
    return f'''<div class="breadcrumb-bar"><a href="index.html">Home</a><span>/</span><a href="{parent}">{label}</a><span>/</span><span>{e(title)}</span></div>{catalog_nav('brands' if brand else 'products')}<section class="catalog-detail"><div class="catalog-detail-art">{visual(record, icon, brand)}<p class="catalog-image-note">{e(image_note)}</p></div><div class="catalog-detail-copy">{brand_link}<span class="product-category-label">{e(category_name(cat_ids[0]))}</span><h1>{e(title)}</h1><p class="detail-summary">{e(summary_for(record))}</p><div class="detail-category-links">{categories}</div>{availability}{purchase}<a class="text-link detail-back" href="{parent}">← Back to {'brands' if brand else 'products'}</a>{source_details(record)}</div></section>'''


def home_catalog(icon):
    wanted = ['ashes-logo-apparel', 'cookies-backpacks-product-family', 'ashes-beanies']
    featured = [next(p for p in DATA['products'] if p['id'] == key) for key in wanted]
    return '<section class="section home-catalog"><div class="section-heading"><div><span class="eyebrow">A LITTLE ASHES, EVERY DAY</span><h2>Wear it. Carry it. Make it yours.</h2></div><a class="text-link" href="merchandise.html">All merchandise →</a></div><div class="catalog-grid">'+''.join(card(p, icon) for p in featured)+'</div><div class="home-catalog-bottom"><a class="button dark" href="merchandise.html">Shop merchandise →</a><span>Preview store · Sample prices · No real orders</span></div></section>'


def build_catalog(page, icon):
    for is_brand, filename, title, records in [(False, 'explore.html', 'Products', DATA['products']), (True, 'brands.html', 'Brands', DATA['brands'])]:
        records = sorted(records, key=lambda r: r['name'].casefold()) if is_brand else sorted(records, key=lambda r: (r['evidence_status'] not in RECENT, r['name'].casefold()))
        subtitle = 'Find your favorites. Discover something different.' if is_brand else 'Apparel, bags, glass and everyday extras. Pick a category and find your thing.'
        heading = 'The names you know.' if is_brand else 'Find your thing.'
        body = f'''<section class="catalog-heading {'mint' if is_brand else 'lavender'}"><div><span class="eyebrow">{'BRANDS AT ASHES' if is_brand else 'BROWSE ASHES'}</span><h1>{heading}</h1><p>{subtitle}</p></div><a class="button dark" href="{'explore.html' if is_brand else 'merchandise.html'}">{'Browse products' if is_brand else 'Shop merchandise'} →</a></section>{catalog_nav('brands' if is_brand else 'products')}<section class="catalog-shell" data-catalog-directory="{'brands' if is_brand else 'products'}">{filters(is_brand)}<div class="catalog-results-bar"><h2 data-result-count aria-live="polite" aria-atomic="true">{len(records)} {'brands' if is_brand else 'products'}</h2><span data-active-view>Browse products</span></div><div class="saved-empty-note" data-saved-note hidden>Saved on this browser only. Use the Save button on a product to keep it here.</div><div class="catalog-grid {'brand-grid' if is_brand else ''}" data-catalog-grid>{''.join(card(r, icon, is_brand) for r in records)}</div><div class="catalog-empty" data-catalog-empty hidden><span aria-hidden="true">✦</span><h2>No matches yet.</h2><p>Try another search or reset your filters.</p><button class="button dark" data-empty-reset type="button">Show all {'brands' if is_brand else 'products'}</button></div><noscript><p class="small-note">All products are shown. Open any product or brand to read its details. Search and saved products require JavaScript.</p></noscript></section>'''
        page(filename, title, subtitle, body, 'brands' if is_brand else 'products')
    for brand in DATA['brands']:
        products = [p for p in DATA['products'] if p['brand_id'] == brand['id']]
        related = '<section class="section brand-products"><div class="section-heading"><div><span class="eyebrow">EXPLORE THE BRAND</span><h2>Products</h2></div></div><div class="catalog-grid">'+''.join(card(p, icon) for p in products)+'</div></section>' if products else '<section class="catalog-no-products"><h2>More from this brand</h2><p>Explore the other brands and categories at Ashes, or visit a shop to see the selection.</p><a class="text-link" href="brands.html">Explore more brands →</a></section>'
        page(f'brand-{brand["id"]}.html', brand['name'], summary_for(brand), detail(brand, icon, True)+related, 'brands')
    for product in DATA['products']:
        related = [p for p in DATA['products'] if p['id'] != product['id'] and p['category_id'] == product['category_id']][:3]
        body = detail(product, icon)
        if related:
            body += '<section class="section related-products"><div class="section-heading"><h2>More in this category</h2></div><div class="catalog-grid">'+''.join(card(p, icon) for p in related)+'</div></section>'
        page(f'product-{product["id"]}.html', title_for(product), summary_for(product), body, 'products')
    explanation = '''<section class="page-heading yellow"><span class="eyebrow">A CLEARER PRODUCT GUIDE</span><h1>About the catalog</h1><p>What the labels mean, and how to find your way around.</p></section>'''+catalog_nav('')+'''<section class="section catalog-explainer"><h2>Selection, with context.</h2><p>This guide brings together the named brands and products in Ashes’s published store pages, manufacturer retailer lists, shop photographs and dated posts. Each entry carries its source timing and store context.</p><dl><div><dt>Named on store pages</dt><dd>The current Ashes website explicitly names the brand or product family. It does not provide live quantities or prices.</dd></div><div><dt>Manufacturer listing</dt><dd>A manufacturer’s retailer directory names Ashes. This supports the retailer relationship, not every model made by that brand.</dd></div><div><dt>Dated product feature</dt><dd>An Ashes post featured the item on a specific date. A pictured one-off piece may no longer be available.</dd></div><div><dt>Undated carry list / shop photo</dt><dd>The name or object appears in a source with no reliable update or capture date.</dd></div><div><dt>From the archive / event association</dt><dd>The entry belongs to shop history or an event. It is not presented as current retail stock.</dd></div></dl><h2>Find and save.</h2><p>Search by name or product type, combine filters, and open a product or brand for its details. Copy a filtered view’s link to return to the same selection. Saved products stay in this browser; there is no account or order attached.</p><h2>Prices and purchasing</h2><p>The merchandise store is a working preview. Its prices and options are examples, and checkout creates a demo confirmation without sending an order or charging a payment. Other product categories are for browsing. Background sources were checked November 12, 2026.</p><a class="button dark" href="explore.html">Browse the catalog →</a></section>'''
    page('catalog-about.html', 'About the catalog', 'Understand the product guide, source labels and saved products.', explanation, 'products')

    merch_order = ['ashes-logo-apparel', 'ashes-beanies', 'cookies-backpacks-product-family', 'ashes-event-apparel', 'wildberry-incense-holders']
    merch = [next(p for p in DATA['products'] if p['id'] == key) for key in merch_order]
    body = '<section class="catalog-heading peach"><div><span class="eyebrow">ASHES MERCHANDISE</span><h1>A little Ashes.<br>Everywhere you go.</h1><p>Logo apparel, bags and extras with personality.</p></div><a class="button dark" href="cart.html">View cart <span data-cart-count>0</span> →</a></section>'+catalog_nav('merch')+'<section class="section merch-collection"><div class="section-heading"><h2>The merchandise collection</h2><span class="small-note">Sample prices & options for this preview</span></div><div class="catalog-grid">'+''.join(card(p, icon) for p in merch)+'</div><p class="small-note">This preview includes current and past merchandise types. Product backgrounds remain available on each detail page.</p></section>'
    page('merchandise.html', 'Shop merchandise', 'Ashes apparel, bags and extras. Try the working merchandise-store preview.', body, 'products')
    page('cart.html', 'Your cart', 'Review your Ashes merchandise cart.', '<section class="page-heading lavender"><span class="eyebrow">YOUR MERCHANDISE</span><h1>Your cart</h1><p>A little personality, ready to go.</p></section><section class="section store-page"><div data-cart-root></div><noscript><p>Enable JavaScript to use the cart.</p></noscript></section>', 'cart')
    page('checkout.html', 'Checkout', 'Complete a demo merchandise checkout. No payment is charged and no order is sent.', '<section class="page-heading mint"><span class="eyebrow">MERCHANDISE CHECKOUT</span><h1>Make it yours.</h1><p>Complete a preview order. No payment will be charged.</p></section><section class="section store-page"><div data-checkout-root></div><noscript><p>Enable JavaScript to use checkout.</p></noscript></section>', 'cart')
