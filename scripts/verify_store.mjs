import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = require(path.join(root, 'docs/assets/store.js'));
const commerce = JSON.parse(await readFile(path.join(root, 'commerce.json'), 'utf8'));
const inventory = JSON.parse(await readFile(path.join(root, 'inventory.json'), 'utf8'));
const config = core.normalizeConfig(commerce);
const inventoryById = new Map(inventory.products.map(item => [item.id, item]));
const configById = new Map(config.items.map(item => [item.id, item]));
const oldIds = new Set([
  'ashes-beanies', 'ashes-event-apparel', 'ashes-gift-card', 'ashes-logo-apparel',
  'berning-glass-rig', 'cookies-backpacks-product-family', 'diamond-grind-grinders',
  'dynavap-devices', 'flytlab-accessory-display', 'grav-hand-pipes',
  'job-organic-hemp-paper', 'ocb-event-giveaways', 'ocb-virgin-paper',
  'raw-paper-merchandising', 'roor-glass', 'santa-cruz-shredder-grinders',
  'toker-poker-accessories', 'wildberry-incense-holders', 'zig-zag-palm-rolls',
  'zig-zag-pre-rolled-cones', 'zig-zag-rolling-papers'
]);
const regulated = /\b(?:thca|thc|delta[- ]?[89]|cbd|cannabis|hemp|nicotine|tobacco|kratom|vapes?|e[- ]?liquids?)\b/i;

assert.equal(inventory.checked_at, '2026-11-12');
assert.equal(inventory.status, 'competitor_reference_demo');
assert.equal(inventory.products.length, 34);
assert.equal(inventory.products.reduce((sum, item) => sum + item.options.length, 0), 41);
assert.equal(config.mode, 'demo');
assert.equal(config.currency, 'USD');
assert.equal(config.items.length, 34);
assert.equal(commerce.items.length, 34);
assert.equal(config.demo.shipping_minor, 500);
assert.equal(config.demo.tax_rate, 0.0825);
assert.equal(config.checkout.endpoint, null);
assert.deepEqual(config.checkout.allowed_hosts, []);
assert.deepEqual(new Set(config.items.map(item => item.id)), new Set(inventory.products.map(item => item.id)));

for (const source of inventory.products) {
  assert(!oldIds.has(source.id), `Retired product entered inventory: ${source.id}`);
  assert(!regulated.test(`${source.id} ${source.name} ${source.source_name} ${source.brand} ${source.category} ${source.description}`), `Regulated product entered ordinary inventory: ${source.id}`);
  const rawItem = commerce.items.find(item => item.id === source.id);
  assert(rawItem, `Missing commerce item: ${source.id}`);
  assert.deepEqual(rawItem, {
    id: source.id,
    name: source.name,
    href: `product-${source.id}.html`,
    image: source.image,
    cart_enabled: true,
    availability_status: 'demo',
    options: source.options
  }, `Commerce projection differs from inventory: ${source.id}`);

  const item = configById.get(source.id);
  assert(item, `Normalized config dropped product: ${source.id}`);
  assert.equal(item.name, source.name);
  assert.equal(item.href, `product-${source.id}.html`);
  assert.equal(item.image, source.image);
  assert.equal(item.availability_status, 'demo');
  assert.equal(item.options.length, source.options.length);
  source.options.forEach((rawOption, index) => {
    const option = item.options[index];
    assert.deepEqual(option, {
      id: rawOption.id,
      label: rawOption.label,
      amount_minor: rawOption.amount_minor,
      image: rawOption.image || null
    }, `Normalized option differs from inventory: ${source.id}/${rawOption.id}`);
    assert.match(option.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof option.label, 'string');
    assert(Number.isSafeInteger(option.amount_minor) && option.amount_minor > 0);
  });
}

for (const id of oldIds) {
  assert(!inventoryById.has(id), `Retired product remains in inventory: ${id}`);
  assert(!configById.has(id), `Retired product remains cart-enabled: ${id}`);
}

const multiOptionGrinder = inventory.products.find(item => item.category === 'grinders' && item.options.length > 1);
assert(multiOptionGrinder, 'A verified multi-option grinder is required for variant tests');
const grinder = configById.get(multiOptionGrinder.id);
assert(grinder && grinder.options.length > 1);
const [firstVariant, secondVariant] = grinder.options;
assert(firstVariant.image && secondVariant.image, 'Multi-option grinder variants must preserve local images');
assert.notEqual(firstVariant.image, secondVariant.image, 'Variant images must remain distinct');

const singleItem = config.items.find(item => item.id !== grinder.id && item.options.length === 1);
assert(singleItem, 'A single-option product is required for mixed-cart tests');
const singleOption = singleItem.options[0];

let cart = core.sanitizeCart({items: [
  {id: grinder.id, option_id: firstVariant.id, quantity: 2},
  {id: grinder.id, option_id: firstVariant.id, quantity: 50},
  {id: grinder.id, option_id: 'not-an-option', quantity: 1},
  {id: 'ashes-logo-apparel', option_id: 'tee-small', quantity: 1},
  {id: '<img src=x onerror=alert(1)>', option_id: 'x', quantity: 1},
  {id: singleItem.id, option_id: singleOption.id, quantity: Number.NaN}
]}, config);
assert.deepEqual(cart, [{id: grinder.id, option_id: firstVariant.id, quantity: config.max_quantity_per_item}]);
assert.deepEqual(core.sanitizeCart({items: [
  {id: grinder.id, option_id: firstVariant.id, quantity: '2items'},
  {id: grinder.id, option_id: firstVariant.id, quantity: '2.5'},
  {id: grinder.id, option_id: firstVariant.id, quantity: '02'}
]}, config), [], 'Malformed and non-canonical quantities must not be partially parsed');

const malformedNumberConfig = core.normalizeConfig({...commerce, max_quantity_per_item: '2items', demo: {...commerce.demo, shipping_minor: '500items'}});
assert.equal(malformedNumberConfig.max_quantity_per_item, 10, 'Malformed maximum quantity must use the safe default');
assert.equal(malformedNumberConfig.demo.shipping_minor, 0, 'Malformed shipping amount must use the safe default');

cart = core.addItem([], grinder.id, firstVariant.id, config);
assert.deepEqual(cart, [{id: grinder.id, option_id: firstVariant.id, quantity: 1}]);
cart = core.addItem(cart, grinder.id, secondVariant.id, config);
assert.equal(cart.length, 2, 'Different grinder variants must remain separate cart lines');
assert.deepEqual(core.addItem([], 'ashes-logo-apparel', 'tee-small', config), [], 'Retired products cannot enter the cart');
assert.deepEqual(core.addItem([], grinder.id, 'missing', config), [], 'Unknown variants cannot enter the cart');
const orderedCart = [
  {id: grinder.id, option_id: firstVariant.id, quantity: 1},
  {id: singleItem.id, option_id: singleOption.id, quantity: 1},
  {id: grinder.id, option_id: secondVariant.id, quantity: 1}
];
assert.deepEqual(core.updateQuantity(orderedCart, grinder.id, firstVariant.id, 2, config), [
  {id: grinder.id, option_id: firstVariant.id, quantity: 2},
  {id: singleItem.id, option_id: singleOption.id, quantity: 1},
  {id: grinder.id, option_id: secondVariant.id, quantity: 1}
], 'Updating a quantity must preserve the cart line position');
assert.deepEqual(core.updateQuantity(cart, grinder.id, firstVariant.id, 0, config), [
  {id: grinder.id, option_id: secondVariant.id, quantity: 1}
]);

const review = [
  {id: grinder.id, option_id: firstVariant.id, quantity: 2},
  {id: singleItem.id, option_id: singleOption.id, quantity: 1}
];
const subtotal = firstVariant.amount_minor * 2 + singleOption.amount_minor;
const roundedTax = amount => Math.floor(amount * 825 / 10000 + 0.5);
assert.equal(core.totalQuantity(review), 3);
assert.equal(core.cartSubtotal(review, config), subtotal);
assert.deepEqual(core.calculateDemoTotals(review, 'pickup-denton', config), {
  subtotal, shipping: 0, tax: roundedTax(subtotal), total: subtotal + roundedTax(subtotal)
});
assert.deepEqual(core.calculateDemoTotals(review, 'shipping', config), {
  subtotal, shipping: 500, tax: roundedTax(subtotal + 500), total: subtotal + 500 + roundedTax(subtotal + 500)
});
assert.equal(core.calculateDemoTotals(review, 'invalid', config), null);

const roundingConfig = core.normalizeConfig({
  mode: 'demo', demo: {shipping_minor: 0, tax_rate: 0.125},
  checkout: {endpoint: null, allowed_hosts: []},
  items: [{id: 'rounding-probe', name: 'Rounding probe', href: 'merchandise.html', image: null,
    cart_enabled: true, availability_status: 'demo', options: [{id: 'single', label: 'Single', amount_minor: 4}]}]
});
assert.deepEqual(core.calculateDemoTotals([{id: 'rounding-probe', option_id: 'single', quantity: 1}], 'pickup-denton', roundingConfig), {
  subtotal: 4, shipping: 0, tax: 1, total: 5
}, 'Tax must round a half-cent to one whole minor unit');

const shippingTotals = core.calculateDemoTotals(review, 'shipping', config);
const receipt = core.createDemoReceipt(review, 'shipping', config, '2026-11-12T12:00:00Z', 'abc-123');
assert.equal(receipt.order_id, 'DEMO-ABC123');
assert.equal(receipt.total, shippingTotals.total);
assert(!('name' in receipt) && !('email' in receipt) && !('phone' in receipt) && !('address' in receipt) && !('postal' in receipt), 'Receipt must not persist checkout PII');
assert.deepEqual(core.normalizeReceipt({...receipt, total: 1, email: 'private@example.com', address: 'private'}, config), receipt, 'Stored totals must be recomputed and extra PII ignored');
assert.equal(core.createDemoReceipt(review, 'shipping', {...config, mode: 'live'}, Date.now(), 'x'), null);

assert.deepEqual(core.checkoutPayload(review, config), {items: review});
assert.equal(core.safeCheckoutEndpoint(config, 'https://cmcnosky.github.io/'), null);
assert.equal(core.safeCheckoutRedirect('javascript:alert(1)', config), null);
assert.equal(core.safeCheckoutRedirect('https://evil.example/checkout', config), null);
const provider = core.normalizeConfig({...commerce, mode: 'live', checkout: {endpoint: 'https://checkout.example/session', allowed_hosts: ['checkout.example']}});
assert.equal(core.safeCheckoutEndpoint(provider, 'https://cmcnosky.github.io/'), 'https://checkout.example/session');
assert.equal(core.safeCheckoutRedirect('https://checkout.example/pay/abc', provider), 'https://checkout.example/pay/abc');
assert.equal(core.safeCheckoutRedirect('http://checkout.example/pay/abc', provider), null);

const source = await readFile(path.join(root, 'docs/assets/store.js'), 'utf8');
assert(!source.includes('innerHTML'), 'Untrusted text must be rendered with textContent');
assert(!source.includes("credentials: 'include'"), 'Future checkout must not send ambient credentials');
assert(source.includes('Nothing was sent, reserved, or charged.'));
assert(source.includes('does not send or store these details'));
assert(source.includes('Lewisville pickup'));
assert(source.includes('Choose options'));
assert(source.includes('is already at the demo limit of'));
assert(source.includes("win.location.assign(config.shop_url)"), 'Starting another demo order must return to the shop');
assert(source.includes('Enter a value that is not only spaces.'), 'Required checkout text fields must reject whitespace-only values');
assert(source.includes('if (!focusTarget || focusTarget.disabled)'), 'Cart quantity rerenders must retain a usable keyboard focus target');

console.log(JSON.stringify({
  mode: config.mode,
  inventory_items: inventory.products.length,
  commerce_items: config.items.length,
  variants: config.items.reduce((sum, item) => sum + item.options.length, 0),
  multi_option_grinder: grinder.id,
  variant_images: grinder.options.map(option => option.image),
  cart_sanitization: 'passed',
  cart_line_order: 'preserved',
  strict_quantity_parsing: 'passed',
  rounding: 'passed',
  demo_checkout_totals: 'passed',
  pii_persistence: 'none',
  retired_products: 'excluded',
  regulated_items: 'excluded'
}, null, 2));
