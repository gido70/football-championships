import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const exporter=read('emergency-excel.js');
const stats=read('stats-admin.html');
const match=read('match-admin.html');
const psAdmin=read('playstation-admin.html');
const psOperator=read('playstation-operator.html');

assert.match(exporter,/const MANSOUR_2027='c983ee0c-4434-470d-b0a2-6e6efe1ad650'/,'يجب حصر النسخة في كأس منصور 2027');
assert.match(exporter,/tournamentId!==MANSOUR_2027/,'حارس نطاق البطولة غير موجود');
assert.match(exporter,/from\('tournaments'\)\.select\('id,name,season_label'\)/,'استعلام البطولة يجب أن يستخدم الأعمدة الموجودة فعليًا فقط');
assert.ok(!exporter.includes("select('id,name,name_ar,season_label')"),'لا يجوز طلب العمود غير الموجود tournaments.name_ar');
assert.match(exporter,/x\.shot_order/,'يجب استخدام اسم حقل ترتيب ركلات الترجيح الحقيقي');
for(const sheet of ['المباريات','ترتيب المجموعات','الفرق','اللاعبون','الجنسيات','سجل الأحداث','الأهداف','البطاقات','VAR','التشكيلات','الهدافون','الحكام والمعلقون','إدخال الطوارئ'])assert.ok(exporter.includes(`'${sheet}'`),'ورقة كأس منصور ناقصة: '+sheet);
for(const sheet of ['المشاركون','الأدوار النهائية','البطل'])assert.ok(exporter.includes(`'${sheet}'`),'ورقة البلايستيشن ناقصة: '+sheet);
assert.match(stats,/refreshEmergencyVisibility[\s\S]*MANSOUR_2027/,'صفحة التقارير لا تخفي النسخة عن البطولات الأخرى');
assert.match(match,/m\.tournament_id===window\.EmergencyExcel\?\.MANSOUR_2027/,'زر المباراة غير محصور بكأس منصور 2027');
assert.ok(stats.includes('exportMansour2027')&&match.includes('exportMansour2027'),'تصدير كأس منصور غير مربوط بصفحتي الإدارة');
assert.ok(psAdmin.includes('exportPlaystation')&&psOperator.includes('exportPlaystation'),'تصدير البلايستيشن غير مربوط بالإدارة والمشغّل');
for(const page of [stats,match,psAdmin,psOperator])assert.ok(page.includes('emergency-excel.js?v=20260916-2'),'يجب تحميل نسخة الإصلاح الجديدة دون كاش قديم');
assert.ok(!exporter.includes(".insert(")&&!exporter.includes(".update(")&&!exporter.includes(".delete("),'مولد النسخة يجب أن يكون للقراءة فقط');
console.log('Emergency Excel scope and integration checks passed');
