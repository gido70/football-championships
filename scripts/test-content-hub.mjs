import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
};

function scriptsFrom(html) {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1]))
    .map(match => ({attrs: match[1], code: match[2]}));
}

const sql = read('tournament_content_hub.sql');
const admin = read('content-hub-admin.html');
const resources = read('resources.html');
const tournament = read('tournament.html');
const matchLive = read('match-live.html');
const videos = read('videos.html');
const documents = read('documents.html');

for (const {code} of scriptsFrom(admin)) new vm.Script(code, {filename: 'content-hub-admin.html'});
for (const {attrs, code} of scriptsFrom(resources)) {
  const parsable = /type=["']module["']/.test(attrs)
    ? code.replace(/^import[^;]+;/m, '')
    : code;
  new vm.Script(parsable, {filename: 'resources.html'});
}

expect(sql.includes('create table if not exists tournament_content_sections'), 'جدول إظهار وإخفاء الأقسام موجود');
expect(sql.includes('create table if not exists tournament_resources'), 'جدول مواد البطولة موجود');
expect(sql.includes("'intro','regulations','decisions','instructions','tutorials'"), 'التصنيفات الرسمية والتعليمية مضبوطة');
expect(sql.includes('add column if not exists is_visible'), 'الإخفاء الفردي مضاف للمحتوى القديم');
expect(admin.includes('toggleSection(') && admin.includes('toggleResource(') && admin.includes('toggleLegacy('), 'الأدمن يدعم التحكم بالقسم والمادة والمحتوى القديم');
expect(admin.includes('accept="application/pdf,video/mp4"'), 'نموذج الأدمن يقبل PDF والفيديو');
expect(resources.includes('pdfjsLib.getDocument'), 'ملفات PDF تُقرأ داخل المنصة');
expect(resources.includes('<video src='), 'الفيديو يُشغّل داخل المنصة');
expect(tournament.indexOf('id="quickLinks"') < tournament.indexOf('id="infoHubSection"'), 'الأقسام الأساسية تسبق مركز المعلومات');
expect(tournament.includes("await loadContentSettings()") && tournament.includes('loadInfoHub()'), 'إعدادات الظهور تُحمّل قبل المحتوى');
expect(tournament.includes(".eq('is_visible',true)"), 'صفحة البطولة تستبعد المواد المخفية');
expect(matchLive.includes(".eq('match_id',m.id).eq('is_visible',true)"), 'صفحة المباراة لا تعرض خبرًا مخفيًا');
expect(videos.includes(".eq('is_visible',true)") && documents.includes(".eq('is_visible',true)"), 'صفحات الفيديو والنشرات تستبعد المخفي');

console.log('\nنجحت اختبارات مركز المعلومات والإعلام.');
