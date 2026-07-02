-- Group Documents (My Docs) — Supabase port of the myltcapps Group Docs
-- feature. Documents are group-scoped files organized into folders and
-- subfolders. myltcapps stored the rows + bytes in Dataverse with curation
-- flags mirrored into Supabase; here everything lives in Supabase — rows in
-- biz_group_documents, bytes in the private `group-documents` storage bucket.
--
-- Access model (mirrors the source feature):
--   read   — any user in the document's facility. Group scoping (which groups'
--            docs you browse) is UX in the client; the facility is the hard
--            tenant boundary, exactly like the Dataverse original.
--   write  — facility admins (super_user) for anything, or the group's leader
--            (biz_group_members.is_admin) for that group's documents.
--            "All Staff" documents (group_id IS NULL) are facility-admin only.
--
-- Files are stored at {facility_id}/{document_id}/{file_name}; the storage
-- policies below tie object access to the same predicates via the row, so no
-- service-role key is needed anywhere (repo convention: RLS is the boundary).

-- Per-group opt-in flag (set on the My Groups edit modal). Groups only appear
-- in My Docs after opting in — mirrors ltc_groups.use_group_docs.
alter table public.biz_groups
  add column if not exists use_group_docs boolean default false;

create table if not exists public.biz_group_documents (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  -- NULL = "All Staff" (facility-wide, not tied to a group)
  group_id uuid references public.biz_groups(id) on delete cascade,
  group_name text,
  folder_name text not null default '',
  subfolder_name text not null default '',
  document_name text not null,
  file_name text not null,
  file_type text not null default 'other',      -- pdf | docx | xlsx | pptx | img | other
  file_size_kb integer not null default 0,
  mime_type text,
  storage_path text,                            -- object key in `group-documents`
  uploaded_by text,                             -- uploader's email
  is_active boolean not null default true,      -- soft delete
  is_hidden boolean not null default false,     -- admin curation: hidden from members
  is_archived boolean not null default false,   -- admin curation: behind "View Archived"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists biz_group_documents_facility_idx
  on public.biz_group_documents (facility_id, is_active);
create index if not exists biz_group_documents_group_idx
  on public.biz_group_documents (group_id);

alter table public.biz_group_documents enable row level security;

-- Read: anyone in the facility (plus master_control for platform operations).
drop policy if exists "group docs: facility read" on public.biz_group_documents;
create policy "group docs: facility read" on public.biz_group_documents
  for select using (
    facility_id = public.get_user_facility_id()
    or public.is_master_control()
  );

-- Write: facility admin, or leader of the row's group. All-Staff rows
-- (group_id IS NULL) are facility-admin only.
drop policy if exists "group docs: admin insert" on public.biz_group_documents;
create policy "group docs: admin insert" on public.biz_group_documents
  for insert with check (
    facility_id = public.get_user_facility_id()
    and (
      public.is_facility_admin()
      or (group_id is not null and public.is_group_leader(group_id))
    )
  );

drop policy if exists "group docs: admin update" on public.biz_group_documents;
create policy "group docs: admin update" on public.biz_group_documents
  for update using (
    facility_id = public.get_user_facility_id()
    and (
      public.is_facility_admin()
      or (group_id is not null and public.is_group_leader(group_id))
    )
  ) with check (
    facility_id = public.get_user_facility_id()
    and (
      public.is_facility_admin()
      or (group_id is not null and public.is_group_leader(group_id))
    )
  );

-- Hard delete is only used to roll back a failed upload (row inserted but the
-- file never landed); normal removal is the is_active soft delete.
drop policy if exists "group docs: admin delete" on public.biz_group_documents;
create policy "group docs: admin delete" on public.biz_group_documents
  for delete using (
    facility_id = public.get_user_facility_id()
    and (
      public.is_facility_admin()
      or (group_id is not null and public.is_group_leader(group_id))
    )
  );

-- ── Storage ──────────────────────────────────────────────────────────────────
-- Private bucket; objects live at {facility_id}/{document_id}/{file_name}.
insert into storage.buckets (id, name, public, file_size_limit)
values ('group-documents', 'group-documents', false, 26214400)  -- 25 MB
on conflict (id) do nothing;

-- Read: any authenticated user whose facility matches the path's first segment.
drop policy if exists "group docs storage: facility read" on storage.objects;
create policy "group docs storage: facility read" on storage.objects
  for select using (
    bucket_id = 'group-documents'
    and (storage.foldername(name))[1] = public.get_user_facility_id()::text
  );

-- Write: only after the matching biz_group_documents row exists (inserted
-- under the table RLS above), and only by someone who could have written that
-- row — ties object writes to legitimately created documents.
drop policy if exists "group docs storage: admin write" on storage.objects;
create policy "group docs storage: admin write" on storage.objects
  for insert with check (
    bucket_id = 'group-documents'
    and (storage.foldername(name))[1] = public.get_user_facility_id()::text
    and exists (
      select 1 from public.biz_group_documents d
      where d.id::text = (storage.foldername(name))[2]
        and d.facility_id = public.get_user_facility_id()
        and (
          public.is_facility_admin()
          or (d.group_id is not null and public.is_group_leader(d.group_id))
        )
    )
  );
