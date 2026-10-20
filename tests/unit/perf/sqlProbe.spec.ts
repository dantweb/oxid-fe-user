// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PREDICATES,
  PROBE_CSV_HEADER,
  explainStatement,
  parseExplain,
  parseStats,
  probeStatement,
  toProbeCsvRow,
} from '../../../scripts/perf/search-index/sqlProbe';

describe('probe statement', () => {
  it('is the shop GraphQL product list query with the title predicate swapped in', () => {
    const sql = probeStatement(PREDICATES.titleContains, 'U-shape AlTi');
    expect(sql).toMatch(
      /^\/\* sprint17-probe \*\/ SELECT oxv_oxarticles_1_de\.OXID FROM oxv_oxarticles_1_de WHERE/,
    );
    expect(sql).toContain('oxv_oxarticles_1_de.oxactive = 1');
    expect(sql).toContain("AND (oxv_oxarticles_1_de.OXTITLE LIKE '%U-shape AlTi%')");
    expect(sql).toContain("AND (oxv_oxarticles_1_de.OXPARENTID = '')");
    expect(sql).toMatch(/ORDER BY oxv_oxarticles_1_de\.oxsort ASC LIMIT 5$/);
  });

  it.each([
    ['titleBeginsWith', "oxv_oxarticles_1_de.OXTITLE LIKE 'metal rod U%'"],
    ['shortDescContains', "oxv_oxarticles_1_de.OXSHORTDESC LIKE '%metal rod U%'"],
    ['titleMatch', `MATCH (oxv_oxarticles_1_de.OXTITLE) AGAINST ('"metal rod U"' IN BOOLEAN MODE)`],
  ] as const)('%s becomes %s', (predicate, sql) => {
    expect(probeStatement(PREDICATES[predicate], 'metal rod U')).toContain(`AND (${sql})`);
  });

  it('escapes quotes and backslashes in the term', () => {
    expect(probeStatement(PREDICATES.titleContains, "it's\\")).toContain("LIKE '%it\\'s\\\\%'");
  });

  it('explains the same statement', () => {
    expect(explainStatement('SELECT 1')).toBe('EXPLAIN SELECT 1');
  });
});

describe('reading MySQL output', () => {
  it('takes time (picoseconds → ms) and rows examined from the statement history line', () => {
    expect(parseStats('a\nb\n1234567890000\t5000243\n')).toEqual({
      ms: 1234.56789,
      rowsExamined: 5000243,
    });
  });

  it('summarizes the plan as table:access:key per row', () => {
    const explain = [
      '1\tSIMPLE\tt2s\tNULL\tref\tOXMAPIDX\tOXMAPIDX\t4\tconst\t1\t100.00\tUsing index',
      '1\tSIMPLE\toxarticles\tNULL\tALL\tNULL\tNULL\tNULL\tNULL\t4990000\t1.11\tUsing where',
    ].join('\n');
    expect(parseExplain(explain)).toBe('t2s:ref:OXMAPIDX | oxarticles:ALL:-');
  });
});

describe('probe CSV', () => {
  it('writes one row per run, predicate and term', () => {
    expect(PROBE_CSV_HEADER).toBe('run,predicate,term,cold_ms,warm_ms,rows_examined,plan,failure');
    expect(
      toProbeCsvRow('none', 'titleContains', 'Zn', {
        coldMs: 12000.04,
        warmMs: 9000.06,
        rowsExamined: 5000243,
        plan: 'oxarticles:ALL:-',
        failure: null,
      }),
    ).toBe('none,titleContains,"Zn",12000,9000.1,5000243,"oxarticles:ALL:-",');
  });
});
