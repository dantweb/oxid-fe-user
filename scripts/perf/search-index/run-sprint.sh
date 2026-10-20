#!/usr/bin/env bash
# Sprint 17, S5: the three measured runs on the loaded example_perf: none → btree → fulltext.
# Each run starts on a restarted MySQL (empty buffer pool, the SDK's own settings) and first checks
# that the schema holds exactly the indexes of that run.
#   scripts/perf/search-index/run-sprint.sh [raw dir, default test-results/performance/raw]
# Working data (CSV, logs) stays under test-results/ (gitignored; Playwright empties it on e2e runs).
set -euo pipefail

RAW="${1:-test-results/performance/raw}"
SDK_DIR="${SDK_DIR:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
export PERF_GRAPHQL_URL="${PERF_GRAPHQL_URL:-http://localhost:8094/graphql/}"
JITI=(npx jiti scripts/perf/search-index)
COMPOSE=(docker compose --project-directory "$SDK_DIR")
mkdir -p "$RAW"

restart_mysql() {
  "${COMPOSE[@]}" restart mysql >/dev/null
  until "${COMPOSE[@]}" exec -T mysql mysqladmin -uroot -proot ping --silent 2>/dev/null; do sleep 1; done
}

measure() {
  local run="$1"
  restart_mysql
  PERF_INDEXES="$run" npx vitest run tests/unit/perf/indexState.spec.ts
  "${JITI[@]}/run-benchmark.ts" --run "$run" --out "$RAW"
}

record_environment() {
  "${COMPOSE[@]}" exec -T mysql mysql -uroot -proot -N -B example_perf -e "
    SELECT JSON_OBJECT(
      'mysql', @@version, 'innodb_buffer_pool_size', @@innodb_buffer_pool_size,
      'innodb_ft_min_token_size', @@innodb_ft_min_token_size, 'innodb_redo_log_capacity', @@innodb_redo_log_capacity,
      'oxarticles_rows', (SELECT COUNT(*) FROM oxarticles),
      'rod_rows', (SELECT COUNT(*) FROM oxarticles WHERE OXARTNUM LIKE 'ROD-%'),
      'oxarticles_bytes', (SELECT DATA_LENGTH + INDEX_LENGTH FROM information_schema.TABLES
                           WHERE TABLE_SCHEMA = 'example_perf' AND TABLE_NAME = 'oxarticles'),
      'host_cpus', $(nproc), 'host_ram_mib', $(free -m | awk '/^Mem:/ {print $2}'),
      'host_cpu', '$(lscpu | sed -n 's/^Model name: *//p' | head -1)')" 2>/dev/null > "$RAW/environment.json"
}

# RUNS="btree fulltext" continues after a finished baseline.
for run in ${RUNS:-none btree fulltext}; do
  if [ "$run" = none ]; then
    restart_mysql
    record_environment
    measure none
    continue
  fi
  "${JITI[@]}/migrate.ts" up "$run" --csv "$RAW/indexes.csv"
  measure "$run"
  "${JITI[@]}/migrate.ts" down "$run"
done
echo "all runs written to $RAW"
