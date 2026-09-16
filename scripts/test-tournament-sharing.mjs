import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const tournaments=[
  {
    key:'aaaaaaaa-0000-0000-0000-000000000001',
    page:'share-mansour-2026-small.html',manifest:'manifest-mansour-2026.webmanifest',
    title:'كأس منصور بن زايد 2026',image:'logo-cup-2026-share-small-v4.png',icon:'logo-cup-2026-black-v3-512.png'
  },
  {
    key:'c983ee0c-4434-470d-b0a2-6e6efe1ad650',
    page:'share-mansour-2027.html',manifest:'manifest-mansour-2027.webmanifest',
    title:'كأس منصور بن زايد 2027',image:'logo-cup-2027-512.png',icon:'logo-cup-2027-512.png'
  },
  {
    key:'eee33333-5d2a-4f3b-a981-d4b8f5f86143',
    page:'share-uefa-2027.html',manifest:'manifest-uefa-2027.webmanifest',
    title:'دوري أبطال أوروبا 2026-2027',image:'uefa-champions-app-512.png',icon:'uefa-champions-app-192.png'
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
  assert.ok(manifest.icons.some(icon=>icon.src.startsWith(t.icon)));
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
assert.ok(tournament.includes('id="shareTournamentButton"'));
assert.ok(tournament.includes("'c983ee0c-4434-470d-b0a2-6e6efe1ad650':'share-mansour-2027.html'"));
assert.ok(tournament.includes("TID==='aaaaaaaa-0000-0000-0000-000000000001'?'20260915-2':'20260914-3'"));
assert.ok(tournament.includes('id="installAppButton"'));
assert.ok(tournament.includes("openInAndroidBrowser('com.sec.android.app.sbrowser')"));
assert.ok(tournament.includes("openInAndroidBrowser('com.android.chrome')"));
assert.ok(tournament.includes('function isInAppBrowser()'));
assert.ok(tournament.includes("document.getElementById('navName').textContent=name"));
assert.ok(tournament.includes('TOURNAMENT_HEADER_ICONS[TID]'));
assert.ok(tournament.includes("'c983ee0c-4434-470d-b0a2-6e6efe1ad650':['manifest-mansour-2027.webmanifest?v=20260914-5','logo-cup-2027-192.png?v=20260914-5','كأس منصور 2027']"));
assert.ok(!tournament.includes('id="appManifest" href="manifest.webmanifest"'));
assert.ok(tournament.includes("const appName=TOURNAMENT_APP_NAMES[TID]||name"));
assert.ok(tournament.includes('tournament-scope.js?v=20260915-1'));
assert.ok(tournament.indexOf('id="iosInstallSheet"')<tournament.indexOf('id="androidInstallSheet"'));

const scope=read('tournament-scope.js');
for(const t of tournaments){assert.ok(scope.includes(t.key));assert.ok(scope.includes(t.manifest));}
assert.ok(scope.includes("const isolated=params.get('standalone')==='1'||Boolean(rootTournamentId)"));
assert.ok(!scope.includes("addPlatformBrand();decorate(document)"));
assert.ok(scope.includes("'c983ee0c-4434-470d-b0a2-6e6efe1ad650':'كأس منصور 2027'"));

const matchLive=read('match-live.html');
for(const t of tournaments){assert.ok(matchLive.includes(t.key));assert.ok(matchLive.includes(t.manifest));}
assert.ok(!matchLive.includes('id="appManifest" href="manifest.webmanifest"'));
assert.ok(matchLive.includes('tournament-scope.js?v=20260915-1'));
for(const file of ['index.html','tournament.html','team.html','player.html']){
  assert.ok(read(file).includes('scope_tid='),`${file} does not preserve the tournament app identity in match links`);
}

const sw=read('sw.js');
assert.ok(sw.includes("football-shell-v36-19"));
for(const t of tournaments){assert.ok(sw.includes(t.page));assert.ok(sw.includes(t.manifest));}

for(const file of ['tournament.html','tournament-scope.js','qr-generator.html','sw.js',...tournaments.flatMap(t=>[t.page,t.manifest])]){
  assert.ok(!read(file).match(/^(<{7}|={7}|>{7})/m),`${file} has conflict markers`);
}

console.log('✅ روابط المشاركة وهوية تثبيت البطولات سليمة');
