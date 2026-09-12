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
expect(admin.includes("autoTitle=file?.name?.replace") && admin.includes("title=typedTitle||autoTitle"), 'اسم الملف يتحول تلقائيًا إلى عنوان دون كتابة يدوية');
expect(resources.includes('pdfjsLib.getDocument'), 'ملفات PDF تُقرأ داخل المنصة');
expect(resources.includes('<video src='), 'الفيديو يُشغّل داخل المنصة');
expect(tournament.indexOf('id="newsBanner"') < tournament.indexOf('class="qlinks-wrap"'), 'شريط الأخبار يظهر أعلى أقسام البطولة');
expect(tournament.indexOf('class="qlinks-wrap"') < tournament.indexOf('id="infoHubSection"'), 'الأقسام الأساسية تسبق مركز المعلومات');
expect(resources.includes('env(safe-area-inset-top') && resources.includes('✕ إغلاق والرجوع'), 'أزرار الرجوع والإغلاق بعيدة عن حافة الهاتف');
expect(resources.includes('media-stage') && resources.includes('linear-gradient(160deg,#eefbff,#cbeaf5)'), 'الفيديو يظهر مركزيًا فوق خلفية سماوية فاتحة');
expect(resources.includes('changePdfZoom') && resources.includes('Math.min(window.devicePixelRatio||1,2)'), 'عارض PDF للنشرات عالي الدقة ويدعم التكبير والتصغير');
expect(resources.includes('available=Math.max(280,body.clientWidth-8)') && resources.includes('cssScale=(available/base.width)*pdfZoom'), 'ملفات PDF تستخدم معادلة ملاءمة عرض النشرة نفسها');
expect(resources.includes('overflow-y:scroll') && resources.includes('scrollbar-gutter:stable'), 'عرض الصفحة يبقى ثابتًا بلا تمرير أفقي عند ظهور شريط الصفحات');
expect(resources.includes('for(let n=1;n<=currentPdf.numPages;n++)'), 'كل صفحات PDF تظهر رأسيًا بالتتابع');
expect(!resources.includes('useNativePdf') && !resources.includes('native-pdf-frame') && !resources.includes('<iframe'), 'لا يعود الملف إلى عارض PDF الأصلي الكبير');
expect(resources.includes('history.pushState({resourceViewer:true}') && resources.includes("addEventListener('popstate'"), 'زر الرجوع في الهاتف يغلق عارض الملف');
expect(!resources.includes('id="directLink"'), 'لا يوجد زر يخرج بالـPDF إلى صفحة بلا رجوع');
expect(tournament.includes('<details class="media-section media-accordion info-hub">') && !tournament.includes('<details open class="media-section media-accordion info-hub">'), 'صندوق اللوائح والتعليمات مطوي افتراضيًا');
expect(tournament.includes('bindMediaAccordions(sec)'), 'صندوق اللوائح يستخدم آلية طي أقسام الصور والفيديوهات نفسها');
expect(tournament.includes("await loadContentSettings()") && tournament.includes('loadInfoHub()'), 'إعدادات الظهور تُحمّل قبل المحتوى');
expect(tournament.includes(".eq('is_visible',true)"), 'صفحة البطولة تستبعد المواد المخفية');
expect(matchLive.includes(".eq('match_id',m.id).eq('is_visible',true)"), 'صفحة المباراة لا تعرض خبرًا مخفيًا');
expect(videos.includes(".eq('is_visible',true)") && documents.includes(".eq('is_visible',true)"), 'صفحات الفيديو والنشرات تستبعد المخفي');

console.log('\nنجحت اختبارات مركز المعلومات والإعلام.');
