/* Search and filters for the local-inventory storefront demo. */
(() => {
 'use strict';
 const shop=document.querySelector('.retail-shop'); if(!shop)return;
 const cards=[...shop.querySelectorAll('[data-retail-item]')],grid=shop.querySelector('.retail-grid'),search=shop.querySelector('[data-retail-search]'),category=shop.querySelector('[data-retail-category-select]'),brand=shop.querySelector('[data-retail-brand]'),price=shop.querySelector('[data-retail-price]'),sort=shop.querySelector('[data-retail-sort]');
 const normalize=v=>v.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
 const params=new URLSearchParams(location.search);
 function selectKnown(node,value){if([...node.options].some(o=>o.value===value))node.value=value;}
 search.value=params.get('q')||'';selectKnown(category,params.get('category'));selectKnown(brand,params.get('brand'));selectKnown(price,params.get('price'));selectKnown(sort,params.get('sort'));
 function refresh(updateURL=true){
  const words=normalize(search.value.trim()).split(/\s+/).filter(Boolean);
  let count=0;
  cards.forEach(card=>{const d=card.dataset,p=Number(d.price),priceOK=price.value==='all'||(price.value==='under-10'&&p<1000)||(price.value==='10-25'&&p>=1000&&p<2500)||(price.value==='25-50'&&p>=2500&&p<5000)||(price.value==='over-50'&&p>=5000);const visible=words.every(w=>normalize(d.search).includes(w))&&(category.value==='all'||category.value===d.category)&&(brand.value==='all'||brand.value===d.brand)&&priceOK;card.hidden=!visible;if(visible)count++;});
  const ordered=[...cards];if(sort.value==='price-low')ordered.sort((a,b)=>Number(a.dataset.price)-Number(b.dataset.price));if(sort.value==='price-high')ordered.sort((a,b)=>Number(b.dataset.price)-Number(a.dataset.price));if(sort.value==='name')ordered.sort((a,b)=>a.dataset.name.localeCompare(b.dataset.name));ordered.forEach(card=>grid.append(card));
  shop.querySelector('[data-retail-count]').textContent=`${count} ${count===1?'product':'products'}${count!==cards.length?' of '+cards.length:''}`;
  shop.querySelector('.retail-empty').hidden=count!==0;
  shop.querySelectorAll('[data-retail-category]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.retailCategory===category.value)));
  if(updateURL){const q=new URLSearchParams();if(search.value.trim())q.set('q',search.value.trim());if(category.value!=='all')q.set('category',category.value);if(brand.value!=='all')q.set('brand',brand.value);if(price.value!=='all')q.set('price',price.value);if(sort.value!=='featured')q.set('sort',sort.value);history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash);}
 }
 search.addEventListener('input',()=>refresh());[category,brand,price,sort].forEach(node=>node.addEventListener('change',()=>refresh()));
 shop.querySelectorAll('[data-retail-category]').forEach(btn=>btn.addEventListener('click',()=>{category.value=btn.dataset.retailCategory;refresh();}));
 shop.querySelectorAll('[data-retail-reset]').forEach(btn=>btn.addEventListener('click',()=>{search.value='';category.value=brand.value=price.value='all';sort.value='featured';refresh();}));
 const toggle=shop.querySelector('.retail-filter-toggle');toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));shop.classList.toggle('filters-open',open);});
 refresh(false);
})();
