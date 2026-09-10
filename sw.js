// sw.js — network-first public shell — v4
const VERSION = 'football-shell-v4';
const CORE = [
  './',
  './index.html',
  './tournament.html',
  './match-live.html',
  './public-ui.css',
  './supabase-config.js',
  './vendor/supabase.min.js',
  './icon-app.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('football-shell-') && key !== VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;

  const isFreshAsset = e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (isFreshAsset) {
    e.respondWith((async()=>{
      const cache=await caches.open(VERSION);
      try{
        const res=await fetch(e.request,{cache:'no-store'});
        if(res.ok)cache.put(e.request,res.clone());
        return res;
      }catch(_error){
        return await cache.match(e.request,{ignoreSearch:true}) ||
          new Response('تعذر فتح الصفحة دون اتصال',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
      }
    })());
    return;
  }
  e.respondWith(
    caches.match(e.request,{ignoreSearch:true}).then(cached=>cached||fetch(e.request).then(res=>{
      if(res.ok)caches.open(VERSION).then(cache=>cache.put(e.request,res.clone()));
      return res;
    }))
  );
});
