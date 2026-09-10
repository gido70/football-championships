(function(){
  'use strict';

  const params=new URLSearchParams(location.search);
  const isolated=params.get('standalone')==='1';

  function scopedUrl(href){
    if(!isolated||!href||href.startsWith('#')||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return href;
    let url;
    try{url=new URL(href,location.href);}catch(_error){return href;}
    if(url.origin!==location.origin)return href;
    const page=url.pathname.split('/').pop()||'index.html';
    if(page==='index.html')return '';
    url.searchParams.set('standalone','1');
    return page+(url.search?'?'+url.searchParams.toString():'')+url.hash;
  }

  function decorateLink(link){
    if(!isolated||!link||!link.getAttribute)return;
    const href=link.getAttribute('href');
    if(!href)return;
    const next=scopedUrl(href);
    if(next===''){
      link.hidden=true;
      link.setAttribute('aria-hidden','true');
      link.setAttribute('tabindex','-1');
    }else if(next!==href){
      link.setAttribute('href',next);
    }
  }

  function decorate(root){
    if(!isolated)return;
    if(root&&root.matches&&root.matches('a[href]'))decorateLink(root);
    if(root&&root.querySelectorAll)root.querySelectorAll('a[href]').forEach(decorateLink);
  }

  function addPlatformBrand(){
    if(document.querySelector('[data-platform-brand]'))return;
    const style=document.createElement('style');
    style.textContent='.tournament-platform-strip{background:#061b33;color:rgba(255,255,255,.86);font:700 11px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:5px 12px;letter-spacing:.15px;border-bottom:1px solid rgba(255,255,255,.1)}';
    document.head.appendChild(style);
    const strip=document.createElement('div');
    strip.className='tournament-platform-strip';
    strip.dataset.platformBrand='';
    strip.textContent='⚽ منصة البطولات الاحترافية';
    document.body.prepend(strip);
  }

  if(isolated){
    document.documentElement.classList.add('tournament-isolated');
    document.addEventListener('DOMContentLoaded',function(){
      document.body.classList.add('tournament-isolated');
      addPlatformBrand();
      decorate(document);
      new MutationObserver(function(records){
        records.forEach(function(record){record.addedNodes.forEach(decorate);});
      }).observe(document.body,{childList:true,subtree:true});
    });
  }

  window.TournamentScope={
    isIsolated:isolated,
    scopedUrl:scopedUrl,
    decorate:decorate
  };
})();
