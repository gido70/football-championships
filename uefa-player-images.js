(function(){
  'use strict';

  const UEFA_TOURNAMENT_ID='eee33333-5d2a-4f3b-a981-d4b8f5f86143';
  const SELECTED_TEAMS=new Set([
    '0cc10001-0000-0000-0000-000000000001', // PSG
    '0cc10001-0000-0000-0000-000000000002', // Bayern
    '0cc10001-0000-0000-0000-000000000003', // Real Madrid
    '0cc10001-0000-0000-0000-000000000004', // Liverpool
    '0cc10001-0000-0000-0000-000000000005', // Inter
    '0cc10001-0000-0000-0000-000000000006', // Man City
    '0cc10001-0000-0000-0000-000000000007', // Arsenal
    '0cc10001-0000-0000-0000-000000000008', // Barcelona
    '0cc10001-0000-0000-0000-000000000009', // Atletico
    '0cc10001-0000-0000-0000-000000000010', // Dortmund
    '0cc10001-0000-0000-0000-000000000011', // Roma
    '0cc10001-0000-0000-0000-000000000015'  // Man United
  ]);
  const API='https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=';
  const CACHE_PREFIX='uefa-player-photo-v1:';

  function cacheKey(name){return CACHE_PREFIX+name.trim().toLowerCase();}
  function cacheGet(name){
    try{return localStorage.getItem(cacheKey(name))||'';}catch(_){return '';}
  }
  function cacheSet(name,url){
    try{if(url)localStorage.setItem(cacheKey(name),url);}catch(_){}
  }
  function normalizeName(name){
    return String(name||'').replace(/\s+/g,' ').trim();
  }
  function choosePlayer(players,name){
    if(!Array.isArray(players)||!players.length)return null;
    const target=normalizeName(name).toLowerCase();
    return players.find(p=>normalizeName(p.strPlayer).toLowerCase()===target&&String(p.strSport||'').toLowerCase()==='soccer')
      ||players.find(p=>String(p.strSport||'').toLowerCase()==='soccer')
      ||players[0];
  }
  async function resolvePhoto(name){
    name=normalizeName(name);
    if(!name)return '';
    const cached=cacheGet(name);
    if(cached)return cached;
    try{
      const res=await fetch(API+encodeURIComponent(name),{mode:'cors',cache:'force-cache'});
      if(!res.ok)return '';
      const data=await res.json();
      const p=choosePlayer(data?.player||data?.players,name);
      const url=p?.strCutout||p?.strThumb||p?.strRender||'';
      if(url)cacheSet(name,url);
      return url;
    }catch(_){return '';}
  }
  function isSelectedTeam(teamId){return SELECTED_TEAMS.has(String(teamId||''));}
  async function hydrate(root=document){
    const nodes=Array.from(root.querySelectorAll('[data-uefa-player-name][data-uefa-team-id]'));
    await Promise.all(nodes.map(async node=>{
      if(node.dataset.uefaHydrated==='1'||!isSelectedTeam(node.dataset.uefaTeamId))return;
      node.dataset.uefaHydrated='1';
      const url=await resolvePhoto(node.dataset.uefaPlayerName);
      if(!url)return;
      const img=document.createElement('img');
      img.src=url;
      img.alt=node.dataset.uefaPlayerAlt||node.dataset.uefaPlayerName;
      img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
      img.className=node.dataset.uefaPhotoClass||'';
      img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';
      img.onerror=()=>{img.remove();node.dataset.uefaHydrated='';};
      node.replaceChildren(img);
      node.classList.add('has-player-photo');
    }));
  }
  function addImageToPlaceholder(ph,name,url,large){
    if(!ph||!url)return;
    const img=document.createElement('img');
    img.className=large?'photo':'player-photo';
    img.src=url;
    img.alt=name;
    img.loading='lazy';
    img.decoding='async';
    img.referrerPolicy='no-referrer';
    img.onerror=()=>{img.replaceWith(ph);};
    ph.replaceWith(img);
  }
  async function hydrateTeamPage(teamId){
    if(!SELECTED_TEAMS.has(teamId))return;
    const cards=Array.from(document.querySelectorAll('.player-card')).slice(0,15);
    if(!cards.length)return;
    for(const card of cards){
      if(card.querySelector('.player-photo'))continue;
      const ph=card.querySelector('.player-ph');
      const name=normalizeName(card.querySelector('.player-name')?.textContent);
      if(!ph||!name)continue;
      const url=await resolvePhoto(name);
      if(url)addImageToPlaceholder(ph,name,url,false);
    }
  }
  async function hydratePlayerPage(playerId){
    const client=window.supabase&&window.SUPABASE_URL&&window.SUPABASE_ANON_KEY
      ?window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY):null;
    if(!client)return;
    try{
      const {data:p}=await client.from('players').select('id,team_id,tournament_id,name,full_name_ar,jersey_photo_url').eq('id',playerId).single();
      if(!p||p.tournament_id!==UEFA_TOURNAMENT_ID||!SELECTED_TEAMS.has(p.team_id)||p.jersey_photo_url)return;
      const name=normalizeName(p.name||p.full_name_ar);
      const url=await resolvePhoto(name);
      if(!url)return;
      const wait=()=>{
        const ph=document.querySelector('#playerPhoto .photo-fallback');
        if(ph)addImageToPlaceholder(ph,name,url,true);
        else if(!document.querySelector('#playerPhoto .photo'))setTimeout(wait,180);
      };
      wait();
    }catch(_){}
  }

  window.UefaPlayerImages={resolvePhoto,isSelectedTeam,hydrate};
  async function init(){
    const page=(location.pathname.split('/').pop()||'').toLowerCase();
    const id=new URLSearchParams(location.search).get('id');
    if(!id)return;
    if(page==='team.html'){
      if(!SELECTED_TEAMS.has(id))return;
      let tries=0;
      const wait=()=>{
        const cards=document.querySelectorAll('.player-card');
        if(cards.length)hydrateTeamPage(id);
        else if(++tries<80)setTimeout(wait,180);
      };
      wait();
    }else if(page==='player.html'){
      hydratePlayerPage(id);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
