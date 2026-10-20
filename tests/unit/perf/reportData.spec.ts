// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  comparisonTable,
  missingReason,
  graphqlChart,
  indexCostTable,
  parseCsv,
  probeChart,
  scenarioLabel,
} from '../../../scripts/perf/search-index/reportData';

const graphqlCsv = [
  'run,scenario,term,limit,offset,n,cold_ms,p50_ms,p95_ms,p99_ms,min_ms,max_ms,rows_returned,failure',
  'none,typing,"me",5,0,30,900,400,420,430,390,431,5,',
  'btree,typing,"me",5,0,30,800,350,380,390,340,391,5,',
  'none,page-last,"L-shape",13,228,5,9000,8000,8500,8600,7900,8610,13,',
].join('\n');

const probeCsv = [
  'run,predicate,term,cold_ms,warm_ms,rows_examined,plan,failure',
  'none,titleContains,"Zn",120,100,5000000,"oxarticles:ALL:-",',
  'none,titleMatch,"Zn",0,0,0,"","ERROR 1191, no FULLTEXT index"',
  'fulltext,titleMatch,"Zn",3,2,0,"oxarticles:fulltext:OXTITLE_FT",',
].join('\n');

describe('CSV parsing', () => {
  it('reads quoted fields with commas and doubled quotes', () => {
    expect(parseCsv('a,b\n"x, ""y""",2\n')).toEqual([{ a: 'x, "y"', b: '2' }]);
  });
});

describe('GraphQL chart', () => {
  it('has one group per scenario and term, in first-seen order', () => {
    const chart = graphqlChart(parseCsv(graphqlCsv), ['none', 'btree', 'fulltext']);
    expect(chart.groups.map((group) => group.label)).toEqual([
      'typing “me”',
      'page-last “L-shape” p20',
    ]);
  });

  it('draws p50 as the bar and p95 as the whisker per run', () => {
    const chart = graphqlChart(parseCsv(graphqlCsv), ['none', 'btree', 'fulltext']);
    expect(chart.groups[0].bars).toEqual([
      { series: 'no index', value: 400, whisker: 420 },
      { series: 'B-tree index', value: 350, whisker: 380 },
    ]);
  });

  it('labels results pages by their page number', () => {
    expect(scenarioLabel('page-first', 'L-shape', 0)).toBe('page-first “L-shape” p1');
  });
});

describe('probe charts', () => {
  it('uses the warm time, and n/a where the predicate failed', () => {
    const chart = probeChart(parseCsv(probeCsv), ['none', 'btree', 'fulltext'], 'warm_ms');
    const match = chart.groups.find((group) => group.label === 'title MATCH (FULLTEXT) “Zn”');
    expect(match?.bars).toEqual([
      { series: 'no index', value: null, note: 'needs a FULLTEXT index' },
      { series: 'FULLTEXT index', value: 2 },
    ]);
  });

  it('can chart rows examined instead of time', () => {
    const chart = probeChart(parseCsv(probeCsv), ['none'], 'rows_examined');
    expect(chart.groups[0].bars[0]).toEqual({ series: 'no index', value: 5000000 });
    expect(chart.unit).toBe('rows');
    expect(chart.axisLabel).toBe('rows examined');
  });
});

describe('index cost table', () => {
  it('shows build time in seconds and size in MiB per index kind', () => {
    const csv = 'kind,build_ms,size_bytes\nbtree,61234,734003200\nfulltext,600000,1073741824\n';
    expect(indexCostTable(parseCsv(csv))).toBe(
      [
        '| Index | Build time | Size on disk |',
        '| ----- | ---------: | -----------: |',
        '| btree | 61.2 s | 700 MiB |',
        '| fulltext | 600 s | 1024 MiB |',
      ].join('\n'),
    );
  });
});

describe('run labels and missing values', () => {
  it('names the runs for readers: no index, B-tree index, FULLTEXT index', () => {
    const chart = graphqlChart(parseCsv(graphqlCsv), ['none', 'btree', 'fulltext']);
    expect(chart.series).toEqual(['no index', 'B-tree index', 'FULLTEXT index']);
    expect(chart.axisLabel).toBe('milliseconds');
  });

  it.each([
    [
      "ERROR 1191 (HY000) at line 1: Can't find FULLTEXT index matching the column list",
      'needs a FULLTEXT index',
    ],
    [
      'ERROR 188 (HY000) at line 1: FTS query exceeds result cache limit',
      'failed: FTS result cache limit (error 188)',
    ],
  ])('explains %s as "%s"', (failure, note) => {
    expect(missingReason(failure)).toBe(note);
  });
});

describe('probe labels', () => {
  it('names each SQL predicate in words', () => {
    const rows = parseCsv(
      [
        'run,predicate,term,cold_ms,warm_ms,rows_examined,plan,failure',
        'none,titleContains,"q",1,1,1,"",',
        'none,titleBeginsWith,"q",1,1,1,"",',
        'none,shortDescContains,"q",1,1,1,"",',
      ].join('\n'),
    );
    expect(probeChart(rows, ['none'], 'warm_ms').groups.map((group) => group.label)).toEqual([
      'title contains “q”',
      'title starts with “q”',
      'short description contains “q”',
    ]);
  });
});

describe('comparison table', () => {
  it('shows each chart group as a row and each run as a column, "n/a" where missing', () => {
    const chart = graphqlChart(parseCsv(graphqlCsv), ['none', 'btree', 'fulltext']);
    expect(comparisonTable(chart)).toBe(
      [
        '| Scenario | no index | B-tree index | FULLTEXT index |',
        '| -------- | -------: | -----------: | -------------: |',
        '| typing “me” | 400 (p95 420) | 350 (p95 380) | – |',
        '| page-last “L-shape” p20 | 8 000 (p95 8 500) | – | – |',
      ].join('\n'),
    );
  });

  it('prints a failed measurement as n/a', () => {
    const chart = probeChart(parseCsv(probeCsv), ['none', 'fulltext'], 'warm_ms');
    expect(comparisonTable(chart).split('\n')[3]).toBe(
      '| title MATCH (FULLTEXT) “Zn” | n/a (needs a FULLTEXT index) | 2 |',
    );
  });
});
