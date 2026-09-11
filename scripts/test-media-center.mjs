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
assert(tournament.includes('live-screen'),'live match must use the television treatment');
assert(tournament.includes('match-report.html?id='),'completed matches must expose the automatic report');

const videos=read('videos.html');
assert(videos.includes('count-${Math.min(VIDEOS.length,9)}'),'video layout must respond to item count');
assert(videos.includes("VIDEOS.length>3&&VIDEOS.length%2===1?'odd-tail'"),'odd video rows must span the final card');

const pdfs=fs.readdirSync(path.join(root,'legacy-2026/news')).filter(name=>name.endsWith('.pdf'));
const covers=fs.readdirSync(path.join(root,'legacy-2026/news')).filter(name=>name.endsWith('-cover.jpg'));
assert(pdfs.length===14,`expected 14 legacy newsletters, got ${pdfs.length}`);
assert(covers.length===14,`expected 14 newsletter covers, got ${covers.length}`);

const galleryNames=['opening','teams','atmosphere','stands','trophy','playstation'];
const imageCount=galleryNames.reduce((sum,name)=>sum+fs.readdirSync(path.join(root,'legacy-2026/gallery',name)).filter(file=>/^img\d+\.jpg$/.test(file)).length,0);
assert(imageCount===59,`expected 59 gallery images, got ${imageCount}`);

console.log('media center tests passed');
