#!/usr/bin/env bash
# Sprint 17, S1: copies the demo shop database `example` into `example_perf` (tables and oxv_* views)
# and adds the marker article that proves which database an entry point serves. Re-running starts over.
set -euo pipefail

SDK_DIR="${SDK_DIR:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
MYSQL=(docker compose --project-directory "$SDK_DIR" exec -T mysql)

"${MYSQL[@]}" mysql -uroot -proot -e 'DROP DATABASE IF EXISTS example_perf; CREATE DATABASE example_perf CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci'
"${MYSQL[@]}" sh -c 'mysqldump -uroot -proot --single-transaction --routines --triggers example | mysql -uroot -proot example_perf'
# The shop's own rows carry zero dates (OXUPDATEPRICETIME); strict mode is relaxed for this session only.
"${MYSQL[@]}" mysql -uroot -proot example_perf -e "
  SET SESSION sql_mode = '';
  INSERT INTO oxarticles (OXID, OXSHOPID, OXACTIVE, OXARTNUM, OXTITLE, OXSHORTDESC, OXPRICE, OXSTOCK, OXSTOCKFLAG, OXPARENTID)
  VALUES ('perf0000000000000000000000marker', 1, 1, 'PERF-MARKER', 'sprint17 perf marker', '', 1, 1, 1, '');
  -- the shop views (oxv_oxarticles_1_*) join oxarticles2shop on OXMAPID: unmapped articles are invisible
  INSERT INTO oxarticles2shop (OXSHOPID, OXMAPOBJECTID) SELECT 1, OXMAPID FROM oxarticles WHERE OXARTNUM = 'PERF-MARKER'"
echo "example_perf cloned from example (+ marker)"
