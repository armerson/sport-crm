create table public.client_error_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  stack text check (stack is null or char_length(stack) <= 8000),
  source text check (source is null or char_length(source) <= 500),
  route text not null check (char_length(route) between 1 and 500),
  user_agent text check (user_agent is null or char_length(user_agent) <= 1000),
  app_version text check (app_version is null or char_length(app_version) <= 50),
  created_at timestamptz not null default now()
);

create index client_error_logs_created_at_idx
  on public.client_error_logs (created_at desc);
create index client_error_logs_user_created_at_idx
  on public.client_error_logs (user_id, created_at desc);

alter table public.client_error_logs enable row level security;

create policy "admins read client errors"
on public.client_error_logs
for select
to authenticated
using (public.is_admin());

revoke all on public.client_error_logs from public, anon, authenticated;
grant select on public.client_error_logs to authenticated;

create or replace function public.report_client_error(
  p_message text,
  p_stack text default null,
  p_source text default null,
  p_route text default '/',
  p_user_agent text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if nullif(trim(p_message), '') is null then
    return;
  end if;

  -- Prevent a broken browser session from flooding the database.
  if (
    select count(*)
    from public.client_error_logs
    where user_id = auth.uid()
      and created_at >= now() - interval '1 hour'
  ) >= 30 then
    return;
  end if;

  insert into public.client_error_logs (
    user_id,
    message,
    stack,
    source,
    route,
    user_agent,
    app_version
  ) values (
    auth.uid(),
    left(trim(p_message), 1000),
    nullif(left(coalesce(p_stack, ''), 8000), ''),
    nullif(left(coalesce(p_source, ''), 500), ''),
    left(coalesce(nullif(p_route, ''), '/'), 500),
    nullif(left(coalesce(p_user_agent, ''), 1000), ''),
    nullif(left(coalesce(p_app_version, ''), 50), '')
  );
end;
$$;

revoke all on function public.report_client_error(text, text, text, text, text, text)
  from public, anon;
grant execute on function public.report_client_error(text, text, text, text, text, text)
  to authenticated;
