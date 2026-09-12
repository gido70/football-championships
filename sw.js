// sw.js — network-first public shell + Web Push — v36
const VERSION = 'football-shell-v36';
const CORE = [
  './',
  './index.html',
  './tournament.html',
  './match-live.html',
  './match-report.html',
  './documents.html',
  './resources.html',
  './videos.html',
  './media-source.html',
  './team.html',
  './player.html',
  './public-ui.css',
  './public-navigation.css',
  './public-navigation.js',
  './tournament-theme.css',
  './supabase-config.js',
  './tournament-scope.js',
  './public-date.js',
  './push-config.js',
  './push-notifications.js',
  './admin-push.js',
  './vendor/supabase.min.js',
  './icon-app.png',
  './uefa-champions-app-192.png',
  './uefa-champions-app-512.png'
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

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json()||{}}catch(_error){data={body:event.data?.text()||''}}
  const options={
    body:data.body||'',icon:data.icon||'./icon-app.png',badge:data.badge||'./icon-app.png',
    tag:data.tag||'match-update',renotify:true,silent:false,dir:'rtl',lang:'ar',data:{url:data.url||'./index.html'}
  };
  event.waitUntil(self.registration.showNotification(data.title||'منصة البطولات',options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./index.html',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if('focus'in client){await client.navigate(target);return client.focus();}}
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  })());
});
