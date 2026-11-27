#!/usr/bin/env bash
# Rebuilds the LOCAL ClubOS control-plane database (control-plane/supabase) and
# runs its permission tests. Never touches a hosted project.
#
# The control plane is its own Supabase project, so it runs as a second local
# stack on ports 546xx. Start it first:
#   supabase start --workdir control-plane -x studio,imgproxy,logflare,vector,edge-runtime,supavisor,mailpit,postgres-meta,storage-api,realtime
set -uo pipefail
cd "$(dirname "$0")/.."

supabase db reset --local --workdir control-plane >/dev/null || { echo "Control-plane migration replay failed."; exit 1; }
db=$(docker ps --format '{{.Names}}' | grep -x 'supabase_db_clubos-control-plane' || true)
[ -n "$db" ] || { echo "Local control-plane database container not running."; exit 1; }

failed=0
for file in control-plane/supabase/tests/*.sql; do
  name=$(basename "$file")
  output=$(printf 'begin;\n%s\nrollback;\n' "$(cat "$file")" | docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X 2>&1)
  if [ $? -ne 0 ]; then
    echo "FAIL $name"; grep -E 'ERROR' <<<"$output" | head -5; failed=1
  else
    echo "ok   $name"
  fi
done
exit $failed
