-- NOCOSU 家族の輪（最小版）
-- 輪 / メンバー / 輪に送った答え / 既読・ありがとう
-- 参照用の写し。実体は Supabase の migrations に apply_migration で適用済み。

create extension if not exists pgcrypto;

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.shared_answers (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  local_answer_id text not null,
  question_id text not null,
  question_text text not null,
  text text not null,               -- 本文。サーバー側でも一切加工しない
  dialogue jsonb,
  read_when text,
  answered_on date not null,
  created_at timestamptz not null default now(),
  unique (circle_id, user_id, local_answer_id)
);
create index if not exists shared_answers_circle_created_idx on public.shared_answers (circle_id, created_at desc);

create table if not exists public.answer_reads (
  shared_answer_id uuid not null references public.shared_answers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('read', 'thanks')),
  created_at timestamptz not null default now(),
  primary key (shared_answer_id, user_id)
);

-- 自分がその輪のメンバーか（RLS の再帰を避けるため security definer）
create or replace function public.is_circle_member(c uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = c and m.user_id = auth.uid()
  );
$$;

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.shared_answers enable row level security;
alter table public.answer_reads enable row level security;

drop policy if exists circles_select on public.circles;
create policy circles_select on public.circles for select to authenticated using (public.is_circle_member(id));

drop policy if exists members_select on public.circle_members;
create policy members_select on public.circle_members for select to authenticated using (public.is_circle_member(circle_id));

drop policy if exists shared_select on public.shared_answers;
create policy shared_select on public.shared_answers for select to authenticated using (public.is_circle_member(circle_id));
drop policy if exists shared_insert on public.shared_answers;
create policy shared_insert on public.shared_answers for insert to authenticated
  with check (user_id = auth.uid() and public.is_circle_member(circle_id));
drop policy if exists shared_update on public.shared_answers;
create policy shared_update on public.shared_answers for update to authenticated using (user_id = auth.uid());
drop policy if exists shared_delete on public.shared_answers;
create policy shared_delete on public.shared_answers for delete to authenticated using (user_id = auth.uid());

drop policy if exists reads_select on public.answer_reads;
create policy reads_select on public.answer_reads for select to authenticated using (
  exists (select 1 from public.shared_answers s where s.id = shared_answer_id and public.is_circle_member(s.circle_id))
);
drop policy if exists reads_insert on public.answer_reads;
create policy reads_insert on public.answer_reads for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.shared_answers s where s.id = shared_answer_id and public.is_circle_member(s.circle_id))
);
drop policy if exists reads_update on public.answer_reads;
create policy reads_update on public.answer_reads for update to authenticated using (user_id = auth.uid());

-- 輪を作る（招待コードを発行して自分をメンバーに）
create or replace function public.create_circle(p_name text, p_display_name text)
returns public.circles
language plpgsql security definer
set search_path = public
as $$
declare
  v_code text;
  v_circle public.circles;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.circles where invite_code = v_code);
  end loop;
  insert into public.circles (name, invite_code, created_by)
    values (coalesce(nullif(trim(p_name), ''), '家族の輪'), v_code, auth.uid())
    returning * into v_circle;
  insert into public.circle_members (circle_id, user_id, display_name)
    values (v_circle.id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'わたし'));
  return v_circle;
end;
$$;

-- 輪に入る（招待コードで）
create or replace function public.join_circle(p_code text, p_display_name text)
returns public.circles
language plpgsql security definer
set search_path = public
as $$
declare
  v_circle public.circles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_circle from public.circles where invite_code = upper(trim(p_code));
  if not found then raise exception 'invalid code'; end if;
  insert into public.circle_members (circle_id, user_id, display_name)
    values (v_circle.id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'わたし'))
    on conflict (circle_id, user_id) do update set display_name = excluded.display_name;
  return v_circle;
end;
$$;

revoke all on function public.create_circle(text, text) from public, anon;
revoke all on function public.join_circle(text, text) from public, anon;
grant execute on function public.create_circle(text, text) to authenticated;
grant execute on function public.join_circle(text, text) to authenticated;
grant execute on function public.is_circle_member(uuid) to authenticated;
