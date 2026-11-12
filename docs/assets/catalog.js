(() => {
  'use strict';
  const storageKey = 'ashes.catalog.saved.v1';
  let saved = new Set();
  let storageWorks = true;
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(value)) saved = new Set(value.filter(v => typeof v === 'string'));
  } catch (_) { storageWorks = false; }
  const notice = document.createElement('div');
  notice.className = 'catalog-toast';
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  document.body.append(notice);
  let toastTimer;
  function announce(message) {
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { notice.hidden = true; }, 3500);
  }
  function syncSaved() {
    document.querySelectorAll('[data-save]').forEach(button => {
      const active = saved.has(button.dataset.save);
      button.hidden = false;
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `${active ? 'Remove' : 'Save'} ${button.dataset.saveName}${active ? ' from saved products' : ''}`);
      button.querySelector('[data-save-label]').textContent = active ? 'Saved' : 'Save';
      button.querySelector('[aria-hidden]').textContent = active ? '♥' : '♡';
    });
    document.querySelectorAll('[data-saved-link]').forEach(link => { link.hidden = false; });
    document.querySelectorAll('[data-saved-count]').forEach(el => { el.textContent = saved.size; });
  }
  document.querySelectorAll('[data-save]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.save;
      const added = !saved.has(id);
      if (added) saved.add(id); else saved.delete(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...saved])); }
      catch (_) { storageWorks = false; }
      syncSaved();
      if (directory) applyFilters(false);
      announce(`${added ? 'Saved' : 'Removed'} ${button.dataset.saveName}.${storageWorks ? '' : ' Browser storage is unavailable; this change lasts only on this page.'}`);
    });
  });
  syncSaved();
  function refreshSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
      saved = new Set(Array.isArray(value) ? value.filter(v => typeof v === 'string') : []);
    } catch (_) { storageWorks = false; }
    syncSaved();
  }
  window.addEventListener('pageshow', refreshSaved);
  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    refreshSaved();
    if (directory) applyFilters(false);
  });

  const directory = document.querySelector('[data-catalog-directory]');
  if (!directory) return;
  const brandView = directory.dataset.catalogDirectory === 'brands';
  const noun = brandView ? 'brands' : 'products';
  const form = directory.querySelector('[data-catalog-form]');
  const grid = directory.querySelector('[data-catalog-grid]');
  const cards = [...grid.querySelectorAll('[data-catalog-item]')];
  const count = directory.querySelector('[data-result-count]');
  const activeView = directory.querySelector('[data-active-view]');
  const empty = directory.querySelector('[data-catalog-empty]');
  const savedNote = directory.querySelector('[data-saved-note]');
  const keys = ['q', 'category', 'brand', 'collection', 'location', 'sort'];
  const defaultSort = brandView ? 'az' : 'featured';
  let savedOnly = false;
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const priorities = {current_published: 0, manufacturer_listed: 1, dated_feature: 2, undated_profile: 3, undated_photo: 4, historical: 5, promotional_only: 6};
  const get = name => form.elements.namedItem(name);
  const tokensContain = (value, token) => !token || value.split(' ').includes(token);

  function restoreFromURL() {
    const params = new URLSearchParams(location.search);
    for (const key of keys) {
      const input = get(key);
      if (!input) continue;
      const value = params.get(key) || (key === 'sort' ? defaultSort : key === 'collection' ? 'browse' : '');
      if (input.tagName === 'SELECT') {
        input.value = [...input.options].some(o => o.value === value) ? value : (key === 'sort' ? defaultSort : key === 'collection' ? 'browse' : '');
      } else input.value = value.slice(0, 160);
    }
    savedOnly = !brandView && params.get('saved') === '1';
    applyFilters(false);
  }

  function updateURL() {
    const params = new URLSearchParams();
    for (const key of keys) {
      const value = get(key)?.value.trim();
      if (value && !(key === 'sort' && value === defaultSort) && !(key === 'collection' && value === 'browse')) params.set(key, value);
    }
    if (savedOnly) params.set('saved', '1');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
    directory.querySelector('[data-copy-status]').textContent = '';
    directory.querySelector('.share-fallback').hidden = true;
  }

  function applyFilters(writeURL = true) {
    const query = normalize(get('q').value.trim());
    const words = query.split(/\s+/).filter(Boolean);
    const category = get('category').value;
    const brand = get('brand')?.value || '';
    const collection = get('collection').value;
    const store = get('location').value;
    const sort = get('sort').value;
    const sorted = [...cards].sort((a, b) => {
      const names = a.dataset.name.localeCompare(b.dataset.name, 'en', {sensitivity: 'base'});
      if (sort === 'za') return -names;
      if (sort === 'featured') return (priorities[a.dataset.status] - priorities[b.dataset.status]) || names;
      return names;
    });
    let visible = 0;
    sorted.forEach(card => {
      const match = words.every(word => normalize(card.dataset.search).includes(word)) &&
        tokensContain(card.dataset.category, category) && (!brand || card.dataset.brand === brand) &&
        (savedOnly || collection === 'all' || card.dataset.collection === collection) && tokensContain(card.dataset.location, store) &&
        (!savedOnly || saved.has(card.dataset.id));
      card.hidden = !match;
      if (match) visible++;
      grid.append(card);
    });
    count.textContent = `${visible} ${visible === 1 ? noun.slice(0, -1) : noun}`;
    const labels = [];
    if (savedOnly) labels.push('Saved products');
    if (query) labels.push(`“${get('q').value.trim()}”`);
    for (const key of ['category', 'brand', 'collection', 'location']) {
      const control = get(key);
      if (control?.value && !(key === 'collection' && control.value === 'browse')) labels.push(control.selectedOptions[0].textContent);
    }
    activeView.textContent = labels.length ? labels.join(' · ') : 'Browse products';
    empty.hidden = visible !== 0;
    grid.hidden = visible === 0;
    savedNote.hidden = !savedOnly;
    if (writeURL) updateURL();
  }

  form.hidden = false;
  form.addEventListener('submit', event => { event.preventDefault(); applyFilters(); });
  get('q').addEventListener('input', () => applyFilters());
  form.querySelectorAll('select').forEach(select => select.addEventListener('change', () => applyFilters()));
  function reset() {
    form.reset();
    savedOnly = false;
    applyFilters();
  }
  form.addEventListener('reset', () => {
    savedOnly = false;
    queueMicrotask(() => applyFilters());
  });
  directory.querySelector('[data-empty-reset]').addEventListener('click', reset);
  directory.querySelector('[data-copy-link]').addEventListener('click', async () => {
    const message = directory.querySelector('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(location.href);
      message.textContent = 'Link copied.';
    } catch (_) {
      const fallback = directory.querySelector('.share-fallback');
      const input = directory.querySelector('[data-share-url]');
      fallback.hidden = false;
      input.value = location.href;
      input.focus();
      input.select();
      message.textContent = 'Copy the selected link below.';
    }
  });
  // Earlier category links retain their full category-guide meaning.
  const legacyAnchors = ['hemp-cbd', 'vapes', 'glass', 'papers-tobacco', 'accessories', 'hookah', 'kratom', 'scents-merch'];
  const legacyNames = {'Hemp & CBD': 'hemp-cbd', 'Glass': 'glass', 'Accessories': 'accessories', 'Lifestyle': 'scents-merch', 'Other categories': 'kratom', 'Smoke shop': 'papers-tobacco'};
  const legacyTarget = legacyAnchors.includes(location.hash.slice(1)) ? location.hash.slice(1) : legacyNames[new URLSearchParams(location.search).get('category')];
  if (legacyTarget) { location.replace('categories.html#' + legacyTarget); return; }
  window.addEventListener('popstate', restoreFromURL);
  window.addEventListener('pageshow', () => { syncSaved(); restoreFromURL(); });
  restoreFromURL();
})();
