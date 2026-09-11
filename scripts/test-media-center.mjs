import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const documents=read('documents.html');
assert(documents.includes("order('publish_date',{ascending:false"),'newsletter order must be newest first');
assert(documents.includes('pdfjsLib.getDocument'),'newsletter must use the internal PDF reader');
assert(documents.includes("docs.map(card).join('')"),'all newsletter issues must remain visible in the list');

const tournament=read('tournament.html');
assert(tournament.includes("mediaSection('صور البطولة'"),'photos must have a separate section');
assert(tournament.includes("mediaSection('التغطية الإعلامية'"),'media coverage must have a separate section');
assert(tournament.includes("mediaSection('فيديوهات البطولة'"),'videos must have a separate section');
assert(tournament.includes('<details class="media-section media-accordion">'),'tournament media sections must collapse on mobile');
assert(tournament.includes('bindMediaAccordions(sec)'),'tournament media accordions must bind after loading');
assert(tournament.includes("whiteCupLogo=/أبطال أوروبا|دوري الأبطال|champions league/i"),'Champions League logo must get the visible white treatment');
assert(tournament.includes('rgba(235,249,255,.98)'),'in-page media viewer must use the light sky treatment');
assert(tournament.includes('live-screen'),'live match must use the television treatment');
assert(tournament.includes('match-report.html?id='),'completed matches must expose the automatic report');

const videos=read('videos.html');
assert(videos.includes('count-${Math.min(items.length,9)}'),'each video section must respond to its own item count');
assert(videos.includes("items.length>3&&items.length%2===1?'odd-tail'"),'odd video rows must span the final card');
assert(videos.includes("title:'ملخصات المباريات'"),'match highlights must be separated from editorial videos');
assert(videos.includes('<details class="video-section video-accordion">'),'video groups must collapse to keep mobile pages short');
assert(videos.includes('bindVideoAccordions(app)'),'video accordions must bind after rendering');

const pdfs=fs.readdirSync(path.join(root,'legacy-2026/news')).filter(name=>name.endsWith('.pdf'));
const covers=fs.readdirSync(path.join(root,'legacy-2026/news')).filter(name=>name.endsWith('-cover.jpg'));
assert(pdfs.length===14,`expected 14 legacy newsletters, got ${pdfs.length}`);
assert(covers.length===14,`expected 14 newsletter covers, got ${covers.length}`);

const galleryNames=['opening','teams','atmosphere','stands','trophy','playstation'];
const imageCount=galleryNames.reduce((sum,name)=>sum+fs.readdirSync(path.join(root,'legacy-2026/gallery',name)).filter(file=>/^img\d+\.jpg$/.test(file)).length,0);
assert(imageCount===59,`expected 59 gallery images, got ${imageCount}`);

console.log('media center tests passed');
