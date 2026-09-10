(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const isolated=params.get('standalone')==='1';
  let manifestUrl='';
  function scopedUrl(href){
    if(!isolated||!href||href.startsWith('#')||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return href;
    let url;try{url=new URL(href,location.href);}catch(_error){return href;}
    if(url.origin!==location.origin)return href;
    const page=url.pathname.split('/').pop()||'index.html';
    if(page==='index.html')return '';
    url.searchParams.set('standalone','1');
    return page+(url.search?'?'+url.searchParams.toString():'')+url.hash;
  }
  function decorateLink(link){
    if(!isolated||!link||!link.getAttribute)return;
    const href=link.getAttribute('href');if(!href)return;
    const next=scopedUrl(href);
    if(next===''){link.hidden=true;link.setAttribute('aria-hidden','true');link.setAttribute('tabindex','-1');}
    else if(next!==href)link.setAttribute('href',next);
  }
  function decorate(root){
    if(!isolated)return;
    if(root&&root.matches&&root.matches('a[href]'))decorateLink(root);
    if(root&&root.querySelectorAll)root.querySelectorAll('a[href]').forEach(decorateLink);
  }
  function contrastText(hex){
    const raw=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(raw))return '#ffffff';
    const rgb=[0,2,4].map(i=>parseInt(raw.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.5?'#10233c':'#ffffff';
  }
  function applyTournamentTheme(t){
    if(!t)return;
    const primary=t.primary_color||'#0b4f7c',secondary=t.secondary_color||'#d7b348';
    document.documentElement.style.setProperty('--theme-primary',primary);
    document.documentElement.style.setProperty('--theme-secondary',secondary);
    document.documentElement.style.setProperty('--theme-on-primary',contrastText(primary));
    document.body?.classList.add('tournament-themed');
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=primary;
  }
  function addPlatformBrand(){
    if(document.querySelector('[data-platform-brand]'))return;
    const mark=document.createElement('div');mark.className='tournament-platform-mark';mark.dataset.platformBrand='';
    mark.innerHTML='<img src="icon-app.png" alt=""><span>منصة البطولات الاحترافية</span>';document.body.prepend(mark);
  }
  function configureApp(t,tournamentId){
    if(!t||!tournamentId)return;
    applyTournamentTheme(t);
    const name=t.name_ar||t.name||'البطولة',base=new URL('.',location.href),start=new URL('tournament.html',base);
    start.searchParams.set('id',tournamentId);start.searchParams.set('standalone','1');
    const icon=t.cup_logo_url||t.logo_url||new URL('icon-app.png',base).href;
    const manifest={id:base.pathname+'tournament-'+tournamentId,name:name+' — منصة البطولات الاحترافية',short_name:name.slice(0,28),description:'التطبيق الرسمي لمتابعة '+name,lang:'ar',dir:'rtl',display:'standalone',orientation:'any',start_url:start.href,scope:base.pathname,background_color:t.primary_color||'#071b35',theme_color:t.primary_color||'#071b35',icons:[{src:new URL('icon-app.png',base).href,sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:new URL('icon-app-512.png',base).href,sizes:'512x512',type:'image/png',purpose:'any maskable'}]};
    if(manifestUrl)URL.revokeObjectURL(manifestUrl);
    manifestUrl=URL.createObjectURL(new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'}));
    let link=document.querySelector('link[rel="manifest"]');if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link);}link.href=manifestUrl;
    const touch=document.querySelector('link[rel="apple-touch-icon"]');if(touch)touch.href=icon;
    document.title=name;return manifest;
  }
  if(isolated)document.documentElement.classList.add('tournament-isolated');
  document.addEventListener('DOMContentLoaded',function(){
    if(!isolated)return;document.body.classList.add('tournament-isolated');addPlatformBrand();decorate(document);
    new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(decorate))).observe(document.body,{childList:true,subtree:true});
  });
  window.TournamentScope={isIsolated:isolated,scopedUrl,decorate,applyTournamentTheme,configureApp,contrastText};
})();
