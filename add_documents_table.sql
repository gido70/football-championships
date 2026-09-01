-- جدول المستندات / النشرات اليومية (PDF)
-- نفس فكرة نشرات "Mansour-Cup-Season13--2026" القديمة لكن مُدارة من لوحة الأدمن بدل ملفات ثابتة

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  title text not null,
  pdf_url text not null,
  publish_date date,
  description text,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;

-- قراءة عامة للجميع (نفس سياسة videos)
drop policy if exists "documents_public_read" on documents;
create policy "documents_public_read" on documents
  for select using (true);

-- الكتابة (إضافة/حذف/تعديل) لأي شخص لديه صلاحية الوصول الحالية
-- (سيصبح مقيّداً بتسجيل الدخول لاحقاً عند تنفيذ require_auth_for_writes.sql)
drop policy if exists "documents_public_write" on documents;
create policy "documents_public_write" on documents
  for all using (true) with check (true);

create index if not exists idx_documents_tournament on documents(tournament_id);
