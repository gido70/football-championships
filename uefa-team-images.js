(function(){
'use strict';
const UEFA='eee33333-5d2a-4f3b-a981-d4b8f5f86143';
const API='https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=';
const KEY='uefa-team-media-v1:';
function get(k){try{return JSON.parse(localStorage.getItem(KEY+k)||'null')}catch(_){return null}}
function set(k,v){try{localStorage.setItem(KEY+k,JSON.stringify(v))}catch(_){}}
async function lookup(name){const k=String(name||'').trim().toLowerCase();if(!k)return null;const c=get(k);if(c)return c;try{const r=await fetch(API+encodeURIComponent(name),{cache:'force-cache'});if(!r.ok)return null;const j=await r.json();const a=j?.teams||[];const t=a.find(x=>String(x.strSport||'').toLowerCase()==='soccer')||a[0];if(!t)return null;const v={badge:t.strBadge||t.strLogo||'',photo:t.strTeamFanart1||t.strTeamFanart2||t.strTeamFanart3||t.strTeamFanart4||t.strTeamBanner||''};set(k,v);return v}catch(_){return null}}
async function teamPage(){const id=new URLSearchParams(location.search).get('id');if(!id)return;let tries=0;const wait=async()=>{const name=document.querySelector('#teamName')?.textContent?.trim();if(!name||name==='جاري التحميل...'){if(++tries<80)setTimeout(wait,180);return}const media=await lookup(name);if(!media)return;if(media.badge){const box=document.querySelector('#teamInitial');if(box&&!box.querySelector('img')){box.textContent='';const img=document.createElement('img');img.src=media.badge;img.alt=name;img.loading='eager';img.referrerPolicy='no-referrer';box.appendChild(img)}}if(media.photo){const sec=document.querySelector('#teamPhotoSection'),img=document.querySelector('#teamPhotoImg');if(sec&&img&&!img.src){img.src=media.photo;img.alt='صورة فريق '+name;img.referrerPolicy='no-referrer';img.onload=()=>sec.style.display='block'}}};wait()}
function init(){if((location.pathname.split('/').pop()||'').toLowerCase()==='team.html')teamPage()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();