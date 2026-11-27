-- Safeguarded communications: parents receive broadcasts but may only write
-- private messages to authorised coaches and named club contacts.

begin;

create table public.club_contact_assignments (
  contact_type text primary key check (contact_type in ('finance', 'kit', 'welfare')),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.club_contact_assignments enable row level security;
revoke all on public.club_contact_assignments from public, anon, authenticated;
grant select, insert, update, delete on public.club_contact_assignments to authenticated;
create policy club_contacts_read on public.club_contact_assignments for select to authenticated using (true);
create policy club_contacts_admin_manage on public.club_contact_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.messages
  add column recipient_id uuid references public.profiles(id) on delete cascade;
create index messages_direct_sender_created_idx on public.messages(sender_id, created_at desc) where recipient_id is not null;
create index messages_direct_recipient_created_idx on public.messages(recipient_id, created_at desc) where recipient_id is not null;

alter table public.messages add constraint messages_delivery_shape_check check (
  (recipient_id is null)
  or (group_id is null and recipient_id <> sender_id)
);

create or replace function crm_private.parent_staff_pair_allowed(p_parent uuid, p_staff uuid, p_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select
    exists(select 1 from public.profiles where id=p_parent and 'parent'=any(roles))
    and (
      exists(select 1 from public.club_contact_assignments where profile_id=p_staff)
      or (
        p_team is not null
        and exists(select 1 from public.team_coaches where coach_id=p_staff and team_id=p_team)
        and exists(
          select 1 from public.player_parents pp
          join public.player_teams pt on pt.player_id=pp.player_id
          where pp.parent_id=p_parent and pt.team_id=p_team
        )
      )
    );
$$;
revoke all on function crm_private.parent_staff_pair_allowed(uuid,uuid,uuid) from public, anon;
grant execute on function crm_private.parent_staff_pair_allowed(uuid,uuid,uuid) to authenticated, service_role;

drop policy if exists messages_read on public.messages;
drop policy if exists messages_insert on public.messages;
create policy messages_read on public.messages for select to authenticated using (
  case when recipient_id is not null
    then sender_id=auth.uid() or recipient_id=auth.uid()
    else crm_private.can_read_message(team_id,group_id)
  end
);
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id=auth.uid() and (
    (recipient_id is null and (
      public.is_admin()
      or (team_id is not null and group_id is null and public.is_coach_for_team(team_id))
    ))
    or
    (recipient_id is not null and group_id is null and (
      public.is_admin()
      or crm_private.parent_staff_pair_allowed(auth.uid(),recipient_id,team_id)
      or crm_private.parent_staff_pair_allowed(recipient_id,auth.uid(),team_id)
    ))
  )
);

create or replace function crm_private.can_read_profile(p_profile uuid)
returns boolean language sql stable security definer set search_path = public
as $$
 select auth.uid() is not null and (
  p_profile=auth.uid() or public.is_admin()
  or exists(select 1 from public.player_parents pp join public.player_teams pt using(player_id)
    where pp.parent_id=p_profile and public.is_coach_for_team(pt.team_id))
  or exists(select 1 from public.profiles p join public.player_teams pt on pt.player_id=p.linked_player_id
    where p.id=p_profile and public.is_coach_for_team(pt.team_id))
  or exists(select 1 from public.team_coaches tc where tc.coach_id=p_profile and crm_private.can_access_team(tc.team_id))
  or exists(select 1 from public.club_contact_assignments cca where cca.profile_id=p_profile)
  or exists(select 1 from public.messages m where m.sender_id=p_profile and (
    (m.recipient_id is not null and (m.sender_id=auth.uid() or m.recipient_id=auth.uid()))
    or (m.recipient_id is null and crm_private.can_read_message(m.team_id,m.group_id))
  ))
  or exists(select 1 from public.messages m where m.recipient_id=p_profile and m.sender_id=auth.uid())
 );
$$;

alter table public.posts add column allow_reactions boolean not null default true;
alter table public.posts add column allow_comments boolean not null default true;

drop policy if exists "authenticated insert own like" on public.post_likes;
create policy "authenticated insert own like" on public.post_likes for insert to authenticated
  with check (profile_id=auth.uid() and exists(select 1 from public.posts p where p.id=post_id and p.allow_reactions));
drop policy if exists "authenticated insert post comment" on public.post_comments;
create policy "authenticated insert post comment" on public.post_comments for insert to authenticated
  with check (author_id=auth.uid() and exists(select 1 from public.posts p where p.id=post_id and p.allow_comments));

comment on table public.club_contact_assignments is 'Named parent-contact responsibilities using existing ClubOS profiles.';
comment on column public.messages.recipient_id is 'When set, this is a private one-to-one message rather than a broadcast.';

commit;
