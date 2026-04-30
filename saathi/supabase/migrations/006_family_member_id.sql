-- Add member_id to lab_reports
alter table lab_reports add column if not exists member_id uuid references family_members(id) on delete set null;
alter table lab_reports add column if not exists member_name text;

create index if not exists lab_reports_member_id_idx on lab_reports(member_id);