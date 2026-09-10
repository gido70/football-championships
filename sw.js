// sw.js — fast shell cache — v3
const VERSION = 'football-shell-v3';
const CORE = ['./','./index.html','./tournament.html','./public-ui.css','./supabase-config.js','./icon-app.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;

  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith((async()=>{
      const cache=await caches.open(VERSION);
      const cached=await cache.match(e.request,{ignoreSearch:true});
      const network=fetch(e.request).then(res=>{
        if(res.ok)cache.put(e.request,res.clone());
        return res;
      }).catch(()=>null);
      return cached||await network||new Response('تعذر فتح الصفحة دون اتصال',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
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
