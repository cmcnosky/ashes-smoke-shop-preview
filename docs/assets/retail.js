/* Search and filters for the local-inventory storefront demo. */
(() => {
  'use strict';

  const pageParameters = new URLSearchParams(location.search);
  const returnLink = document.querySelector('[data-retail-return]');
  const requestedReturn = pageParameters.get('from');
  const safeCatalogReturn = /^(?:explore|merchandise)\.html(?:\?[^#]*)?(?:#shop-products)?$/;

  if (returnLink && requestedReturn && safeCatalogReturn.test(requestedReturn)) {
    returnLink.href = requestedReturn;
  }

  const shop = document.querySelector('.retail-shop');
  if (!shop) return;

  const cards = [...shop.querySelectorAll('[data-retail-item]')];
  const grid = shop.querySelector('.retail-grid');
  const search = shop.querySelector('[data-retail-search]');
  const category = shop.querySelector('[data-retail-category-select]');
  const brand = shop.querySelector('[data-retail-brand]');
  const price = shop.querySelector('[data-retail-price]');
  const sort = shop.querySelector('[data-retail-sort]');
  const count = shop.querySelector('[data-retail-count]');
  const empty = shop.querySelector('.retail-empty');
  const applied = shop.querySelector('[data-retail-applied]');
  const appliedItems = shop.querySelector('[data-retail-applied-items]');
  const filterLabel = shop.querySelector('[data-retail-filter-label]');
  const filterToggle = shop.querySelector('.retail-filter-toggle');
  const mobileLayout = matchMedia('(max-width: 800px)');

  const priceNames = {
    'under-10': 'Under $10',
    '10-25': '$10–$24.99',
    '25-50': '$25–$49.99',
    'over-50': '$50 and up',
  };

  function normalize(value) {
    return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }

  function selectKnown(node, value) {
    if ([...node.options].some((option) => option.value === value)) node.value = value;
  }

  function loadControlsFromURL() {
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') || '';
    category.value = 'all';
    brand.value = 'all';
    price.value = 'all';
    sort.value = 'featured';
    selectKnown(category, params.get('category'));
    selectKnown(brand, params.get('brand'));
    selectKnown(price, params.get('price'));
    selectKnown(sort, params.get('sort'));
  }

  function catalogParameters() {
    const params = new URLSearchParams();
    if (search.value.trim()) params.set('q', search.value.trim());
    if (category.value !== 'all') params.set('category', category.value);
    if (brand.value !== 'all') params.set('brand', brand.value);
    if (price.value !== 'all') params.set('price', price.value);
    if (sort.value !== 'featured') params.set('sort', sort.value);
    return params;
  }

  function writeURL(mode) {
    if (!mode) return;
    const params = catalogParameters();
    const query = params.size ? `?${params}` : '';
    const nextURL = `${location.pathname}${query}${location.hash}`;
    const currentURL = `${location.pathname}${location.search}${location.hash}`;
    if (nextURL !== currentURL) history[`${mode}State`](null, '', nextURL);
  }

  function categoryName() {
    const text = category.selectedOptions[0]?.textContent || category.value;
    return text.replace(/\s+\(\d+\)$/, '');
  }

  function activeFilters() {
    const filters = [];
    if (search.value.trim()) filters.push({ key: 'q', label: `Search: “${search.value.trim()}”` });
    if (category.value !== 'all') filters.push({ key: 'category', label: categoryName() });
    if (brand.value !== 'all') filters.push({ key: 'brand', label: brand.value });
    if (price.value !== 'all') filters.push({ key: 'price', label: priceNames[price.value] });
    return filters;
  }

  function removeFilter(key) {
    if (key === 'q') search.value = '';
    if (key === 'category') category.value = 'all';
    if (key === 'brand') brand.value = 'all';
    if (key === 'price') price.value = 'all';
    refresh('push');
  }

  function renderActiveFilters() {
    const filters = activeFilters();
    applied.hidden = filters.length === 0;
    appliedItems.replaceChildren();
    filterLabel.textContent = filters.length ? `Filters (${filters.length})` : 'Filters';

    for (const filter of filters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.retailRemove = filter.key;
      button.setAttribute('aria-label', `Remove filter ${filter.label}`);
      button.append(filter.label, ' ×');
      appliedItems.append(button);
    }
  }

  function updateProductReturnLinks() {
    const page = location.pathname.split('/').pop() || 'explore.html';
    const returnPath = `${page}${location.search}#shop-products`;

    for (const card of cards) {
      for (const link of card.querySelectorAll('[data-retail-product-link]')) {
        const original = link.dataset.retailProductBase || link.getAttribute('href');
        link.dataset.retailProductBase = original;
        const productURL = new URL(original, location.href);
        productURL.searchParams.set('from', returnPath);
        link.href = `${productURL.pathname.split('/').pop()}${productURL.search}`;
      }
    }
  }

  function refresh(historyMode = 'replace') {
    const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let visibleCount = 0;

    for (const card of cards) {
      const data = card.dataset;
      const amount = Number(data.price);
      const priceMatches = price.value === 'all'
        || (price.value === 'under-10' && amount < 1000)
        || (price.value === '10-25' && amount >= 1000 && amount < 2500)
        || (price.value === '25-50' && amount >= 2500 && amount < 5000)
        || (price.value === 'over-50' && amount >= 5000);
      const visible = words.every((word) => normalize(data.search).includes(word))
        && (category.value === 'all' || category.value === data.category)
        && (brand.value === 'all' || brand.value === data.brand)
        && priceMatches;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    const ordered = [...cards];
    if (sort.value === 'price-low') ordered.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
    if (sort.value === 'price-high') ordered.sort((a, b) => Number(b.dataset.price) - Number(a.dataset.price));
    if (sort.value === 'name') ordered.sort((a, b) => a.dataset.name.localeCompare(b.dataset.name));
    for (const card of ordered) grid.append(card);

    const filteredSuffix = visibleCount !== cards.length ? ` of ${cards.length}` : '';
    count.textContent = `${visibleCount} ${visibleCount === 1 ? 'product' : 'products'}${filteredSuffix}`;
    empty.hidden = visibleCount !== 0;
    for (const button of shop.querySelectorAll('[data-retail-category]')) {
      button.setAttribute('aria-pressed', String(button.dataset.retailCategory === category.value));
    }

    renderActiveFilters();
    writeURL(historyMode);
    updateProductReturnLinks();
  }

  function closeMobileFilters() {
    if (!mobileLayout.matches) return;
    filterToggle.setAttribute('aria-expanded', 'false');
    const focusWasInFilters = document.activeElement?.closest('#shop-filters');
    shop.classList.remove('filters-open');
    if (focusWasInFilters) filterToggle.focus();
  }

  function resetCatalog() {
    search.value = '';
    category.value = 'all';
    brand.value = 'all';
    price.value = 'all';
    sort.value = 'featured';
    closeMobileFilters();
    refresh('push');
  }

  loadControlsFromURL();
  refresh(false);

  search.addEventListener('input', () => refresh('replace'));
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && search.value) {
      search.value = '';
      refresh('push');
    }
  });

  for (const node of [category, brand, price]) {
    node.addEventListener('change', () => {
      closeMobileFilters();
      refresh('push');
    });
  }
  sort.addEventListener('change', () => refresh('push'));

  for (const button of shop.querySelectorAll('[data-retail-category]')) {
    button.addEventListener('click', () => {
      category.value = button.dataset.retailCategory;
      refresh('push');
    });
  }

  shop.addEventListener('click', (event) => {
    const resetButton = event.target.closest('[data-retail-reset]');
    if (resetButton) {
      resetCatalog();
      if (!resetButton.offsetWidth) search.focus();
    }
    const removeButton = event.target.closest('[data-retail-remove]');
    if (removeButton) {
      removeFilter(removeButton.dataset.retailRemove);
      (appliedItems.querySelector('button') || search).focus();
    }
  });

  filterToggle.addEventListener('click', () => {
    const open = filterToggle.getAttribute('aria-expanded') !== 'true';
    filterToggle.setAttribute('aria-expanded', String(open));
    shop.classList.toggle('filters-open', open);
  });

  addEventListener('popstate', () => {
    loadControlsFromURL();
    refresh(false);
  });
})();
