"""Focused verifier for the 2026-11-12 competitor-reference storefront."""

from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import parse_qs, urlsplit
import json
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATE = "2026-11-12"
EXPECTED = {"sources": 5, "products": 34, "options": 41, "images": 43}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LOCAL_IMAGE = re.compile(r"^assets/products/[a-z0-9][a-z0-9_.-]*\.webp$")
ALLOWED_CATEGORIES = {"glass", "grinders", "papers", "trays", "lighters", "storage", "cleaning", "scents"}
REGULATED = re.compile(r"\b(?:thca|thc|delta[- ]?[89]|cbd|cannabis|hemp|nicotine|tobacco|kratom|vapes?|e[- ]?liquids?)\b", re.I)
OLD_IDS = {
    "ashes-beanies", "ashes-event-apparel", "ashes-gift-card", "ashes-logo-apparel",
    "berning-glass-rig", "cookies-backpacks-product-family", "diamond-grind-grinders",
    "dynavap-devices", "flytlab-accessory-display", "grav-hand-pipes",
    "job-organic-hemp-paper", "ocb-event-giveaways", "ocb-virgin-paper",
    "raw-paper-merchandising", "roor-glass", "santa-cruz-shredder-grinders",
    "toker-poker-accessories", "wildberry-incense-holders", "zig-zag-palm-rolls",
    "zig-zag-pre-rolled-cones", "zig-zag-rolling-papers",
}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1 = 0
        self.links = []
        self.images = []
        self.ids = []
        self.elements = []
        self.text_parts = []
        self.hidden_depth = 0

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        self.elements.append((tag, values))
        self.h1 += tag == "h1"
        if tag == "a":
            self.links.append(values.get("href", ""))
        if tag == "img":
            self.images.append(values)
        if "id" in values:
            self.ids.append(values["id"])
        if tag in {"script", "style"}:
            self.hidden_depth += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.hidden_depth:
            self.hidden_depth -= 1

    def handle_data(self, data):
        if not self.hidden_depth:
            self.text_parts.append(data)

    @property
    def text(self):
        return " ".join(" ".join(self.text_parts).split())

    def marked(self, tag, attribute):
        return [attrs for current, attrs in self.elements if current == tag and attribute in attrs]


errors = []


def require(condition, *parts):
    if not condition:
        errors.append(" | ".join(str(part) for part in parts))


def https(value):
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def image_path(value):
    if not isinstance(value, str) or not LOCAL_IMAGE.fullmatch(value):
        return None
    relative = PurePosixPath(value)
    if relative.is_absolute() or ".." in relative.parts:
        return None
    return DOCS.joinpath(*relative.parts)


def valid_webp(path):
    if not path or not path.is_file() or path.stat().st_size < 1024:
        return False
    header = path.read_bytes()[:12]
    return header[:4] == b"RIFF" and header[8:12] == b"WEBP"


inventory = json.loads((ROOT / "inventory.json").read_text())
commerce = json.loads((ROOT / "commerce.json").read_text())
sources = inventory.get("sources", [])
products = inventory.get("products", [])
items = commerce.get("items", [])
source_ids = [source.get("id") for source in sources]
product_ids = [product.get("id") for product in products]
item_ids = [item.get("id") for item in items]

require(inventory.get("version") == 1, "inventory version", inventory.get("version"))
require(inventory.get("checked_at") == DATE, "inventory date", inventory.get("checked_at"))
require(inventory.get("status") == "competitor_reference_demo", "inventory status", inventory.get("status"))
boundary = inventory.get("boundary", "").lower()
require("not ashes stock or prices" in boundary and "no transactions" in boundary, "inventory boundary is incomplete")
require(len(sources) == EXPECTED["sources"], "source count", len(sources))
require(len(products) == EXPECTED["products"], "product count", len(products))
require(len(source_ids) == len(set(source_ids)), "duplicate source IDs", source_ids)
require(len(product_ids) == len(set(product_ids)), "duplicate product IDs")
require(not (set(product_ids) & OLD_IDS), "retired products in inventory", sorted(set(product_ids) & OLD_IDS))

source_names = set()
for source in sources:
    source_id = source.get("id")
    name = source.get("retailer") or source.get("name")
    source_names.add(name)
    require(isinstance(source_id, str) and SLUG.fullmatch(source_id), "source ID", source_id)
    require(isinstance(name, str) and name.strip(), "source retailer", source_id)
    addresses = [source.get("address")] if source.get("address") else source.get("addresses", [])
    require(isinstance(addresses, list) and addresses and all(isinstance(value, str) and value.strip() for value in addresses), "source address", source_id)
    urls = [source.get(key) for key in ("source_url", "address_source_url", "secondary_location_source_url", "catalog_source_url") if source.get(key)]
    urls += source.get("catalog_source_urls", [])
    require(urls and all(https(value) for value in urls), "source HTTPS evidence", source_id, urls)

local_images = set()
option_count = 0
for product in products:
    product_id = product.get("id")
    required = {"id", "name", "source_name", "brand", "category", "description", "image", "source_image_url", "options", "source", "source_note"}
    require(isinstance(product_id, str) and SLUG.fullmatch(product_id), "product ID", product_id)
    require(required <= set(product), "product fields", product_id, sorted(required - set(product)))
    require(product.get("category") in ALLOWED_CATEGORIES, "product category", product_id, product.get("category"))
    identity = " ".join(str(product.get(key, "")) for key in ("id", "name", "source_name", "brand", "category", "description"))
    require(not REGULATED.search(identity), "regulated product in ordinary inventory", product_id)
    for key in ("name", "source_name", "brand", "description", "source_note"):
        require(isinstance(product.get(key), str) and product[key].strip(), "empty product field", product_id, key)

    path = image_path(product.get("image"))
    require(valid_webp(path), "product image", product_id, product.get("image"))
    require(https(product.get("source_image_url")), "product source image URL", product_id)
    local_images.add(product.get("image"))

    options = product.get("options", [])
    option_count += len(options)
    require(isinstance(options, list) and options, "product options", product_id)
    option_ids = []
    for option in options:
        option_id = option.get("id") if isinstance(option, dict) else None
        option_ids.append(option_id)
        require(isinstance(option_id, str) and SLUG.fullmatch(option_id), "option ID", product_id, option_id)
        require(isinstance(option.get("label"), str) and option["label"].strip(), "option label", product_id, option_id)
        amount = option.get("amount_minor")
        require(isinstance(amount, int) and not isinstance(amount, bool) and 0 < amount <= 10_000_000, "option price", product_id, option_id, amount)
        if option.get("image") is not None:
            option_path = image_path(option["image"])
            require(valid_webp(option_path), "option image", product_id, option_id, option.get("image"))
            require(https(option.get("source_image_url")), "option source image URL", product_id, option_id)
            variation_id = option.get("source_variation_id")
            require(isinstance(variation_id, int) and not isinstance(variation_id, bool) and variation_id > 0, "option source variation ID", product_id, option_id)
            local_images.add(option["image"])
    require(len(option_ids) == len(set(option_ids)), "duplicate option IDs", product_id)
    if len(options) > 1:
        require(product.get("category") == "grinders", "multi-option non-grinder", product_id)
        require(all(option.get("image") for option in options), "multi-option grinder lacks color images", product_id)

    evidence = product.get("source", {})
    require(https(evidence.get("url")), "product source URL", product_id, evidence.get("url"))
    require(evidence.get("retailer") in source_names, "product source retailer", product_id, evidence.get("retailer"))
    require(evidence.get("checked_at") == DATE, "product source date", product_id, evidence.get("checked_at"))
    require(isinstance(evidence.get("availability_as_listed"), str) and evidence["availability_as_listed"].strip(), "product availability wording", product_id)

require(option_count == EXPECTED["options"], "option count", option_count)
require(len(local_images) == EXPECTED["images"], "inventory image count", len(local_images))
expected_files = {str(DOCS / value) for value in local_images}
actual_files = {str(path) for path in (DOCS / "assets/products").glob("*") if path.is_file()}
require(actual_files == expected_files, "local image set mismatch", {"missing": sorted(expected_files - actual_files), "extra": sorted(actual_files - expected_files)})

require(commerce.get("version") == 1 and commerce.get("mode") == "demo" and commerce.get("currency") == "USD", "commerce mode/version/currency")
require(commerce.get("checkout") == {"endpoint": None, "allowed_hosts": []}, "commerce connection must remain unplugged")
require(len(items) == EXPECTED["products"] and len(item_ids) == len(set(item_ids)), "commerce item count or duplicate IDs", len(items))
require(set(item_ids) == set(product_ids), "inventory/commerce IDs differ", {"inventory_only": sorted(set(product_ids) - set(item_ids)), "commerce_only": sorted(set(item_ids) - set(product_ids))})
require(not (set(item_ids) & OLD_IDS), "retired products in commerce", sorted(set(item_ids) & OLD_IDS))
items_by_id = {item["id"]: item for item in items}
for product in products:
    expected = {"id": product["id"], "name": product["name"], "href": f"product-{product['id']}.html", "image": product["image"], "cart_enabled": True, "availability_status": "demo", "options": product["options"]}
    require(items_by_id.get(product["id"]) == expected, "commerce projection mismatch", product["id"])

expected_pages = {"index.html", "explore.html", "merchandise.html", "brands.html", "cart.html", "checkout.html", "catalog-about.html", *(f"product-{value}.html" for value in product_ids)}
for old_id in OLD_IDS:
    require(not (DOCS / f"product-{old_id}.html").exists(), "retired product page remains", old_id)

pages = {}
for page_name in sorted(expected_pages):
    file = DOCS / page_name
    require(file.is_file(), "missing storefront page", page_name)
    if not file.is_file():
        continue
    raw = file.read_text()
    parser = Page()
    parser.feed(raw)
    pages[page_name] = parser
    require(parser.h1 == 1, "page h1 count", page_name, parser.h1)
    require(len(parser.ids) == len(set(parser.ids)), "duplicate HTML IDs", page_name)
    require(all(image.get("alt") for image in parser.images), "page image lacks alt", page_name)
    match = re.search(r'<script id="store-config" type="application/json">(.*?)</script>', raw, re.S)
    require(match is not None, "page lacks store config", page_name)
    if match:
        require(json.loads(match.group(1)) == commerce, "embedded commerce differs", page_name)

for page_name in ("explore.html", "merchandise.html"):
    page = pages.get(page_name)
    if not page:
        continue
    cards = page.marked("article", "data-retail-item")
    card_ids = [card.get("data-id") for card in cards]
    buttons = [button.get("data-cart-add") for button in page.marked("button", "data-cart-add")]
    require(len(cards) == EXPECTED["products"] and set(card_ids) == set(product_ids), "collection cards", page_name, len(cards))
    require(set(buttons) == set(product_ids), "collection cart controls", page_name)

home = pages.get("index.html")
if home:
    home_file = DOCS / "index.html"
    home_raw = home_file.read_text()
    skeleton_images = [image for image in home.images if image.get("src") == "assets/ashes-v4-hero.webp"]
    require(len(skeleton_images) == 1, "homepage skeleton hero image", len(skeleton_images))
    if skeleton_images:
        require("skeleton" in skeleton_images[0].get("alt", "").lower(), "homepage skeleton image alt", skeleton_images[0].get("alt"))

    require("explore.html" in home.links, "homepage lacks direct shop entry")
    home_categories = set()
    for link in home.links:
        parsed = urlsplit(link)
        if parsed.path != "explore.html":
            continue
        values = parse_qs(parsed.query).get("category", [])
        home_categories.update(value for value in values if value in ALLOWED_CATEGORIES)
    require(home_categories == ALLOWED_CATEGORIES, "homepage category links", {"missing": sorted(ALLOWED_CATEGORIES - home_categories), "extra": sorted(home_categories - ALLOWED_CATEGORIES)})

    cards = home.marked("article", "data-retail-item")
    card_ids = [card.get("data-id") for card in cards]
    buttons = [button.get("data-cart-add") for button in home.marked("button", "data-cart-add")]
    require(bool(card_ids), "homepage has no featured inventory")
    require(len(card_ids) == len(set(card_ids)), "duplicate homepage featured products", card_ids)
    require(set(card_ids) <= set(product_ids), "homepage featured products outside inventory", sorted(set(card_ids) - set(product_ids)))
    require(set(buttons) == set(card_ids), "homepage featured cart controls", {"cards": card_ids, "buttons": buttons})
    require(not (set(card_ids) & OLD_IDS), "retired homepage featured products", sorted(set(card_ids) & OLD_IDS))
    require(not any(old_id in home_raw for old_id in OLD_IDS), "retired product reference remains on homepage")

for product in products:
    page = pages.get(f"product-{product['id']}.html")
    if not page:
        continue
    require(product["name"] in page.text and product["brand"] in page.text, "product identity missing from page", product["id"])
    require(product["source"]["retailer"] in page.text and DATE in page.text, "product evidence missing from page", product["id"])
    require(product["source"]["url"] in page.links, "product source link missing", product["id"])
    require(product["id"] in [button.get("data-cart-add") for button in page.marked("button", "data-cart-add")], "product cart control missing", product["id"])
    if len(product["options"]) > 1:
        require(product["id"] in [node.get("data-product-options") for node in page.marked("div", "data-product-options")], "product option target missing", product["id"])

for script_name in ("store.js", "retail.js"):
    script = DOCS / "assets" / script_name
    result = subprocess.run(["node", "--check", str(script)], capture_output=True, text=True)
    require(result.returncode == 0, "JavaScript syntax", script_name, result.stderr.strip())

report = {**EXPECTED, "actual_sources": len(sources), "actual_products": len(products), "actual_options": option_count, "actual_images": len(local_images), "product_pages": sum((DOCS / f"product-{value}.html").is_file() for value in product_ids), "errors": errors}
print(json.dumps(report, indent=2))
if errors:
    raise SystemExit(1)
