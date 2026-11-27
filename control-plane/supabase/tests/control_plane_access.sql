-- Control plane permissions. Always run inside BEGIN / ROLLBACK.
-- An operator, a signed-in non-operator and the public.
insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000001','cp-operator@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000002','cp-member@example.invalid');
insert into public.platform_admins(user_id) values ('c0de0000-0000-4000-8000-000000000001');
insert into public.clubs(code,name,status,town,primary_color,supabase_url,anon_key,plan,operator_notes) values
 ('cp-test-active','CP TEST Active','active','Belfast','#17466e','https://clubaaaaaaaaaaaaaaaa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdWJhYWFhYWFhYWFhYWFhYWFhIiwicm9sZSI6ImFub24ifQ.sig','club','private note'),
 ('cp-test-onboarding','CP TEST Onboarding','onboarding',null,null,null,null,null,null),
 ('cp-test-suspended','CP TEST Suspended','suspended',null,null,'https://clubbbbbbbbbbbbbbbbb.supabase.co','sb_publishable_testkey',null,null);
insert into public.onboarding_applications(id,club_name,contact_name,contact_email) values
 ('c0de0000-0000-4000-8000-0000000000a1','CP TEST Applicant','Pat Example','pat@example.invalid');

-- Data rules: secret keys never enter the directory.
do $$ begin begin update public.clubs set anon_key='sb_secret_abc' where code='cp-test-suspended'; raise exception 'FAILED: secret key rejected'; exception when check_violation then null; end; end $$;
do $$ begin begin update public.clubs set anon_key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdWJhYWFhYWFhYWFhYWFhYWFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.sig' where code='cp-test-active'; raise exception 'FAILED: service_role key rejected'; exception when check_violation then null; end; end $$;
do $$ begin begin update public.clubs set anon_key='not-a-key' where code='cp-test-active'; raise exception 'FAILED: malformed key rejected'; exception when check_violation then null; end; end $$;
do $$ begin begin update public.clubs set supabase_url='http://evil.example' where code='cp-test-active'; raise exception 'FAILED: non-https backend rejected'; exception when check_violation then null; end; end $$;
do $$ begin begin update public.clubs set supabase_url='https://clubaaaaaaaaaaaaaaaa.supabase.co' where code='cp-test-suspended'; raise exception 'FAILED: clubs cannot share a backend'; exception when unique_violation then null; end; end $$;
do $$ begin begin update public.clubs set status='active' where code='cp-test-onboarding'; raise exception 'FAILED: active club needs an origin or backend'; exception when check_violation then null; end; end $$;
do $$ begin begin insert into public.clubs(code,name) values ('A','Bad code'); raise exception 'FAILED: invalid club code rejected'; exception when check_violation then null; end; end $$;

-- RLS stays on everywhere.
do $$ begin if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then raise exception 'FAILED: every control plane table has RLS'; end if; end $$;

-- The public: reads only the active directory and can only apply.
set local role anon; select set_config('request.jwt.claim.sub','',true);
do $$ begin if (select count(*) from public.clubs_public where code like 'cp-test-%') <> 1 then raise exception 'FAILED: public directory lists only active clubs'; end if; end $$;
do $$ begin if (select entry::text from public.clubs_public where code='cp-test-active') like '%private note%' then raise exception 'FAILED: operator notes stay private'; end if; end $$;
do $$ begin if (select entry->'backend'->>'supabaseUrl' from public.clubs_public where code='cp-test-active') <> 'https://clubaaaaaaaaaaaaaaaa.supabase.co' or (select entry->'branding'->>'primaryColor' from public.clubs_public where code='cp-test-active') <> '#17466e' then raise exception 'FAILED: directory entry has registry shape'; end if; end $$;
do $$ begin begin perform 1 from public.clubs limit 1; raise exception 'FAILED: public cannot read clubs table'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin perform 1 from public.onboarding_applications limit 1; raise exception 'FAILED: public cannot read applications'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin perform 1 from public.support_access_log limit 1; raise exception 'FAILED: public cannot read support log'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin perform 1 from public.platform_admins limit 1; raise exception 'FAILED: public cannot list operators'; exception when insufficient_privilege then null; end; end $$;
insert into public.onboarding_applications(club_name,contact_name,contact_email,payment_methods) values ('CP TEST Public apply','Sam Example','sam@example.invalid',array['card','standing_order']);
do $$ begin begin insert into public.onboarding_applications(club_name,contact_name,contact_email,status) values ('CP TEST Self approve','Sam','sam@example.invalid','approved'); raise exception 'FAILED: applicant cannot self-approve'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.onboarding_applications(club_name,contact_name,contact_email,club_code) values ('CP TEST Claim','Sam','sam@example.invalid','cp-test-active'); raise exception 'FAILED: applicant cannot claim a club'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.clubs(code,name) values ('cp-test-forged','Forged'); raise exception 'FAILED: public cannot add clubs'; exception when insufficient_privilege then null; end; end $$;

-- A signed-in person who is not an operator gets nothing extra.
reset role; set local role authenticated; select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from public.clubs) or exists(select 1 from public.onboarding_applications) or exists(select 1 from public.platform_admins) then raise exception 'FAILED: non-operator sees no operator data'; end if; end $$;
update public.clubs set status='suspended' where code='cp-test-active';
do $$ begin begin insert into public.platform_admins(user_id) values ('c0de0000-0000-4000-8000-000000000002'); raise exception 'FAILED: cannot make self an operator'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.support_access_log(club_code,reason,scope) values ('cp-test-active','Looking at the club for no reason','read_only'); raise exception 'FAILED: non-operator cannot log support access'; exception when insufficient_privilege then null; end; end $$;
do $$ begin if (select count(*) from public.clubs_public where code='cp-test-active') <> 1 then raise exception 'FAILED: non-operator cannot suspend a club'; end if; end $$;

-- An operator manages clubs and applications, and records support access.
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000001',true);
do $$ begin if (select count(*) from public.clubs where code like 'cp-test-%') <> 3 or (select count(*) from public.onboarding_applications where club_name like 'CP TEST %') <> 2 then raise exception 'FAILED: operator sees all clubs and applications'; end if; end $$;
update public.onboarding_applications set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where id='c0de0000-0000-4000-8000-0000000000a1';
update public.clubs set status='active', origin='https://cp-test-onboarding.example' where code='cp-test-onboarding';
do $$ begin if (select count(*) from public.clubs_public where code like 'cp-test-%') <> 2 then raise exception 'FAILED: operator activates a club'; end if; end $$;
insert into public.club_domains(club_code,domain,kind) values ('cp-test-active','crm.cp-test.example','app');
insert into public.support_access_log(club_code,reason,scope,approved_by_club) values ('cp-test-active','Club asked for help fixing a fee','configuration','Club secretary');
do $$ begin begin insert into public.support_access_log(operator_id,club_code,reason,scope) values ('c0de0000-0000-4000-8000-000000000002','cp-test-active','Logging access as someone else','read_only'); raise exception 'FAILED: operator logs only as self'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.support_access_log(club_code,reason,scope,ends_at) values ('cp-test-active','Open-ended access request','read_only',now()+interval '3 days'); raise exception 'FAILED: support access is time-limited'; exception when check_violation then null; end; end $$;
do $$ begin begin update public.support_access_log set reason='Changed afterwards for cover'; raise exception 'FAILED: support log is append-only (update)'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin delete from public.support_access_log; raise exception 'FAILED: support log is append-only (delete)'; exception when insufficient_privilege then null; end; end $$;
reset role;
