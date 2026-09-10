(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const isolated=params.get('standalone')==='1';
  const currentPage=location.pathname.split('/').pop()||'index.html';
  const rootTournamentId=params.get('scope_tid')||(currentPage==='tournament.html'?params.get('id'):params.get('tid'));
  let manifestUrl='';
  const EUROPE_TOURNAMENT_ID='eee33333-5d2a-4f3b-a981-d4b8f5f86143';
  function scopedUrl(href){
    if(!isolated||!href||href.startsWith('#')||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return href;
    let url;try{url=new URL(href,location.href);}catch(_error){return href;}
    if(url.origin!==location.origin)return href;
    const page=url.pathname.split('/').pop()||'index.html';
    if(page==='index.html'){
      if(currentPage==='tournament.html'||!rootTournamentId)return '';
      return 'tournament.html?id='+encodeURIComponent(rootTournamentId)+'&standalone=1';
    }
    url.searchParams.set('standalone','1');
    if(rootTournamentId)url.searchParams.set('scope_tid',rootTournamentId);
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
  function themeColors(t){
    let primary=t?.primary_color||'#0b4f7c',secondary=t?.secondary_color||'#d7b348';
    if(primary.toLowerCase()==='#a31971'&&secondary.toLowerCase()==='#0bd0cd'){
      primary='#153B5B';secondary='#7FAFC4';
    }
    return {primary,secondary};
  }
  function applyTournamentTheme(t){
    if(!t)return;
    const {primary,secondary}=themeColors(t);
    document.documentElement.style.setProperty('--theme-primary',primary);
    document.documentElement.style.setProperty('--theme-secondary',secondary);
    document.documentElement.style.setProperty('--theme-on-primary',contrastText(primary));
    document.body?.classList.add('tournament-themed');
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=primary;
    decorateTournamentNav(t);
  }
  function decorateTournamentNav(t){
    if(!isolated||!t||currentPage==='tournament.html')return;
    const nav=document.querySelector('.nav');if(!nav)return;
    const target=nav.querySelector('#navTName,.nav-title')||nav.querySelector('span');if(!target)return;
    const name=t.name_ar||t.name||'البطولة';
    const logo=t.cup_logo_url||t.logo_url||'';
    target.classList.add('tournament-nav-brand');
    target.innerHTML=(logo?'<img class="tournament-nav-logo" src="'+logo+'" alt="">':'<span class="tournament-nav-cup">🏆</span>')+'<span>'+name+'</span>';
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
    const isEurope=tournamentId===EUROPE_TOURNAMENT_ID;
    const installIcon=isEurope?new URL('uefa-champions-app-512.png',base).href:icon;
    const colors=themeColors(t);
    const icons=isEurope
      ? [{src:new URL('uefa-champions-app-192.png',base).href,sizes:'192x192',type:'image/png',purpose:'any'},{src:installIcon,sizes:'512x512',type:'image/png',purpose:'any maskable'}]
      : [{src:icon,sizes:'any',purpose:'any'},{src:new URL('icon-app.png',base).href,sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:new URL('icon-app-512.png',base).href,sizes:'512x512',type:'image/png',purpose:'any maskable'}];
    const manifest={id:base.pathname+'tournament-'+tournamentId,name:name+' — منصة البطولات الاحترافية',short_name:name.slice(0,28),description:'التطبيق الرسمي لمتابعة '+name,lang:'ar',dir:'rtl',display:'standalone',orientation:'any',start_url:start.href,scope:base.pathname,background_color:colors.primary,theme_color:colors.primary,icons};
    if(manifestUrl)URL.revokeObjectURL(manifestUrl);
    manifestUrl=URL.createObjectURL(new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'}));
    let link=document.querySelector('link[rel="manifest"]');if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link);}link.href=manifestUrl;
    const touch=document.querySelector('link[rel="apple-touch-icon"]');if(touch)touch.href=installIcon;
    document.title=name;return manifest;
  }
  if(isolated)document.documentElement.classList.add('tournament-isolated');
  document.addEventListener('DOMContentLoaded',function(){
    if(!isolated)return;document.body.classList.add('tournament-isolated');addPlatformBrand();decorate(document);
    document.addEventListener('click',event=>{
      const link=event.target.closest?.('a[href]');if(!link)return;
      const next=scopedUrl(link.getAttribute('href'));
      if(next===''){event.preventDefault();event.stopPropagation();return;}
      if(next!==link.getAttribute('href'))link.setAttribute('href',next);
    },true);
    new MutationObserver(records=>records.forEach(record=>{
      if(record.type==='attributes')decorateLink(record.target);
      else record.addedNodes.forEach(decorate);
    })).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  });
  window.TournamentScope={isIsolated:isolated,rootTournamentId,scopedUrl,decorate,themeColors,applyTournamentTheme,decorateTournamentNav,configureApp,contrastText};
})();
