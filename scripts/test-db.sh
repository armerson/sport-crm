#!/usr/bin/env bash
# Rebuilds the LOCAL Supabase database from every migration and runs the SQL
# permission tests. Never touches a hosted project.
#
# Needs Docker and the Supabase CLI. Start the stack first:
#   supabase start -x studio,imgproxy,logflare,vector,edge-runtime,supavisor,mailpit,postgres-meta
set -uo pipefail
cd "$(dirname "$0")/.."

supabase db reset --local >/dev/null || { echo "Migration replay failed. Run: supabase db reset --local"; exit 1; }
db=$(docker ps --format '{{.Names}}' | grep -x 'supabase_db_Sports-CRM' || true)
[ -n "$db" ] || { echo "Local Supabase database container not running."; exit 1; }

failed=0
for file in supabase/tests/*.sql; do
  name=$(basename "$file")
  [ "$name" = 00_qa_teardown.sql ] && continue # clean-up script, not a test
  # Every test runs in a transaction that is rolled back.
  if grep -qiE '^[[:space:]]*begin[[:space:]]*;' "$file"; then sql=$(cat "$file")
  else sql=$(printf 'begin;\n%s\nrollback;\n' "$(cat "$file")"); fi
  output=$(printf '%s\n' "$sql" | docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X 2>&1)
  if [ $? -ne 0 ] || grep -qE 'not ok|Looks like' <<<"$output"; then
    echo "FAIL $name"; grep -E 'ERROR|not ok|Looks like' <<<"$output" | head -5; failed=1
  else
    echo "ok   $name"
  fi
done
# A backend must refuse sessions signed by any other club's keys.
node scripts/test-club-isolation.mjs || failed=1
exit $failed
