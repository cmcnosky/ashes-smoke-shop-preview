"""Static, evidence-bound catalog pages with progressively enhanced browsing."""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / 'catalog.json').read_text())
BRANDS = {b['id']: b for b in DATA['brands']}
CATEGORIES = {c['id']: c for c in DATA['categories']}
SOURCES = DATA['sources']
RECENT = {'current_published', 'manufacturer_listed'}
COLORS = ['mint', 'yellow', 'lavender', 'peach']


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


def visual(record, icon, brand=False):
    cat = (record.get('category_ids') or [record.get('category_id')])[0]
    image = record.get('image')
    if image:
        if isinstance(image, str):
            image = {'src': image, 'alt': record['name'], 'caption': 'Shop photograph · date unknown'}
        return f'<div class="catalog-visual photo"><img src="{e(image["src"])}" alt="{e(image["alt"])}" width="640" height="440" loading="lazy"><span class="image-date">{e(image.get("caption", "Shop photograph · date unknown"))}</span></div>'
    name = record['name'] if brand else BRANDS[record['brand_id']]['name']
    return f'<div class="catalog-visual {color_for(cat)}"><span class="catalog-doodle" aria-hidden="true">{icon(category_icon(cat))}</span><span class="catalog-brand-name">{e(name)}</span><span class="catalog-art-label">{e(category_name(cat))}</span><span class="catalog-spark" aria-hidden="true">✦</span></div>'


def favorite(record):
    return f'<button class="save-product" type="button" data-save="{e(record["id"])}" data-save-name="{e(record["name"])}" aria-pressed="false" aria-label="Save {e(record["name"])}" hidden><span aria-hidden="true">♡</span> <span data-save-label>Save</span></button>'


def card(record, icon, brand=False):
    prefix = 'brand' if brand else 'product'
    cats = record.get('category_ids') or [record['category_id']]
    brand_name = record['name'] if brand else BRANDS[record['brand_id']]['name']
    search = ' '.join([record['name'], brand_name, record.get('summary', ''), list_text(record.get('details', '')),
                       ' '.join(category_name(c) for c in cats)])
    freshness = 'recent' if record['evidence_status'] in RECENT else 'older'
    date = record.get('evidence_date') or ''
    badge = status_text(record)
    if date and record['evidence_status'] in {'dated_feature', 'historical'}:
        badge += ' · ' + (re.search(r'(?:19|20)\d{2}', date).group(0) if re.search(r'(?:19|20)\d{2}', date) else date)
    title_tag = 'h2'
    return f'''<article class="catalog-card" data-catalog-item data-id="{e(record['id'])}" data-name="{e(record['name'])}" data-search="{e(search)}" data-category="{e(' '.join(cats))}" data-brand="{e(record['id'] if brand else record['brand_id'])}" data-evidence="{freshness}" data-status="{e(record['evidence_status'])}" data-location="{e(' '.join(record.get('locations', [])))}" data-date="{e(date)}">
<a class="catalog-card-link" href="{prefix}-{e(record['id'])}.html">{visual(record, icon, brand)}<div class="catalog-card-body"><span class="evidence-badge {freshness}">{e(badge)}</span><{title_tag}>{e(record['name'])}</{title_tag}><p>{e(record.get('summary', ''))}</p><span class="catalog-location">{e(location_text(record))}</span><span class="card-detail-link">{'Explore brand' if brand else 'View details'} <span aria-hidden="true">→</span></span></div></a>{'' if brand else favorite(record)}</article>'''


def catalog_nav(active):
    links = [('explore.html', 'Products', 'products'), ('brands.html', 'Brands A–Z', 'brands'),
             ('categories.html', 'Category guide', 'categories')]
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
<div class="catalog-filter-row"><label>Category<select name="category"><option value="">All categories</option>{categories}</select></label>{brand_filter}</div><details class="catalog-more-filters"><summary>More filters <span aria-hidden="true">+</span></summary><div class="catalog-advanced-row"><label>Listing history<select name="evidence"><option value="">All entries</option><option value="recent">Current published listings</option><option value="older">Older or undated entries</option></select></label><label>Store in source<select name="location"><option value="">All / unspecified</option><option value="denton">Denton</option><option value="lewisville">Lewisville</option></select></label><label>Sort<select name="sort"><option value="{'az' if brand else 'featured'}">{'Name A–Z' if brand else 'Most supported first'}</option><option value="{'featured' if brand else 'az'}">{'Most supported first' if brand else 'Name A–Z'}</option><option value="za">Name Z–A</option></select></label></div></details>
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
    return '<details class="catalog-source-details"><summary>About this entry & sources <span aria-hidden="true">+</span></summary><div>'+''.join(f'<p>{e(n)}</p>' for n in notes)+f'<p><strong>Source type:</strong> {e(record["evidence_label"])}</p><p>Research checked November 12, 2026. A published listing or dated photograph does not confirm stock today.</p><ul>{"".join(entries)}</ul></div></details>'


def detail(record, icon, brand=False):
    cat_ids = record.get('category_ids') or [record['category_id']]
    parent = 'brands.html' if brand else 'explore.html'
    label = 'Brands' if brand else 'Products'
    title = record['name']
    meta = f'<span class="evidence-badge {"recent" if record["evidence_status"] in RECENT else "older"}">{e(status_text(record))}</span>'
    details = record.get('details', [])
    if isinstance(details, str):
        details = [details]
    if not brand and not details:
        details = ['This entry describes a product family or documented item. Exact models, variants and current pricing have not been published in the sources reviewed.']
    brand_link = '' if brand else f'<a class="detail-brand-link" href="brand-{e(record["brand_id"])}.html">{e(BRANDS[record["brand_id"]]["name"])} <span aria-hidden="true">↗</span></a>'
    categories = ''.join(f'<a href="explore.html?category={e(c)}">{e(category_name(c))}</a>' for c in cat_ids)
    facts = f'<dl class="catalog-facts"><div><dt>Documented location</dt><dd>{e(location_text(record))}</dd></div><div><dt>Listing date</dt><dd>{e(record.get("evidence_date") or "Undated source")}</dd></div><div><dt>Availability</dt><dd>Current stock and prices not verified</dd></div></dl>'
    return f'''<div class="breadcrumb-bar"><a href="index.html">Home</a><span>/</span><a href="{parent}">{label}</a><span>/</span><span>{e(title)}</span></div>{catalog_nav('brands' if brand else 'products')}<section class="catalog-detail"><div class="catalog-detail-art">{visual(record, icon, brand)}<p class="catalog-image-note">{'Source photograph; its date and context are described below.' if record.get('image') else 'Category illustration. No particular model or variant is pictured.'}</p></div><div class="catalog-detail-copy">{brand_link}{meta}<h1>{e(title)}</h1><p class="detail-summary">{e(record.get('summary', ''))}</p><div class="detail-category-links">{categories}</div>{facts}{'' if brand else favorite(record)}<a class="text-link" href="{parent}">← Back to {'brands' if brand else 'products'}</a>{source_details(record)}</div></section>'''


def home_catalog(icon):
    featured = [p for p in DATA['products'] if p['evidence_status'] in RECENT][:3]
    return '<section class="section home-catalog"><div class="section-heading"><div><span class="eyebrow">A CLOSER LOOK AT THE SELECTION</span><h2>Meet the brands.</h2></div><a class="text-link" href="brands.html">All brands A–Z →</a></div><p class="catalog-intro-line">Named brands, product families and finds from the shop’s history.</p><div class="catalog-grid">'+''.join(card(p, icon) for p in featured)+'</div><div class="home-catalog-bottom"><a class="button dark" href="explore.html">Explore the product catalog →</a><span>Published selection and archived finds are clearly labeled.</span></div></section>'


def build_catalog(page, icon):
    for is_brand, filename, title, records in [(False, 'explore.html', 'Product catalog', DATA['products']), (True, 'brands.html', 'Brand directory', DATA['brands'])]:
        records = sorted(records, key=lambda r: r['name'].casefold()) if is_brand else sorted(records, key=lambda r: (r['evidence_status'] not in RECENT, r['name'].casefold()))
        subtitle = 'Get to know the names in Ashes’s published selection and shop history.' if is_brand else 'Explore the brands, accessories and documented finds behind the categories.'
        heading = 'Brands A–Z' if is_brand else 'Products, with personality.'
        body = f'''<section class="catalog-heading {'mint' if is_brand else 'lavender'}"><div><span class="eyebrow">THE ASHES {'BRAND DIRECTORY' if is_brand else 'PRODUCT CATALOG'}</span><h1>{heading}</h1><p>{subtitle}</p></div><div class="catalog-heading-stat"><strong>{len(records):02d}</strong><span>{'brand profiles' if is_brand else 'product entries'}</span></div></section>{catalog_nav('brands' if is_brand else 'products')}<section class="catalog-shell" data-catalog-directory="{'brands' if is_brand else 'products'}">{filters(is_brand)}<div class="catalog-context"><p>A guide to published selection and past finds. <strong>Stock and prices are not live.</strong></p><a href="catalog-about.html">How to read this catalog →</a></div><div class="catalog-results-bar"><h2 data-result-count aria-live="polite" aria-atomic="true">{len(records)} {'brands' if is_brand else 'products'}</h2><span data-active-view>All entries</span></div><div class="saved-empty-note" data-saved-note hidden>Saved on this browser only. Use the Save button on a product to keep it here.</div><div class="catalog-grid {'brand-grid' if is_brand else ''}" data-catalog-grid>{''.join(card(r, icon, is_brand) for r in records)}</div><div class="catalog-empty" data-catalog-empty hidden><span aria-hidden="true">✦</span><h2>No matching entries.</h2><p>Try another search or reset your filters.</p><button class="button dark" data-empty-reset type="button">Show all {'brands' if is_brand else 'products'}</button></div><noscript><p class="small-note">All entries are shown. Open any product or brand to read its details. Search and saved products require JavaScript.</p></noscript></section>'''
        page(filename, title, subtitle, body, 'brands' if is_brand else 'products')
    for brand in DATA['brands']:
        products = [p for p in DATA['products'] if p['brand_id'] == brand['id']]
        related = '<section class="section brand-products"><div class="section-heading"><div><span class="eyebrow">IN THE GUIDE</span><h2>Documented products</h2></div></div><div class="catalog-grid">'+''.join(card(p, icon) for p in products)+'</div></section>' if products else '<section class="catalog-no-products"><h2>A brand-level entry</h2><p>The source names this brand without identifying individual models or products. We have kept the entry at that level.</p><a class="text-link" href="brands.html">Explore more brands →</a></section>'
        page(f'brand-{brand["id"]}.html', brand['name'], brand['summary'], detail(brand, icon, True)+related, 'brands')
    for product in DATA['products']:
        related = [p for p in DATA['products'] if p['id'] != product['id'] and p['category_id'] == product['category_id']][:3]
        body = detail(product, icon)
        if related:
            body += '<section class="section related-products"><div class="section-heading"><h2>More in this category</h2></div><div class="catalog-grid">'+''.join(card(p, icon) for p in related)+'</div></section>'
        page(f'product-{product["id"]}.html', product['name'], product['summary'], body, 'products')
    explanation = '''<section class="page-heading yellow"><span class="eyebrow">A CLEARER PRODUCT GUIDE</span><h1>About the catalog</h1><p>What the labels mean, and how to find your way around.</p></section>'''+catalog_nav('')+'''<section class="section catalog-explainer"><h2>Selection, with context.</h2><p>This guide brings together the named brands and products in Ashes’s published store pages, manufacturer retailer lists, shop photographs and dated posts. Each entry carries its source timing and store context.</p><dl><div><dt>Named on store pages</dt><dd>The current Ashes website explicitly names the brand or product family. It does not provide live quantities or prices.</dd></div><div><dt>Manufacturer listing</dt><dd>A manufacturer’s retailer directory names Ashes. This supports the retailer relationship, not every model made by that brand.</dd></div><div><dt>Dated product feature</dt><dd>An Ashes post featured the item on a specific date. A pictured one-off piece may no longer be available.</dd></div><div><dt>Undated carry list / shop photo</dt><dd>The name or object appears in a source with no reliable update or capture date.</dd></div><div><dt>From the archive / event association</dt><dd>The entry belongs to shop history or an event. It is not presented as current retail stock.</dd></div></dl><h2>Find and save.</h2><p>Search by name or product type, combine filters, and open a product or brand for its details. Copy a filtered view’s link to return to the same selection. Saved products stay in this browser; there is no account or order attached.</p><h2>Prices and purchasing</h2><p>This is an informational catalog. It does not accept orders or payments, and it does not invent prices, sizes, flavors or stock quantities. Sources were checked November 12, 2026.</p><a class="button dark" href="explore.html">Browse the catalog →</a></section>'''
    page('catalog-about.html', 'About the catalog', 'Understand the product guide, source labels and saved products.', explanation, 'products')
