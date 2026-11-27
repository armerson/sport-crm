-- Match statistics are private club data about children. Always run inside BEGIN / ROLLBACK.
-- Team A: coach, parent of a child, adult player. Team B: an unrelated parent.
insert into auth.users(id,email) values
 ('5a7a0000-0000-4000-8000-000000000001','stats-admin@example.invalid'),
 ('5a7a0000-0000-4000-8000-000000000002','stats-coach@example.invalid'),
 ('5a7a0000-0000-4000-8000-000000000003','stats-parent@example.invalid'),
 ('5a7a0000-0000-4000-8000-000000000004','stats-outsider@example.invalid');
insert into public.profiles(id,name,email,roles) values
 ('5a7a0000-0000-4000-8000-000000000001','STATS TEST admin','stats-admin@example.invalid',array['admin']),
 ('5a7a0000-0000-4000-8000-000000000002','STATS TEST coach','stats-coach@example.invalid',array['coach']),
 ('5a7a0000-0000-4000-8000-000000000003','STATS TEST parent','stats-parent@example.invalid',array['parent']),
 ('5a7a0000-0000-4000-8000-000000000004','STATS TEST outsider','stats-outsider@example.invalid',array['parent']);
insert into public.teams(id,name,age_group) values
 ('5a7a0000-0000-4000-8000-00000000000a','STATS TEST Team A','U12'),
 ('5a7a0000-0000-4000-8000-00000000000b','STATS TEST Team B','U13');
insert into public.players(id,name,dob,status) values
 ('5a7a0000-0000-4000-8000-000000000010','STATS TEST Child A','2014-01-01','active'),
 ('5a7a0000-0000-4000-8000-000000000011','STATS TEST Teammate A','2014-02-01','active'),
 ('5a7a0000-0000-4000-8000-000000000012','STATS TEST Child B','2013-01-01','active');
insert into public.player_parents(player_id,parent_id) values
 ('5a7a0000-0000-4000-8000-000000000010','5a7a0000-0000-4000-8000-000000000003'),
 ('5a7a0000-0000-4000-8000-000000000012','5a7a0000-0000-4000-8000-000000000004');
insert into public.player_teams(player_id,team_id) values
 ('5a7a0000-0000-4000-8000-000000000010','5a7a0000-0000-4000-8000-00000000000a'),
 ('5a7a0000-0000-4000-8000-000000000011','5a7a0000-0000-4000-8000-00000000000a'),
 ('5a7a0000-0000-4000-8000-000000000012','5a7a0000-0000-4000-8000-00000000000b');
insert into public.team_coaches(team_id,coach_id) values ('5a7a0000-0000-4000-8000-00000000000a','5a7a0000-0000-4000-8000-000000000002');
insert into public.events(id,team_id,title,type,date_time,location) values
 ('5a7a0000-0000-4000-8000-0000000000e1','5a7a0000-0000-4000-8000-00000000000a','STATS TEST Match A','match',now(),'Test'),
 ('5a7a0000-0000-4000-8000-0000000000e2','5a7a0000-0000-4000-8000-00000000000b','STATS TEST Match B','match',now(),'Test');
insert into public.player_match_stats(id,event_id,player_id,team_id,goals) values
 ('5a7a0000-0000-4000-8000-0000000000a1','5a7a0000-0000-4000-8000-0000000000e1','5a7a0000-0000-4000-8000-000000000010','5a7a0000-0000-4000-8000-00000000000a',2),
 ('5a7a0000-0000-4000-8000-0000000000b1','5a7a0000-0000-4000-8000-0000000000e2','5a7a0000-0000-4000-8000-000000000012','5a7a0000-0000-4000-8000-00000000000b',1);

-- The table must keep row level security and never return to an open read policy.
do $$ begin if not (select relrowsecurity from pg_class where oid='public.player_match_stats'::regclass) then raise exception 'FAILED: player_match_stats has RLS enabled'; end if; end $$;
do $$ begin if exists(select 1 from pg_policies where schemaname='public' and tablename='player_match_stats' and (qual='true' or 'anon'=any(roles) or 'public'=any(roles))) then raise exception 'FAILED: no open or anonymous policy on player_match_stats'; end if; end $$;

set local role anon; select set_config('request.jwt.claim.sub','',true);
do $$ begin begin perform 1 from public.player_match_stats limit 1; raise exception 'FAILED: anonymous cannot read match stats'; exception when insufficient_privilege then null; end; end $$;

reset role; set local role authenticated; select set_config('request.jwt.claim.sub','5a7a0000-0000-4000-8000-000000000003',true);
do $$ begin if (select count(*) from public.player_match_stats where team_id in ('5a7a0000-0000-4000-8000-00000000000a','5a7a0000-0000-4000-8000-00000000000b')) <> 1 or not exists(select 1 from public.player_match_stats where id='5a7a0000-0000-4000-8000-0000000000a1') then raise exception 'FAILED: parent sees only own team stats'; end if; end $$;
do $$ begin begin insert into public.player_match_stats(event_id,player_id,team_id,goals) values ('5a7a0000-0000-4000-8000-0000000000e1','5a7a0000-0000-4000-8000-000000000011','5a7a0000-0000-4000-8000-00000000000a',5); raise exception 'FAILED: parent cannot record stats'; exception when insufficient_privilege then null; end; end $$;
update public.player_match_stats set goals=9 where id='5a7a0000-0000-4000-8000-0000000000a1';
do $$ begin if (select goals from public.player_match_stats where id='5a7a0000-0000-4000-8000-0000000000a1') <> 2 then raise exception 'FAILED: parent cannot change stats'; end if; end $$;

select set_config('request.jwt.claim.sub','5a7a0000-0000-4000-8000-000000000004',true);
do $$ begin if (select count(*) from public.player_match_stats where team_id in ('5a7a0000-0000-4000-8000-00000000000a','5a7a0000-0000-4000-8000-00000000000b')) <> 1 or not exists(select 1 from public.player_match_stats where id='5a7a0000-0000-4000-8000-0000000000b1') then raise exception 'FAILED: unrelated parent cannot see another team''s stats'; end if; end $$;

select set_config('request.jwt.claim.sub','5a7a0000-0000-4000-8000-000000000002',true);
-- The app's upsert: insert then update on the (event, player) key.
insert into public.player_match_stats(event_id,player_id,team_id,goals,assists) values ('5a7a0000-0000-4000-8000-0000000000e1','5a7a0000-0000-4000-8000-000000000011','5a7a0000-0000-4000-8000-00000000000a',1,0)
 on conflict (event_id,player_id) do update set goals=excluded.goals, assists=excluded.assists;
insert into public.player_match_stats(event_id,player_id,team_id,goals,assists) values ('5a7a0000-0000-4000-8000-0000000000e1','5a7a0000-0000-4000-8000-000000000011','5a7a0000-0000-4000-8000-00000000000a',3,1)
 on conflict (event_id,player_id) do update set goals=excluded.goals, assists=excluded.assists;
do $$ begin if not exists(select 1 from public.player_match_stats where event_id='5a7a0000-0000-4000-8000-0000000000e1' and player_id='5a7a0000-0000-4000-8000-000000000011' and goals=3 and assists=1 and created_by='5a7a0000-0000-4000-8000-000000000002') then raise exception 'FAILED: coach records and updates own team stats'; end if; end $$;
do $$ begin if exists(select 1 from public.player_match_stats where team_id='5a7a0000-0000-4000-8000-00000000000b') then raise exception 'FAILED: coach sees only own team stats'; end if; end $$;
do $$ begin begin insert into public.player_match_stats(event_id,player_id,team_id) values ('5a7a0000-0000-4000-8000-0000000000e2','5a7a0000-0000-4000-8000-000000000012','5a7a0000-0000-4000-8000-00000000000b'); raise exception 'FAILED: coach cannot record another team''s stats'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.player_match_stats(event_id,player_id,team_id) values ('5a7a0000-0000-4000-8000-0000000000e2','5a7a0000-0000-4000-8000-000000000010','5a7a0000-0000-4000-8000-00000000000a'); raise exception 'FAILED: stats must belong to a match of the same team'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.player_match_stats(event_id,player_id,team_id) values ('5a7a0000-0000-4000-8000-0000000000e1','5a7a0000-0000-4000-8000-000000000012','5a7a0000-0000-4000-8000-00000000000a'); raise exception 'FAILED: coach cannot record a player outside the squad'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin update public.player_match_stats set team_id='5a7a0000-0000-4000-8000-00000000000b' where id='5a7a0000-0000-4000-8000-0000000000a1'; raise exception 'FAILED: coach cannot move stats to another team'; exception when insufficient_privilege then null; end; end $$;
update public.player_match_stats set goals=9 where id='5a7a0000-0000-4000-8000-0000000000b1';
delete from public.player_match_stats where id='5a7a0000-0000-4000-8000-0000000000b1';

reset role; select set_config('request.jwt.claim.sub','',true);
do $$ begin if (select goals from public.player_match_stats where id='5a7a0000-0000-4000-8000-0000000000b1') is distinct from 1 then raise exception 'FAILED: coach cannot change or delete another team''s stats'; end if; end $$;

set local role authenticated; select set_config('request.jwt.claim.sub','5a7a0000-0000-4000-8000-000000000001',true);
update public.player_match_stats set red_cards=1 where id='5a7a0000-0000-4000-8000-0000000000b1';
do $$ begin if (select count(*) from public.player_match_stats where team_id in ('5a7a0000-0000-4000-8000-00000000000a','5a7a0000-0000-4000-8000-00000000000b')) <> 3 or (select red_cards from public.player_match_stats where id='5a7a0000-0000-4000-8000-0000000000b1') <> 1 then raise exception 'FAILED: admin sees and corrects all stats'; end if; end $$;
reset role;
