# ClubOS control plane

Operator-owned Supabase project holding the club directory, onboarding
applications, operators and the support access log. It never holds member,
child, payment or safeguarding records; those stay in each club's own backend.
See [ADR 0001](../docs/adr/0001-club-isolation-model.md),
[ARCHITECTURE.md](../ARCHITECTURE.md#control-plane) and [SECURITY.md](../SECURITY.md).

Local (ports 546xx, alongside a club stack on 543xx):

```bash
supabase start --workdir control-plane -x studio,imgproxy,logflare,vector,edge-runtime,supavisor,mailpit,postgres-meta,storage-api,realtime
npm run test:control-plane
```

Operators are added with the service role only:
`insert into public.platform_admins(user_id) values ('<auth user id>');`
