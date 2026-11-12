(() => {
  'use strict';
  document.querySelectorAll('[data-event-end]').forEach(el=>{el.hidden=Date.now()>Date.parse(el.dataset.eventEnd);});
  // Keep earlier preview links usable after replacing the filter UI with visible categories.
  if(/\/explore(?:\.html)?$/.test(location.pathname)&&!location.hash){
    const params=new URLSearchParams(location.search), category=params.get('category'), q=(params.get('q')||'').toLowerCase();
    const routes={'Hemp & CBD':'hemp-cbd','Glass':'glass','Accessories':'accessories','Lifestyle':'scents-merch','Other categories':'kratom','Smoke shop':'papers-tobacco'};
    const id=routes[category]||(q.includes('vape')?'vapes':q.includes('hookah')?'hookah':null);
    if(id){history.replaceState(null,'',location.pathname+'#'+id);document.getElementById(id)?.scrollIntoView();}
  }
  const items=[...document.querySelectorAll('.gallery-item')],dialog=document.querySelector('#gallery-dialog');
  if(dialog&&items.length){let current=0,lastTrigger=null;const pic=dialog.querySelector('img'),caption=dialog.querySelector('p');function show(n){current=(n+items.length)%items.length;pic.src=items[current].dataset.full;pic.alt=items[current].dataset.caption;caption.textContent=items[current].dataset.caption;document.querySelector('#gallery-position').textContent=`${current+1} / ${items.length}`;}items.forEach((item,i)=>item.addEventListener('click',()=>{lastTrigger=item;show(i);dialog.showModal();}));dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>lastTrigger?.focus());document.querySelector('#gallery-prev').addEventListener('click',()=>show(current-1));document.querySelector('#gallery-next').addEventListener('click',()=>show(current+1));dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(current-1);if(e.key==='ArrowRight')show(current+1);});}
})();
