(function(){
  'use strict';

  const STORAGE_KEY='football-public-navigation-v1';
  const BACK_SELECTOR='[data-nav-back],#backBtn,#teamBack,#backLink,#floatBack';
  const PUBLIC_PAGES=new Set([
    'index.html','tournament.html','team.html','player.html','match-live.html',
    'stats.html','awards.html','videos.html','documents.html','leaderboard.html'
  ]);

  function pageName(url){
    return (url.pathname.split('/').pop()||'index.html').toLowerCase();
  }

  function normalized(input){
    try{
      const url=new URL(input,location.href);
      url.hash='';
      return url.href;
    }catch(_error){
      return '';
    }
  }

  function readParents(){
    try{
      const value=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'{}');
      return value&&typeof value==='object'?value:{};
    }catch(_error){
      return {};
    }
  }

  function writeParents(parents){
    try{
      const entries=Object.entries(parents).slice(-80);
      sessionStorage.setItem(STORAGE_KEY,JSON.stringify(Object.fromEntries(entries)));
    }catch(_error){}
  }

  function labelFor(input){
    try{
      const page=pageName(new URL(input,location.href));
      return ({
        'index.html':'الرئيسية',
        'tournament.html':'البطولة',
        'team.html':'الفريق',
        'player.html':'اللاعب',
        'match-live.html':'المباراة',
        'stats.html':'الإحصائيات',
        'awards.html':'الجوائز',
        'videos.html':'الفيديوهات',
        'documents.html':'النشرات',
        'leaderboard.html':'التوقعات'
      })[page]||'السابق';
    }catch(_error){
      return 'السابق';
    }
  }

  function isPublicTarget(input){
    try{
      const url=new URL(input,location.href);
      return url.origin===location.origin&&PUBLIC_PAGES.has(pageName(url));
    }catch(_error){
      return false;
    }
  }

  function remember(target){
    const destination=normalized(target);
    const current=normalized(location.href);
    if(!destination||!current||destination===current||!isPublicTarget(destination))return;
    const parents=readParents();
    parents[destination]={url:current,label:labelFor(current),savedAt:Date.now()};
    writeParents(parents);
  }

  function storedParent(){
    const entry=readParents()[normalized(location.href)];
    if(!entry||!entry.url||!isPublicTarget(entry.url))return null;
    return entry;
  }

  function prepareNav(back){
    const nav=back.closest('.nav');
    if(nav&&!nav.querySelector('.nav-inner'))nav.classList.add('smart-back-nav');
  }

  function configureBack(elementOrSelector,fallbackHref,fallbackLabel){
    const back=typeof elementOrSelector==='string'
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;
    if(!back)return null;

    back.dataset.navBack='';
    back.classList.add('smart-back');
    prepareNav(back);

    const parent=storedParent();
    const fallback=normalized(fallbackHref||back.getAttribute('href'));
    const target=parent?.url||(isPublicTarget(fallback)?fallback:'');
    if(target){
      back.href=target;
      back.removeAttribute('onclick');
      const label=parent?.label||fallbackLabel||labelFor(target);
      back.textContent='← '+label;
      back.setAttribute('aria-label','الرجوع إلى '+label);
    }
    return target;
  }

  function initBackButtons(){
    document.querySelectorAll(BACK_SELECTOR).forEach(back=>configureBack(back));
  }

  document.addEventListener('click',event=>{
    const back=event.target.closest?.('[data-nav-back]');
    if(back)return;
    const link=event.target.closest?.('a[href]');
    const routed=event.target.closest?.('[data-nav-target]');
    const target=link?.href||routed?.getAttribute('data-nav-target');
    if(target)remember(target);
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initBackButtons);
  else initBackButtons();

  window.PublicNavigation={remember,configureBack,labelFor};
})();
