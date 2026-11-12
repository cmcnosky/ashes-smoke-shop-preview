from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import json
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA_PATH = ROOT / "catalog.json"
RESULT_PATH = Path(__file__).with_name("catalog-verification.json")

ALLOWED_STATUSES = {
    "current_published",
    "manufacturer_listed",
    "dated_feature",
    "undated_profile",
    "undated_photo",
    "historical",
    "promotional_only",
}
ALLOWED_LOCATIONS = {"denton", "lewisville"}
FORBIDDEN_CATEGORY_IDS = {
    "hemp-cbd",
    "vapes",
    "nicotine",
    "tobacco",
    "cigars",
    "kratom",
    "detox",
}
FORBIDDEN_RECORD_IDS = {
    "wild-revival",
    "diamond-shruumz",
    "puff-bar",
    "puff-plus",
    "pop-bars",
    "pod-king-max",
    "uno-mas",
    "drag-beast",
}
FORBIDDEN_FIELDS = {
    "price",
    "price_cents",
    "inventory",
    "stock",
    "stock_count",
    "sku",
    "cart",
    "checkout",
    "buy_url",
    "payment_url",
}
ASSERTIVE_COMMERCE = re.compile(
    r"(?:available\s+now|in\s+stock|shop\s+now|buy\s+now|add\s+to\s+cart|"
    r"proceed\s+to\s+checkout|order\s+now|for\s+sale|\$\s*\d)",
    re.I,
)
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1 = 0
        self.links = []
        self.ids = []
        self.images = []
        self.forms = []
        self.aria_live = []
        self.text_parts = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag == "a":
            self.links.append(values.get("href", ""))
        if "id" in values:
            self.ids.append(values["id"])
        if tag == "img":
            self.images.append(values)
        if tag == "form":
            self.forms.append(values)
        if "aria-live" in values:
            self.aria_live.append(values["aria-live"])

    def handle_data(self, data):
        self.text_parts.append(data)

    @property
    def text(self):
        return " ".join(" ".join(self.text_parts).split())


errors = []
checks = {}


def fail(*parts):
    errors.append(" | ".join(str(part) for part in parts))


def require(condition, *parts):
    if not condition:
        fail(*parts)


require(DATA_PATH.exists(), "missing catalog data", DATA_PATH)
if not DATA_PATH.exists():
    RESULT_PATH.write_text(json.dumps({"errors": errors}, indent=2) + "\n")
    raise SystemExit(1)

data = json.loads(DATA_PATH.read_text())
categories = data.get("categories", [])
sources = data.get("sources", {})
brands = data.get("brands", [])
products = data.get("products", [])
category_ids = {item.get("id") for item in categories}
brand_ids = {item.get("id") for item in brands}
product_ids = {item.get("id") for item in products}

checks.update(
    {
        "categories": len(categories),
        "sources": len(sources),
        "brands": len(brands),
        "products": len(products),
    }
)

require(data.get("checked_at") == "2026-11-12", "unexpected evidence date", data.get("checked_at"))
require(set(data.get("status_definitions", {})) == ALLOWED_STATUSES, "status definition mismatch")
require(len(category_ids) == len(categories), "duplicate category IDs")
require(len(brand_ids) == len(brands), "duplicate brand IDs")
require(len(product_ids) == len(products), "duplicate product IDs")
require(not (category_ids & FORBIDDEN_CATEGORY_IDS), "regulated catalog categories", sorted(category_ids & FORBIDDEN_CATEGORY_IDS))
require(not (brand_ids & FORBIDDEN_RECORD_IDS), "excluded brand records present", sorted(brand_ids & FORBIDDEN_RECORD_IDS))
require(not (product_ids & FORBIDDEN_RECORD_IDS), "excluded product records present", sorted(product_ids & FORBIDDEN_RECORD_IDS))

for source_id, source in sources.items():
    require(re.fullmatch(r"S\d{2}", source_id) is not None, "invalid source ID", source_id)
    require(source.get("title") and source.get("date"), "incomplete source", source_id)
    source_url = source.get("url", "")
    parsed = urlsplit(source_url)
    require(parsed.scheme == "https" and bool(parsed.netloc), "source is not HTTPS", source_id, source_url)

for group_name, records in (("brand", brands), ("product", products)):
    for record in records:
        record_id = record.get("id")
        require(isinstance(record_id, str) and SLUG.fullmatch(record_id), "invalid slug", group_name, record_id)
        required = {
            "id",
            "name",
            "summary",
            "evidence_status",
            "evidence_label",
            "evidence_date",
            "locations",
            "source_ids",
        }
        require(required <= set(record), "missing required fields", group_name, record_id, sorted(required - set(record)))
        require(not (set(record) & FORBIDDEN_FIELDS), "commerce or invented inventory field", group_name, record_id, sorted(set(record) & FORBIDDEN_FIELDS))
        require(record.get("evidence_status") in ALLOWED_STATUSES, "invalid evidence status", group_name, record_id, record.get("evidence_status"))
        require(set(record.get("locations", [])) <= ALLOWED_LOCATIONS, "invalid location", group_name, record_id, record.get("locations"))
        require(bool(record.get("source_ids")), "record has no source", group_name, record_id)
        require(set(record.get("source_ids", [])) <= set(sources), "unknown record source", group_name, record_id, sorted(set(record.get("source_ids", [])) - set(sources)))
        require(not ASSERTIVE_COMMERCE.search(json.dumps(record, ensure_ascii=False)), "assertive commerce language", group_name, record_id)
        image = record.get("image")
        if image:
            image_src = image.get("src", "") if isinstance(image, dict) else image
            require(not urlsplit(image_src).scheme, "catalog image must be local", group_name, record_id, image_src)
            require((DOCS / image_src).exists(), "missing catalog image", group_name, record_id, image_src)
            if isinstance(image, dict):
                require(bool(image.get("alt")) and bool(image.get("caption")), "catalog image lacks alt or evidence caption", group_name, record_id)
                require(image.get("source_id") in record.get("source_ids", []), "catalog image source is not attached to record", group_name, record_id, image.get("source_id"))

for brand in brands:
    require(bool(brand.get("category_ids")), "brand has no category", brand.get("id"))
    require(set(brand.get("category_ids", [])) <= category_ids, "brand has unknown category", brand.get("id"))

for product in products:
    require(product.get("brand_id") in brand_ids, "product has unknown brand", product.get("id"), product.get("brand_id"))
    require(product.get("category_id") in category_ids, "product has unknown category", product.get("id"), product.get("category_id"))
    matching_brand = next((brand for brand in brands if brand["id"] == product.get("brand_id")), None)
    if matching_brand:
        require(product.get("category_id") in matching_brand.get("category_ids", []), "product category absent from brand", product.get("id"))

# These narrowly supported location scopes are easy to accidentally broaden in UI copy.
expected_brand_locations = {
    "santa-cruz-shredder": {"denton", "lewisville"},
    "diamond-grind": {"denton", "lewisville"},
    "ashes": {"denton", "lewisville"},
    "dynavap": {"denton"},
    "zig-zag": {"denton"},
    "berning-glass": {"lewisville"},
}
expected_product_locations = {
    "santa-cruz-shredder-grinders": {"denton", "lewisville"},
    "diamond-grind-grinders": {"denton", "lewisville"},
    "ashes-logo-apparel": {"denton", "lewisville"},
    "dynavap-devices": {"denton"},
    "berning-glass-rig": {"lewisville"},
    "zig-zag-rolling-papers": {"denton"},
    "zig-zag-pre-rolled-cones": {"denton"},
    "zig-zag-palm-rolls": {"denton"},
}
for record_id, expected in expected_brand_locations.items():
    record = next((item for item in brands if item["id"] == record_id), None)
    require(record is not None, "missing required brand", record_id)
    if record:
        require(set(record["locations"]) == expected, "brand location scope changed", record_id, record["locations"])
for record_id, expected in expected_product_locations.items():
    record = next((item for item in products if item["id"] == record_id), None)
    require(record is not None, "missing required product", record_id)
    if record:
        require(set(record["locations"]) == expected, "product location scope changed", record_id, record["locations"])

expected_pages = {
    "explore.html",
    "brands.html",
    "categories.html",
    *(f"brand-{record_id}.html" for record_id in brand_ids),
    *(f"product-{record_id}.html" for record_id in product_ids),
}
missing_pages = sorted(page for page in expected_pages if not (DOCS / page).exists())
require(not missing_pages, "missing catalog pages", missing_pages)

parsed_docs = {}
for page_name in sorted(expected_pages - set(missing_pages)):
    parser = Document()
    parser.feed((DOCS / page_name).read_text())
    parsed_docs[page_name] = parser
    require(parser.h1 == 1, "catalog page h1 count", page_name, parser.h1)
    require(len(parser.ids) == len(set(parser.ids)), "duplicate IDs", page_name)
    for image in parser.images:
        require(bool(image.get("alt")), "missing image alt", page_name, image.get("src"))
    for form in parser.forms:
        require(form.get("method", "get").lower() != "post", "catalog form posts data", page_name)

if "brands.html" in parsed_docs:
    brand_links = set(parsed_docs["brands.html"].links)
    for brand in brands:
        require(f"brand-{brand['id']}.html" in brand_links, "brand directory missing direct link", brand["id"])
if "categories.html" in parsed_docs:
    legacy_category_anchors = {"hemp-cbd", "vapes", "glass", "papers-tobacco", "accessories", "hookah", "kratom", "scents-merch"}
    require(legacy_category_anchors <= set(parsed_docs["categories.html"].ids), "category guide lost legacy anchors", sorted(legacy_category_anchors - set(parsed_docs["categories.html"].ids)))
if "explore.html" in parsed_docs:
    catalog = parsed_docs["explore.html"]
    product_links = set(catalog.links)
    for product in products:
        require(f"product-{product['id']}.html" in product_links, "catalog missing static product link", product["id"])
        require(product.get("display_name", product["name"]) in catalog.text, "catalog missing static product text", product["id"])
    require(bool(catalog.aria_live), "catalog lacks live result-status region")

for brand in brands:
    page_name = f"brand-{brand['id']}.html"
    if page_name not in parsed_docs:
        continue
    page = parsed_docs[page_name]
    require(brand["name"] in page.text, "brand detail lacks brand name", brand["id"])
    require(brand["evidence_label"] in page.text, "brand detail lacks evidence label", brand["id"])
    require(brand["evidence_date"] in page.text, "brand detail lacks evidence date", brand["id"])
    require("brands.html" in page.links, "brand detail lacks directory backlink", brand["id"])
    for product in products:
        if product["brand_id"] == brand["id"]:
            require(f"product-{product['id']}.html" in page.links, "brand detail lacks documented product link", brand["id"], product["id"])
    for source_id in brand["source_ids"]:
        require(sources[source_id]["url"] in page.links, "brand detail lacks source link", brand["id"], source_id)

for product in products:
    page_name = f"product-{product['id']}.html"
    if page_name not in parsed_docs:
        continue
    page = parsed_docs[page_name]
    require(product["name"] in page.text, "product detail lacks product name", product["id"])
    require(product["evidence_label"] in page.text, "product detail lacks evidence label", product["id"])
    require(product["evidence_date"] in page.text, "product detail lacks evidence date", product["id"])
    require("explore.html" in page.links, "product detail lacks catalog backlink", product["id"])
    require(f"brand-{product['brand_id']}.html" in page.links, "product detail lacks brand link", product["id"])
    for source_id in product["source_ids"]:
        require(sources[source_id]["url"] in page.links, "product detail lacks source link", product["id"], source_id)

catalog_js = DOCS / "assets" / "catalog.js"
require(catalog_js.exists(), "missing catalog JavaScript")
if catalog_js.exists():
    js = catalog_js.read_text()
    for parameter in ("q", "category", "brand", "collection", "location", "sort", "saved"):
        require(re.search(rf"[\"']{parameter}[\"']", js) is not None, "catalog JS lacks URL parameter", parameter)
    require("URLSearchParams" in js, "catalog JS does not initialize URL parameters")
    require("replaceState" in js, "catalog JS does not persist filter URL")
    require("categories.html#" in js, "catalog JS does not preserve legacy category links")
    syntax = subprocess.run(["node", "--check", str(catalog_js)], capture_output=True, text=True)
    require(syntax.returncode == 0, "catalog JavaScript syntax", syntax.stderr.strip())

checks["detail_pages"] = len(expected_pages) - 3
checks["expected_pages"] = len(expected_pages)
checks["errors"] = errors
RESULT_PATH.write_text(json.dumps(checks, indent=2) + "\n")
print(json.dumps(checks, indent=2))
assert not errors
