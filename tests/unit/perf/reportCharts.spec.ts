// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  SERIES_COLORS,
  groupedBarChart,
  type BarGroup,
} from '../../../scripts/perf/search-index/reportCharts';

const runs = ['none', 'btree', 'fulltext'];

function groups(values: number[][]): BarGroup[] {
  return values.map((row, i) => ({
    label: `scenario ${i}`,
    bars: row.map((value, j) => ({ series: runs[j], value, whisker: value * 2 })),
  }));
}

function attribute(svg: string, element: string, name: string): number[] {
  const pattern = new RegExp(`<${element} [^>]*data-bar[^>]*\\b${name}="([\\d.]+)"`, 'g');
  return [...svg.matchAll(pattern)].map((match) => Number(match[1]));
}

describe('grouped bar chart', () => {
  const linear = groupedBarChart({
    title: 'GraphQL p50',
    unit: 'ms',
    axisLabel: 'milliseconds',
    series: runs,
    groups: groups([
      [10, 20, 40],
      [5, 5, 5],
    ]),
  });

  it('draws one group per scenario and one bar per run', () => {
    expect(linear.match(/data-group=/g)).toHaveLength(2);
    expect(attribute(linear, 'path', 'data-value')).toEqual([10, 20, 40, 5, 5, 5]);
  });

  it('makes bar lengths proportional to the value on a linear axis', () => {
    const [ten, twenty, forty] = attribute(linear, 'path', 'data-length');
    expect(twenty / ten).toBeCloseTo(2, 1);
    expect(forty / ten).toBeCloseTo(4, 1);
  });

  it('draws the p95 whisker beyond each bar', () => {
    expect(linear.match(/data-whisker=/g)).toHaveLength(6);
  });

  it('switches to a log axis when values span more than 100×, labelled as such', () => {
    const wide = groupedBarChart({
      title: 'SQL',
      unit: 'ms',
      axisLabel: 'milliseconds',
      series: runs,
      groups: groups([[1, 100, 5000]]),
    });
    expect(wide).toContain('log scale');
    const [one, hundred, fiveThousand] = attribute(wide, 'path', 'data-length');
    expect(hundred - one).toBeCloseTo((fiveThousand - one) * (2 / Math.log10(5000)), 0);
    expect(linear).not.toContain('log scale');
  });

  it('labels every bar with its exact value as text and as a <title>', () => {
    expect(linear).toContain('<title>scenario 0 · btree: 20 ms (p95 40 ms)</title>');
    expect(linear).toMatch(/<text[^>]*data-label[^>]*>20 ms<\/text>/);
  });

  it('has a legend naming each run in the fixed categorical colours', () => {
    expect(SERIES_COLORS).toEqual(['#2a78d6', '#eb6834', '#1baf7a']);
    runs.forEach((run, i) => {
      expect(linear).toContain(`fill="${SERIES_COLORS[i]}"`);
      expect(linear).toMatch(new RegExp(`<text[^>]*data-legend[^>]*>${run}</text>`));
    });
  });

  it('paints its own light surface so it reads the same on any page theme', () => {
    expect(linear).toMatch(/<rect width="100%" height="100%" fill="#fcfcfb"/);
  });

  it('is XML: every attribute has a value (a bare attribute stops the browser rendering)', () => {
    const bareAttributes = [...linear.matchAll(/<[a-z][^>]*>/g)]
      .map(([tag]) => tag.replace(/ [a-zA-Z0-9:-]+="[^"]*"/g, ''))
      .filter((tag) => !/^<[a-z]+\/?>$/.test(tag));
    expect(bareAttributes).toEqual([]);
  });

  it('names the axis with its unit, and says when it is logarithmic', () => {
    expect(linear).toMatch(/<text[^>]*data-axis-title[^>]*>milliseconds<\/text>/);
    const wide = groupedBarChart({
      title: 'SQL',
      unit: 'rows',
      axisLabel: 'rows examined',
      series: runs,
      groups: groups([[1, 100, 5000000]]),
    });
    expect(wide).toMatch(/<text[^>]*data-axis-title[^>]*>rows examined \(log scale\)<\/text>/);
    expect(wide).toMatch(/>5 000 000 rows<\/text>/);
  });

  it('says why a value is missing instead of a bare n/a', () => {
    const svg = groupedBarChart({
      title: 'SQL',
      unit: 'ms',
      axisLabel: 'milliseconds',
      series: ['no index'],
      groups: [
        { label: 'g', bars: [{ series: 'no index', value: null, note: 'needs a FULLTEXT index' }] },
      ],
    });
    expect(svg).toMatch(/<text[^>]*data-label[^>]*>n\/a – needs a FULLTEXT index<\/text>/);
  });

  it('escapes XML in labels', () => {
    const svg = groupedBarChart({
      title: 'a < b & "c"',
      unit: 'ms',
      axisLabel: 'milliseconds',
      series: ['none'],
      groups: [{ label: '<x>', bars: [{ series: 'none', value: 1 }] }],
    });
    expect(svg).toContain('a &lt; b &amp; &quot;c&quot;');
    expect(svg).not.toContain('<x>');
  });
});
