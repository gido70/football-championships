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
assert(tournament.includes('<details class="media-section media-accordion media-section--${tone}">'),'tournament media sections must collapse on mobile');
assert(tournament.includes('bindMediaAccordions(sec)'),'tournament media accordions must bind after loading');
assert(tournament.includes("whiteCupLogo=/أبطال أوروبا|دوري الأبطال|champions league/i"),'Champions League logo must get the visible white treatment');
assert(tournament.includes('rgba(235,249,255,.98)'),'in-page media viewer must use the light sky treatment');
assert(tournament.includes('live-screen'),'live match must use the television treatment');
assert(tournament.includes('match-report.html?id='),'completed matches must expose the automatic report');
assert(tournament.includes("const LEGACY_MEDIA_ROOT='https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/'"),'legacy 2026 media must be localized');
assert(tournament.includes('feed-gallery-nav'),'gallery viewer must expose phone-friendly previous and next controls');
assert(tournament.includes('moveFeedGallery'),'gallery viewer must load one image at a time');
assert(tournament.includes('sponsors-ticker-line'),'sponsors must use the enhanced tournament-themed strip');
assert(tournament.includes('ticker-sponsor-logo-box'),'sponsor logos must keep a clear white presentation area');
assert(tournament.includes('<span>${s.name}</span>'),'sponsor names must remain visible beside their logos');
assert(tournament.includes('ticker-sponsor-sep'),'sponsor separators must stay visible in every tournament theme');
assert(tournament.includes("clone.setAttribute('aria-hidden','true')"),'ticker must duplicate its cycle for seamless motion');
assert(tournament.includes('state.pos+=state.cycleWidth'),'ticker must loop without crossing an empty viewport');

const videos=read('videos.html');
assert(videos.includes('count-${Math.min(items.length,9)}'),'each video section must respond to its own item count');
assert(videos.includes("items.length>3&&items.length%2===1?'odd-tail'"),'odd video rows must span the final card');
assert(videos.includes("title:'ملخصات المباريات'"),'match highlights must be separated from editorial videos');
assert(videos.includes('<details class="video-section video-accordion">'),'video groups must collapse to keep mobile pages short');
assert(videos.includes('bindVideoAccordions(app)'),'video accordions must bind after rendering');
assert(videos.includes('mediaUrl(v.video_url)'),'legacy videos must use their stable local copies');
assert(videos.includes('playsinline'),'phone video playback must remain inside the app');

assert(documents.includes('https://cdn.jsdelivr.net/gh/gido70/Championship-Mansour-Bin-Zaid-Cup--2026@main/assets/'),'legacy PDFs must use the stable media CDN');

console.log('media center tests passed');
