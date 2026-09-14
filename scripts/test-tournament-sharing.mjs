import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const tournaments=[
  {
    key:'aaaaaaaa-0000-0000-0000-000000000001',
    page:'share-mansour-2026.html',manifest:'manifest-mansour-2026.webmanifest',
    title:'كأس منصور بن زايد 2026',image:'bg_2026.jpg',icon:'logo-cup-2026-512.png'
  },
  {
    key:'c983ee0c-4434-470d-b0a2-6e6efe1ad650',
    page:'share-mansour-2027.html',manifest:'manifest-mansour-2027.webmanifest',
    title:'كأس منصور بن زايد 2027',image:'bg_2027.jpg',icon:'logo-cup-2027-512.png'
  },
  {
    key:'eee33333-5d2a-4f3b-a981-d4b8f5f86143',
    page:'share-uefa-2027.html',manifest:'manifest-uefa-2027.webmanifest',
    title:'دوري أبطال أوروبا 2026-2027',image:'bg_1788467545720.jpg',icon:'uefa-champions-app-192.png'
  }
];

for(const t of tournaments){
  const page=read(t.page);
  assert.match(page,new RegExp(`<meta property="og:title" content="${t.title}"`));
  assert.ok(page.includes('<meta property="og:image" content="https://'),'OG image must be absolute');
  assert.ok(page.includes(t.image),'OG image must use tournament identity');
  assert.ok(page.includes(t.key),'share page must redirect to its tournament');
  assert.ok(page.includes(`rel="manifest" href="${t.manifest}"`));
  assert.ok(!page.match(/property="og:image"[^>]+icon-app\.png/));
  const manifest=JSON.parse(read(t.manifest));
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.start_url.includes(t.key));
  assert.ok(manifest.start_url.includes('standalone=1'));
  assert.ok(manifest.icons.some(icon=>icon.src===t.icon));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));
}

assert.equal(new Set(tournaments.map(t=>JSON.parse(read(t.manifest)).id)).size,3,'manifest IDs must be unique');

const qr=read('qr-generator.html');
for(const t of tournaments){assert.ok(qr.includes(t.key));assert.ok(qr.includes(t.page));}
assert.ok(qr.includes("params.get('tournament')||params.get('tid')"));
assert.ok(qr.includes('navigator.share'));

const tournament=read('tournament.html');
for(const t of tournaments){assert.ok(tournament.includes(t.key));assert.ok(tournament.includes(t.manifest));}
assert.ok(tournament.includes("beforeinstallprompt"));
assert.ok(tournament.includes("Samsung Internet"));
assert.ok(tournament.includes("86400000"));
assert.ok(tournament.includes("appinstalled"));
assert.ok(tournament.indexOf('id="iosInstallSheet"')<tournament.indexOf('id="androidInstallSheet"'));

const scope=read('tournament-scope.js');
for(const t of tournaments){assert.ok(scope.includes(t.key));assert.ok(scope.includes(t.manifest));}

const sw=read('sw.js');
assert.ok(sw.includes("football-shell-v36-10"));
for(const t of tournaments){assert.ok(sw.includes(t.page));assert.ok(sw.includes(t.manifest));}

for(const file of ['tournament.html','tournament-scope.js','qr-generator.html','sw.js',...tournaments.flatMap(t=>[t.page,t.manifest])]){
  assert.ok(!read(file).match(/^(<{7}|={7}|>{7})/m),`${file} has conflict markers`);
}

console.log('✅ روابط المشاركة وهوية تثبيت البطولات سليمة');
