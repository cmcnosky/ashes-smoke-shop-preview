(function (root, factory) {
  'use strict';
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (root) root.AshesStoreCore = core;
  if (root?.document) core.boot(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const PAGE = /^[a-z0-9][a-z0-9-]*\.html(?:[?#][^\s]*)?$/;
  const integer = value => {
    if (Number.isSafeInteger(value)) return value;
    if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value.trim())) return Number.NaN;
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
  };
  const safePage = (value, fallback) => typeof value === 'string' && PAGE.test(value) ? value : fallback;
  const money = (amount, currency) => new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(amount / 100);

  function normalizeConfig(input) {
    const raw = input && typeof input === 'object' ? input : {};
    const max = integer(raw.max_quantity_per_item);
    const items = [], seen = new Set();
    for (const source of Array.isArray(raw.items) ? raw.items : []) {
      if (!source || typeof source !== 'object' || !ID.test(source.id || '') || seen.has(source.id) || source.cart_enabled !== true) continue;
      if (typeof source.name !== 'string' || !source.name.trim() || source.name.trim().length > 120) continue;
      const options = [], optionIds = new Set();
      for (const option of Array.isArray(source.options) ? source.options : []) {
        if (!option || typeof option !== 'object' || !ID.test(option.id || '') || optionIds.has(option.id)) continue;
        if (typeof option.label !== 'string' || !option.label.trim() || option.label.trim().length > 120) continue;
        if (!Number.isSafeInteger(option.amount_minor) || option.amount_minor <= 0 || option.amount_minor > 10000000) continue;
        optionIds.add(option.id);
        options.push({id: option.id, label: option.label.trim(), amount_minor: option.amount_minor, image: typeof option.image === 'string' && /^assets\/[a-z0-9_./-]+\.(?:webp|jpg|jpeg|png)$/i.test(option.image) ? option.image : null});
      }
      if (!options.length) continue;
      seen.add(source.id);
      items.push({id: source.id, name: source.name.trim(), href: safePage(source.href, 'merchandise.html'),
        image: typeof source.image === 'string' && /^assets\/[a-z0-9_./-]+\.(?:webp|jpg|jpeg|png)$/i.test(source.image) ? source.image : null,
        availability_status: source.availability_status === 'verified' ? 'verified' : 'demo', options});
    }
    const checkout = raw.checkout && typeof raw.checkout === 'object' ? raw.checkout : {};
    const demo = raw.demo && typeof raw.demo === 'object' ? raw.demo : {};
    const shipping = integer(demo.shipping_minor);
    const hosts = Array.isArray(checkout.allowed_hosts)
      ? [...new Set(checkout.allowed_hosts.filter(value => typeof value === 'string' && /^[a-z0-9.-]+$/i.test(value)).map(value => value.toLowerCase()))] : [];
    return {
      version: 1,
      mode: raw.mode === 'demo' ? 'demo' : 'live',
      currency: typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'USD',
      storage_key: typeof raw.storage_key === 'string' && /^ashes\.[a-z0-9.:-]{1,80}$/i.test(raw.storage_key) ? raw.storage_key : 'ashes.store.cart.v2',
      max_quantity_per_item: Number.isSafeInteger(max) && max > 0 && max <= 25 ? max : 10,
      shop_url: safePage(raw.shop_url, 'merchandise.html'), cart_url: safePage(raw.cart_url, 'cart.html'),
      checkout_url: safePage(raw.checkout_url, 'checkout.html'),
      demo: {shipping_minor: Number.isSafeInteger(shipping) && shipping >= 0 && shipping <= 100000 ? shipping : 0,
        tax_rate: typeof demo.tax_rate === 'number' && Number.isFinite(demo.tax_rate) && demo.tax_rate >= 0 && demo.tax_rate <= .25 ? demo.tax_rate : 0,
        receipt_storage_key: typeof demo.receipt_storage_key === 'string' && /^ashes\.[a-z0-9.:-]{1,80}$/i.test(demo.receipt_storage_key) ? demo.receipt_storage_key : 'ashes.store.demo-receipt.v1'},
      checkout: {endpoint: typeof checkout.endpoint === 'string' && checkout.endpoint.trim() ? checkout.endpoint.trim() : null, allowed_hosts: hosts}, items
    };
  }

  const productMap = config => new Map(config.items.map(item => [item.id, item]));
  const getOption = (config, id, optionId) => productMap(config).get(id)?.options.find(option => option.id === optionId) || null;
  function sanitizeCart(input, config) {
    const products = productMap(config), merged = new Map();
    const source = Array.isArray(input) ? input : input && Array.isArray(input.items) ? input.items : [];
    for (const line of source) {
      if (!line || typeof line !== 'object' || typeof line.id !== 'string' || typeof line.option_id !== 'string') continue;
      if (!products.get(line.id)?.options.some(option => option.id === line.option_id)) continue;
      const quantity = integer(line.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1) continue;
      const key = `${line.id}:${line.option_id}`, old = merged.get(key);
      merged.set(key, {id: line.id, option_id: line.option_id,
        quantity: Math.min(config.max_quantity_per_item, (old?.quantity || 0) + quantity)});
    }
    return [...merged.values()];
  }
  function updateQuantity(cart, id, optionId, quantity, config) {
    const next = sanitizeCart(cart, config);
    if (!getOption(config, id, optionId)) return next;
    const index = next.findIndex(line => line.id === id && line.option_id === optionId);
    const parsed = integer(quantity);
    if (!Number.isSafeInteger(parsed)) return next;
    if (parsed < 1) {
      if (index >= 0) next.splice(index, 1);
      return next;
    }
    const line = {id, option_id: optionId, quantity: Math.min(config.max_quantity_per_item, parsed)};
    if (index >= 0) next[index] = line;
    else next.push(line);
    return sanitizeCart(next, config);
  }
  function addItem(cart, id, optionId, config) {
    const clean = sanitizeCart(cart, config);
    const line = clean.find(value => value.id === id && value.option_id === optionId);
    return updateQuantity(clean, id, optionId, (line?.quantity || 0) + 1, config);
  }
  const totalQuantity = cart => cart.reduce((sum, line) => sum + line.quantity, 0);
  function cartSubtotal(cart, config) {
    let sum = 0;
    for (const line of sanitizeCart(cart, config)) sum += getOption(config, line.id, line.option_id).amount_minor * line.quantity;
    return sum;
  }
  function calculateDemoTotals(cart, fulfillment, config) {
    const clean = sanitizeCart(cart, config);
    if (!clean.length || !['pickup-denton', 'pickup-lewisville', 'shipping'].includes(fulfillment)) return null;
    const subtotal = cartSubtotal(clean, config), shipping = fulfillment === 'shipping' ? config.demo.shipping_minor : 0;
    const tax = Math.round((subtotal + shipping) * config.demo.tax_rate);
    return {subtotal, shipping, tax, total: subtotal + shipping + tax};
  }
  function createDemoReceipt(cart, fulfillment, config, createdAt, token) {
    if (config.mode !== 'demo') return null;
    const items = sanitizeCart(cart, config), totals = calculateDemoTotals(items, fulfillment, config), date = new Date(createdAt || Date.now());
    if (!totals || Number.isNaN(date.getTime())) return null;
    const id = String(token || '').replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase() || 'PREVIEW';
    return {version: 1, demo: true, order_id: `DEMO-${id}`, created_at: date.toISOString(), fulfillment, items, ...totals};
  }
  function normalizeReceipt(value, config) {
    if (!value || value.demo !== true || !/^DEMO-[A-Z0-9]{1,8}$/.test(value.order_id || '')) return null;
    return createDemoReceipt(value.items, value.fulfillment, config, value.created_at, value.order_id.slice(5));
  }
  function safeCheckoutEndpoint(config, baseURL) {
    if (!config.checkout.endpoint || !config.checkout.allowed_hosts.length) return null;
    try { const url = new URL(config.checkout.endpoint, baseURL); return url.protocol === 'https:' && config.checkout.allowed_hosts.includes(url.hostname.toLowerCase()) ? url.href : null; }
    catch (_) { return null; }
  }
  const checkoutPayload = (cart, config) => ({items: sanitizeCart(cart, config).map(({id, option_id, quantity}) => ({id, option_id, quantity}))});
  function safeCheckoutRedirect(value, config) {
    if (typeof value !== 'string') return null;
    try { const url = new URL(value); return url.protocol === 'https:' && config.checkout.allowed_hosts.includes(url.hostname.toLowerCase()) ? url.href : null; }
    catch (_) { return null; }
  }

  function boot(win) {
    const doc = win.document, configNode = doc.getElementById('store-config');
    let config;
    try { config = normalizeConfig(JSON.parse(configNode?.textContent || '{}')); } catch (_) { config = normalizeConfig({}); }
    const products = productMap(config);
    let cart = [], storageWorks = true, fallbackStatus, statusTimer;
    const make = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
    const makeLink = (href, className, text) => { const node = make('a', className, text); node.href = href; return node; };
    const persist = () => { try { win.localStorage.setItem(config.storage_key, JSON.stringify({version: 1, items: cart})); } catch (_) { storageWorks = false; } };
    function load() { try { const raw = win.localStorage.getItem(config.storage_key); cart = sanitizeCart(raw ? JSON.parse(raw) : [], config); } catch (_) { cart = sanitizeCart(cart, config); storageWorks = false; } }
    function readReceipt() { try { const raw = win.sessionStorage.getItem(config.demo.receipt_storage_key); return raw ? normalizeReceipt(JSON.parse(raw), config) : null; } catch (_) { return null; } }
    const clearReceipt = () => { try { win.sessionStorage.removeItem(config.demo.receipt_storage_key); } catch (_) {} };
    function announce(message) {
      const nodes = [...doc.querySelectorAll('[data-cart-status]')];
      if (!nodes.length) { fallbackStatus ||= make('div', 'cart-toast'); fallbackStatus.setAttribute('role', 'status'); fallbackStatus.setAttribute('aria-live', 'polite'); doc.body.append(fallbackStatus); nodes.push(fallbackStatus); }
      nodes.forEach(node => { node.textContent = message; node.hidden = false; });
      win.clearTimeout(statusTimer);
      statusTimer = win.setTimeout(() => { if (fallbackStatus) fallbackStatus.hidden = true; }, 4000);
    }
    function renderProductControls() {
      doc.querySelectorAll('[data-product-options]').forEach(target => {
        const item = products.get(target.dataset.productOptions); target.replaceChildren(); if (!item) return;
        const label = make('label', 'product-option-label', 'Choose an option'), select = make('select', 'product-option-select');
        select.dataset.productOption = item.id; select.name = `option-${item.id}`;
        item.options.forEach(option => { const node = make('option', '', `${option.label} · ${money(option.amount_minor, config.currency)}`); node.value = option.id; select.append(node); });
        label.append(select); target.append(label);
      });
      doc.querySelectorAll('[data-product-price]').forEach(target => {
        const item = products.get(target.dataset.productPrice); if (!item) return;
        const amounts = item.options.map(option => option.amount_minor), low = Math.min(...amounts), high = Math.max(...amounts);
        target.textContent = `${low === high ? '' : 'From '}${money(low, config.currency)}`;
      });
    }
    function selectedOption(button, item) {
      const scope = button.closest('[data-product-purchase], .catalog-card, .catalog-detail-copy') || doc;
      const select = [...scope.querySelectorAll('[data-product-option]')].find(node => node.dataset.productOption === item.id);
      return item.options.find(option => option.id === select?.value) || item.options[0];
    }
    function sync() {
      const count = totalQuantity(cart);
      doc.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(count); node.setAttribute('aria-label', `${count} ${count === 1 ? 'item' : 'items'} in cart`); });
      doc.querySelectorAll('[data-cart-add]').forEach(button => {
        const item = products.get(button.dataset.cartAdd), scope = button.closest('[data-product-purchase], .catalog-card, .catalog-detail-copy') || doc;
        const hasSelector = item && [...scope.querySelectorAll('[data-product-option]')].some(node => node.dataset.productOption === item.id);
        const choose = Boolean(item && item.options.length > 1 && !hasSelector);
        button.hidden = false; button.disabled = !item; button.setAttribute('aria-disabled', String(!item));
        button.dataset.cartChoose = choose ? '1' : '0';
        if (item) { button.textContent = choose ? 'Choose options →' : 'Add to cart'; button.setAttribute('aria-label', choose ? `Choose options for ${item.name}` : `Add ${item.name} to cart`); }
      });
    }
    function lineNode(line, controls) {
      const item = products.get(line.id), option = getOption(config, line.id, line.option_id), row = make('li', 'cart-line'), copy = make('div', 'cart-line-copy');
      if (option.image || item.image) { const photo = make('img', 'cart-line-image'); photo.src=option.image || item.image; photo.alt=item.name; photo.width=75; photo.height=75; row.append(photo); }
      copy.append(makeLink(item.href, 'cart-line-name', item.name), make('span', 'cart-line-option', option.label),
        make('span', 'cart-line-price', `${money(option.amount_minor, config.currency)}`), make('span', 'cart-line-quantity', `Quantity ${line.quantity}`)); row.append(copy);
      if (controls) {
        const actions = make('div', 'cart-line-actions');
        for (const [action, text, label] of [['decrease', '−', 'Decrease'], ['increase', '+', 'Increase']]) {
          const button = make('button', 'cart-quantity-button', text); button.type = 'button'; button.dataset.cartAction = action; button.dataset.cartId = item.id; button.dataset.cartOption = option.id;
          button.setAttribute('aria-label', `${label} ${item.name}, ${option.label}, quantity`); if (action === 'increase') button.disabled = line.quantity >= config.max_quantity_per_item; actions.append(button);
          if (action === 'decrease') { const value = make('span', 'cart-quantity-value', String(line.quantity)); value.setAttribute('aria-hidden', 'true'); actions.append(value); }
        }
        const remove = make('button', 'cart-remove', 'Remove'); remove.type = 'button'; remove.dataset.cartAction = 'remove'; remove.dataset.cartId = item.id; remove.dataset.cartOption = option.id; actions.append(remove); row.append(actions);
      }
      return row;
    }
    function totalsNode(totals, fulfillment) {
      const fulfillmentLabel = fulfillment === 'shipping' ? 'Sample shipping' : fulfillment === 'pickup-lewisville' ? 'Lewisville pickup' : 'Denton pickup';
      const panel = make('section', 'cart-summary'), labels = [['Sample subtotal', totals.subtotal], [fulfillmentLabel, totals.shipping],
        [`Sample estimated tax (${(config.demo.tax_rate * 100).toFixed(2).replace(/\.00$/, '')}%)`, totals.tax], ['Demo total', totals.total]];
      labels.forEach(([label, amount], index) => { const row = make('p', index === 3 ? 'cart-total-row cart-grand-total' : 'cart-total-row'); row.append(make(index === 3 ? 'strong' : 'span', '', label), make(index === 3 ? 'strong' : 'span', '', money(amount, config.currency))); panel.append(row); });
      return panel;
    }
    function emptyNode(text) { const box = make('section', 'cart-empty'); box.append(make('h2', '', text), makeLink(config.shop_url, 'button dark', 'Shop accessories →')); return box; }
    function renderCart() {
      const rootNode = doc.querySelector('[data-cart-root]'); if (!rootNode) return; rootNode.replaceChildren(); if (!cart.length) { rootNode.append(emptyNode('Your cart is empty.')); return; }
      const layout = make('div', 'cart-layout'), list = make('ul', 'cart-lines'), aside = make('section', 'cart-summary'); cart.forEach(line => list.append(lineNode(line, true)));
      const row = make('p', 'cart-total-row'); row.append(make('strong', '', 'Sample subtotal'), make('strong', '', money(cartSubtotal(cart, config), config.currency))); aside.append(row,
        make('p', 'cart-price-note', 'Shipping and sample estimated tax are calculated in the checkout preview. No real order or payment will be made.'),
        makeLink(config.checkout_url, 'button dark cart-review-link', 'Review demo checkout →'),
        makeLink(config.shop_url, 'text-link cart-continue-link', '← Continue shopping')); layout.append(list, aside); rootNode.append(layout);
    }
    function field(labelText, name, type, autocomplete, required = true) { const label = make('label', 'checkout-field', labelText), input = make('input'); input.name = name; input.type = type; input.autocomplete = config.mode === 'demo' ? 'off' : autocomplete; input.required = required; label.append(input); return {label, input}; }
    function renderReceipt(rootNode, receipt) {
      rootNode.replaceChildren(); const box = make('section', 'demo-confirmation'); box.append(make('span', 'eyebrow', 'STORE PREVIEW COMPLETE'), make('h2', '', 'Demo order complete.'),
        make('p', '', 'Nothing was sent, reserved, or charged. This confirmation exists only in this browser tab.'), make('p', 'demo-order-id', `Preview reference ${receipt.order_id}`));
      const list = make('ul', 'cart-lines checkout-lines'); receipt.items.forEach(line => list.append(lineNode(line, false))); box.append(list, totalsNode(receipt, receipt.fulfillment));
      const actions = make('div', 'demo-confirmation-actions'); actions.append(makeLink(config.shop_url, 'button dark', 'Keep browsing →')); const restart = make('button', 'button outline', 'Start another demo order'); restart.type = 'button'; restart.dataset.demoRestart = '1'; actions.append(restart); box.append(actions); rootNode.append(box);
    }
    function renderCheckout() {
      const rootNode = doc.querySelector('[data-checkout-root]'); if (!rootNode) return; const receipt = readReceipt(); if (receipt) { renderReceipt(rootNode, receipt); return; }
      rootNode.replaceChildren(); if (!cart.length) { rootNode.append(emptyNode('There’s nothing to review yet.')); return; }
      const form = make('form', 'checkout-form'), layout = make('div', 'checkout-layout'), details = make('div', 'checkout-details'); form.dataset.demoCheckout = '1'; form.autocomplete = 'off';
      const contact = make('section', 'checkout-panel'); contact.append(make('h2', '', 'Contact'), make('p', 'checkout-privacy-note', 'This demo does not send or store these details. Your browser may still offer its own autofill.'));
      const contactGrid = make('div', 'checkout-fields'), name = field('Full name', 'name', 'text', 'name'), email = field('Email', 'email', 'email', 'email'), phone = field('Phone', 'phone', 'tel', 'tel', false); name.input.maxLength = 120; email.input.maxLength = 254; phone.input.maxLength = 30; contactGrid.append(name.label, email.label, phone.label); contact.append(contactGrid);
      const sample = make('button', 'plain-button checkout-sample-button', 'Use fictional sample details'); sample.type = 'button'; contact.append(sample);
      const delivery = make('section', 'checkout-panel'); delivery.append(make('h2', '', 'Delivery method')); const choices = make('fieldset', 'fulfillment-options'), legend = make('legend', 'visually-hidden', 'Choose delivery method'); choices.append(legend);
      [['pickup-denton', 'Pick up in Denton'], ['pickup-lewisville', 'Pick up in Lewisville'], ['shipping', `Sample shipping · ${money(config.demo.shipping_minor, config.currency)}`]].forEach(([value, text], index) => {
        const label = make('label', 'fulfillment-option'), input = make('input'); input.type = 'radio'; input.name = 'fulfillment'; input.value = value; input.required = true; input.checked = index === 0; label.append(input, make('span', '', text)); choices.append(label);
      }); delivery.append(choices);
      const address = make('div', 'shipping-address'); address.hidden = true; address.append(make('h3', '', 'Shipping address')); const addressGrid = make('div', 'checkout-fields'), street = field('Street address', 'address', 'text', 'street-address', false), city = field('City', 'city', 'text', 'address-level2', false), state = field('State', 'state', 'text', 'address-level1', false), postal = field('ZIP code', 'postal', 'text', 'postal-code', false); postal.input.inputMode = 'numeric'; postal.input.pattern = '[0-9]{5}(?:-[0-9]{4})?';
      street.input.maxLength = 160; city.input.maxLength = 80; state.input.maxLength = 40; postal.input.maxLength = 10;
      const addressInputs = [street.input, city.input, state.input, postal.input]; addressInputs.forEach(input => input.disabled = true); addressGrid.append(street.label, city.label, state.label, postal.label); address.append(addressGrid); delivery.append(address); details.append(contact, delivery);
      const meaningfulInputs = [name.input, street.input, city.input, state.input];
      meaningfulInputs.forEach(input => input.addEventListener('input', () => input.setCustomValidity('')));
      sample.addEventListener('click', () => { name.input.value = 'Alex Example'; email.input.value = 'alex@example.com'; phone.input.value = '940-555-0100'; const shippingChoice = form.querySelector('input[value=shipping]'); shippingChoice.checked = true; street.input.value = '123 Sample Street'; city.input.value = 'Denton'; state.input.value = 'TX'; postal.input.value = '76201'; meaningfulInputs.forEach(input => input.setCustomValidity('')); updateDelivery(); announce('Fictional sample details filled in.'); });
      const review = make('aside', 'checkout-payment'); review.append(make('span', 'eyebrow', 'DEMO ORDER'), make('h2', '', 'Order review')); const list = make('ul', 'cart-lines checkout-lines'); cart.forEach(line => list.append(lineNode(line, false))); review.append(list); const totalsSlot = make('div', 'checkout-totals-slot'); review.append(totalsSlot); const submit = make('button', 'button dark checkout-button', 'Place demo order →'); submit.type = 'submit'; review.append(submit, make('p', 'checkout-demo-note', 'Preview only. No payment information is collected, and nothing is sent to Ashes.'), makeLink(config.cart_url, 'text-link', '← Edit cart')); layout.append(details, review); form.append(layout); rootNode.append(form);
      function updateDelivery() { const method = new FormData(form).get('fulfillment') || 'pickup-denton', shipping = method === 'shipping'; address.hidden = !shipping; addressInputs.forEach(input => { input.disabled = !shipping; input.required = shipping; }); totalsSlot.replaceChildren(totalsNode(calculateDemoTotals(cart, method, config), method)); }
      form.querySelectorAll('input[name=fulfillment]').forEach(input => input.addEventListener('change', updateDelivery)); updateDelivery();
      form.addEventListener('submit', event => { event.preventDefault(); meaningfulInputs.forEach(input => input.setCustomValidity(!input.disabled && input.required && !input.value.trim() ? 'Enter a value that is not only spaces.' : '')); if (!form.reportValidity()) return; const method = new FormData(form).get('fulfillment'), bytes = new Uint8Array(4); if (win.crypto?.getRandomValues) win.crypto.getRandomValues(bytes); else bytes.set([Date.now() & 255, Date.now() >> 8 & 255, 31, 79]); const token = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase(), receipt = createDemoReceipt(cart, method, config, Date.now(), token); if (!receipt) { announce('The demo order could not be completed. Your cart is still saved.'); return; } try { win.sessionStorage.setItem(config.demo.receipt_storage_key, JSON.stringify(receipt)); } catch (_) {} cart = []; persist(); sync(); renderReceipt(rootNode, receipt); announce('Demo order complete. Nothing was sent or charged.'); rootNode.scrollIntoView({behavior: 'smooth', block: 'start'}); });
    }
    function render() { sync(); renderCart(); renderCheckout(); }
    doc.addEventListener('change', event => { const select = event.target.closest('[data-product-option]'); if (!select) return; const item = products.get(select.dataset.productOption), option = item?.options.find(value => value.id === select.value), scope = select.closest('[data-product-purchase], .catalog-card, .catalog-detail-copy') || doc, price = [...scope.querySelectorAll('[data-product-price]')].find(node => node.dataset.productPrice === item?.id); if (price && option) price.textContent = `${money(option.amount_minor, config.currency)}`; const photo=doc.querySelector(`[data-detail-image="${item?.id}"]`); if(photo && option?.image) { photo.src=option.image; photo.alt=`${item.name}, ${option.label}`; } });
    doc.addEventListener('click', event => {
      const restart = event.target.closest('[data-demo-restart]'); if (restart) { clearReceipt(); win.location.assign(config.shop_url); return; }
      const add = event.target.closest('[data-cart-add]'); if (add) { const item = products.get(add.dataset.cartAdd); if (!item) return; if (add.dataset.cartChoose === '1') { win.location.assign(item.href); return; } const option = selectedOption(add, item), existing = cart.find(line => line.id === item.id && line.option_id === option.id); if (existing?.quantity >= config.max_quantity_per_item) { announce(`${item.name}, ${option.label}, is already at the demo limit of ${config.max_quantity_per_item}.`); return; } cart = addItem(cart, item.id, option.id, config); persist(); clearReceipt(); render(); announce(`${item.name}, ${option.label}, added to your cart.${storageWorks ? '' : ' Browser storage is unavailable, so this cart lasts only on this page.'}`); return; }
      const button = event.target.closest('[data-cart-action]'); if (!button) return; const item = products.get(button.dataset.cartId), option = getOption(config, button.dataset.cartId, button.dataset.cartOption), line = cart.find(value => value.id === item?.id && value.option_id === option?.id); if (!line) return;
      const actionName = button.dataset.cartAction;
      if (actionName === 'increase') cart = updateQuantity(cart, item.id, option.id, line.quantity + 1, config); if (actionName === 'decrease') cart = updateQuantity(cart, item.id, option.id, line.quantity - 1, config); if (actionName === 'remove') cart = updateQuantity(cart, item.id, option.id, 0, config); persist(); clearReceipt(); render();
      const stillPresent = cart.some(value => value.id === item.id && value.option_id === option.id);
      if (stillPresent) {
        const base = `[data-cart-id="${item.id}"][data-cart-option="${option.id}"]`;
        let focusTarget = doc.querySelector(`[data-cart-action="${actionName}"]${base}`);
        if (!focusTarget || focusTarget.disabled) focusTarget = doc.querySelector(`[data-cart-action="decrease"]${base}`);
        focusTarget?.focus();
      }
      else { const cartRoot = doc.querySelector('[data-cart-root]'); if (cartRoot) { cartRoot.tabIndex = -1; cartRoot.focus(); } }
      announce(actionName === 'remove' || !stillPresent ? `${item.name}, ${option.label}, removed from your cart.` : `${item.name}, ${option.label}, quantity updated.`);
    });
    win.addEventListener('storage', event => { if (event.key === config.storage_key) { load(); render(); } });
    win.addEventListener('pageshow', () => { load(); render(); });
    renderProductControls(); load(); render();
  }
  return {normalizeConfig, sanitizeCart, addItem, updateQuantity, totalQuantity, cartSubtotal, calculateDemoTotals, createDemoReceipt, normalizeReceipt, safeCheckoutEndpoint, checkoutPayload, safeCheckoutRedirect, boot};
});
