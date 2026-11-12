import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = require(path.join(root, 'docs/assets/store.js'));
const commerce = JSON.parse(await readFile(path.join(root, 'commerce.json'), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, 'catalog.json'), 'utf8'));
const config = core.normalizeConfig(commerce);
const ids = new Set(['ashes-logo-apparel', 'ashes-beanies', 'ashes-event-apparel', 'cookies-backpacks-product-family', 'wildberry-incense-holders']);
const forbidden = /(?:thca|delta[- ]?8|delta[- ]?9|thc|cbd|cannabis|hemp|nicotine|tobacco|vape|kratom|gift[ -]?card)/i;
const catalogIds = new Set(catalog.products.map(item => item.id));

assert.equal(config.mode, 'demo');
assert.equal(config.items.length, 5);
assert.deepEqual(new Set(config.items.map(item => item.id)), ids);
assert.equal(config.checkout.endpoint, null);
assert.deepEqual(config.checkout.allowed_hosts, []);
for (const item of config.items) {
  assert(ids.has(item.id));
  assert(catalogIds.has(item.id));
  assert(!forbidden.test(`${item.id} ${item.name}`));
  assert.equal(item.availability_status, 'demo');
  assert(item.options.length > 0);
  for (const option of item.options) {
    assert.match(option.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof option.label, 'string');
    assert(Number.isSafeInteger(option.amount_minor) && option.amount_minor > 0);
  }
}

let cart = core.sanitizeCart({items: [
  {id: 'ashes-logo-apparel', option_id: 'tee-small', quantity: 2},
  {id: 'ashes-logo-apparel', option_id: 'tee-small', quantity: 50},
  {id: 'ashes-logo-apparel', option_id: 'not-an-option', quantity: 1},
  {id: 'dynavap-devices', option_id: 'x', quantity: 1},
  {id: '<img src=x onerror=alert(1)>', option_id: 'x', quantity: 1},
  {id: 'ashes-beanies', option_id: 'black', quantity: Number.NaN}
]}, config);
assert.deepEqual(cart, [{id: 'ashes-logo-apparel', option_id: 'tee-small', quantity: config.max_quantity_per_item}]);

cart = core.addItem([], 'ashes-logo-apparel', 'tee-small', config);
assert.deepEqual(cart, [{id: 'ashes-logo-apparel', option_id: 'tee-small', quantity: 1}]);
cart = core.addItem(cart, 'ashes-logo-apparel', 'hoodie-medium', config);
assert.equal(cart.length, 2, 'Different variants must remain separate lines');
assert.deepEqual(core.addItem([], 'dynavap-devices', 'x', config), [], 'Non-merchandise cannot enter cart');
assert.deepEqual(core.addItem([], 'ashes-logo-apparel', 'missing', config), [], 'Unknown variants cannot enter cart');
assert.deepEqual(core.updateQuantity(cart, 'ashes-logo-apparel', 'tee-small', 0, config), [{id: 'ashes-logo-apparel', option_id: 'hoodie-medium', quantity: 1}]);

const review = [{id: 'ashes-logo-apparel', option_id: 'tee-small', quantity: 2}, {id: 'ashes-event-apparel', option_id: 'can-cooler', quantity: 1}];
assert.equal(core.totalQuantity(review), 3);
assert.equal(core.cartSubtotal(review, config), 5500);
assert.deepEqual(core.calculateDemoTotals(review, 'pickup-denton', config), {subtotal: 5500, shipping: 0, tax: 454, total: 5954});
assert.deepEqual(core.calculateDemoTotals(review, 'shipping', config), {subtotal: 5500, shipping: 500, tax: 495, total: 6495});
assert.equal(core.calculateDemoTotals(review, 'invalid', config), null);

const receipt = core.createDemoReceipt(review, 'shipping', config, '2026-11-12T12:00:00Z', 'abc-123');
assert.equal(receipt.order_id, 'DEMO-ABC123');
assert.equal(receipt.total, 6495);
assert(!('name' in receipt) && !('email' in receipt) && !('address' in receipt), 'Receipt must not persist checkout PII');
assert.deepEqual(core.normalizeReceipt({...receipt, total: 1, email: 'private@example.com'}, config), receipt, 'Stored totals must be recomputed; extra PII ignored');
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

console.log(JSON.stringify({mode: config.mode, ordinary_merchandise_items: config.items.length,
  variants: config.items.reduce((sum, item) => sum + item.options.length, 0), cart_sanitization: 'passed',
  demo_checkout_totals: 'passed', pii_persistence: 'none', regulated_items: 'excluded'}, null, 2));
