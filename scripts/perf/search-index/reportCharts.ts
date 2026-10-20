/**
 * Sprint 17, S6: the report's charts as static SVG (data in → SVG string out). Static because they
 * are embedded in Markdown, where there is no hover: every bar carries its value as a visible label
 * and a <title>, and the report repeats the numbers in tables.
 */

/** Categorical slots 1–3 of the dataviz reference palette, validated all-pairs on the light surface. */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];
const SURFACE = '#fcfcfb';
const TEXT_PRIMARY = '#0b0b0b';
const TEXT_SECONDARY = '#52514e';
const GRID = '#e4e3df';

export interface Bar {
  series: string;
  /** null: no measurement (failed or not applicable), drawn as "n/a – <note>". */
  value: number | null;
  whisker?: number;
  /** Why the value is missing. */
  note?: string;
}

export interface BarGroup {
  label: string;
  bars: Bar[];
}

export interface ChartSpec {
  title: string;
  /** Printed after every value, e.g. "ms" or "rows". */
  unit: string;
  /** The x-axis title, e.g. "milliseconds". */
  axisLabel: string;
  series: string[];
  groups: BarGroup[];
  /** Says what the bar and the whisker are, e.g. "bar = p50, line = p95". */
  note?: string;
}

const WIDTH = 1000;
const LABEL_RIGHT = 390;
const PLOT_LEFT = 402;
const PLOT_WIDTH = 480;
const BAR = 12;
const GAP = 2;
const GROUP_GAP = 14;
const TOP = 96;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Whole numbers from 100 up, grouped by thousands ("5 000 301"); one decimal below. */
export function formatValue(value: number): string {
  if (value < 100) {
    return String(Math.round(value * 10) / 10);
  }
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

interface Scale {
  length: (value: number) => number;
  ticks: number[];
  log: boolean;
}

function measured(spec: ChartSpec): number[] {
  return spec.groups.flatMap((group) =>
    group.bars.flatMap((bar) => (bar.value === null ? [] : [bar.value, bar.whisker ?? bar.value])),
  );
}

function niceStep(max: number): number {
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((step) => step >= raw) ?? raw;
}

function linearScale(max: number): Scale {
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  return { length: (value) => (value / top) * PLOT_WIDTH, ticks, log: false };
}

/** Scans and index lookups differ by orders of magnitude: a log axis keeps both readable. */
function logScale(min: number, max: number): Scale {
  const low = Math.log10(min / 2);
  const high = Math.log10(max);
  const ticks: number[] = [];
  for (let power = Math.ceil(low); power <= Math.floor(high); power++) {
    ticks.push(10 ** power);
  }
  return {
    length: (value) => ((Math.log10(value) - low) / (high - low)) * PLOT_WIDTH,
    ticks,
    log: true,
  };
}

function scaleFor(spec: ChartSpec): Scale {
  const values = measured(spec).filter((value) => value > 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  return max / min > 100 ? logScale(min, max) : linearScale(max);
}

/** A bar anchored at the baseline with a 4px rounded data end. */
function barPath(x: number, y: number, length: number): string {
  const r = Math.min(4, length / 2, BAR / 2);
  return (
    `M${x} ${y}h${(length - r).toFixed(1)}a${r} ${r} 0 0 1 ${r} ${r}v${BAR - 2 * r}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}h${(-(length - r)).toFixed(1)}z`
  );
}

function drawBar(spec: ChartSpec, scale: Scale, group: BarGroup, bar: Bar, y: number): string {
  const color = SERIES_COLORS[spec.series.indexOf(bar.series)];
  if (bar.value === null) {
    const missing = bar.note ? `n/a – ${bar.note}` : 'n/a';
    return `<text data-label="" x="${PLOT_LEFT + 4}" y="${y + BAR - 2}" font-size="11" fill="${TEXT_SECONDARY}">${escapeXml(missing)}</text>`;
  }
  const length = Math.max(scale.length(bar.value), 1);
  const whiskerEnd =
    bar.whisker === undefined ? length : Math.max(scale.length(bar.whisker), length);
  const title =
    `${group.label} · ${bar.series}: ${formatValue(bar.value)} ${spec.unit}` +
    (bar.whisker === undefined ? '' : ` (p95 ${formatValue(bar.whisker)} ${spec.unit})`);
  const middle = y + BAR / 2;
  const whisker =
    bar.whisker === undefined
      ? ''
      : `<path data-whisker="" d="M${PLOT_LEFT + length} ${middle}H${PLOT_LEFT + whiskerEnd}M${PLOT_LEFT + whiskerEnd} ${middle - 4}v8" stroke="${TEXT_SECONDARY}" stroke-width="1" fill="none"/>`;
  return (
    `<g><title>${escapeXml(title)}</title>` +
    `<path data-bar="" data-value="${bar.value}" data-length="${length.toFixed(3)}" d="${barPath(PLOT_LEFT, y, length)}" fill="${color}"/>` +
    whisker +
    `<text data-label="" x="${PLOT_LEFT + whiskerEnd + 6}" y="${y + BAR - 2}" font-size="11" fill="${TEXT_PRIMARY}">${formatValue(bar.value)} ${escapeXml(spec.unit)}</text></g>`
  );
}

function legend(spec: ChartSpec): string {
  let x = PLOT_LEFT;
  return spec.series
    .map((series, i) => {
      const item =
        `<rect x="${x}" y="58" width="12" height="12" rx="2" fill="${SERIES_COLORS[i]}"/>` +
        `<text data-legend="" x="${x + 18}" y="68" font-size="12" fill="${TEXT_PRIMARY}">${escapeXml(series)}</text>`;
      x += 30 + series.length * 8;
      return item;
    })
    .join('');
}

export function groupedBarChart(spec: ChartSpec): string {
  const scale = scaleFor(spec);
  const groupHeight = spec.series.length * (BAR + GAP) - GAP;
  const plotHeight = spec.groups.length * (groupHeight + GROUP_GAP);
  const height = TOP + plotHeight + 52;
  const grid = scale.ticks
    .map((tick) => {
      const x = PLOT_LEFT + scale.length(tick);
      return (
        `<line x1="${x}" y1="${TOP - 6}" x2="${x}" y2="${TOP + plotHeight}" stroke="${GRID}" stroke-width="1"/>` +
        `<text x="${x}" y="${TOP + plotHeight + 16}" font-size="11" text-anchor="middle" fill="${TEXT_SECONDARY}">${formatValue(tick)}</text>`
      );
    })
    .join('');
  const groups = spec.groups
    .map((group, g) => {
      const top = TOP + g * (groupHeight + GROUP_GAP);
      const bars = group.bars
        .map((bar) =>
          drawBar(spec, scale, group, bar, top + spec.series.indexOf(bar.series) * (BAR + GAP)),
        )
        .join('');
      return (
        `<g data-group="${escapeXml(group.label)}">` +
        `<text x="${LABEL_RIGHT}" y="${top + groupHeight / 2 + 4}" font-size="12" text-anchor="end" fill="${TEXT_PRIMARY}">${escapeXml(group.label)}</text>` +
        `${bars}</g>`
      );
    })
    .join('');
  const axisTitle = `${spec.axisLabel}${scale.log ? ' (log scale)' : ''}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" ` +
    `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="${escapeXml(spec.title)}">` +
    `<rect width="100%" height="100%" fill="${SURFACE}"/>` +
    `<text x="16" y="28" font-size="16" font-weight="600" fill="${TEXT_PRIMARY}">${escapeXml(spec.title)}</text>` +
    `<text x="16" y="48" font-size="12" fill="${TEXT_SECONDARY}">${escapeXml(spec.note ?? '')}</text>` +
    legend(spec) +
    grid +
    `<line x1="${PLOT_LEFT}" y1="${TOP - 6}" x2="${PLOT_LEFT}" y2="${TOP + plotHeight}" stroke="${TEXT_SECONDARY}" stroke-width="1"/>` +
    groups +
    `<text data-axis-title="" x="${PLOT_LEFT + PLOT_WIDTH / 2}" y="${TOP + plotHeight + 36}" font-size="12" text-anchor="middle" fill="${TEXT_SECONDARY}">${escapeXml(axisTitle)}</text>` +
    '</svg>\n'
  );
}
