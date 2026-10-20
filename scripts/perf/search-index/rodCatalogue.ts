import { createHash } from 'node:crypto';

/**
 * The sprint-17 catalogue: every rod of the matrix length × diameter × shape × material has one
 * index; the shop gets a seeded sample of them. Pure — no I/O — so the 5 M rows are reproducible.
 */
export const LENGTHS_MM = 1000;
export const DIAMETERS_MM = 100;
/** '' is the straight rod: it has no shape word in its title. */
export const SHAPES = ['', 'L', 'U', 'T', 'S'] as const;
export const MATERIALS = [
  'Zn',
  'Fe',
  'Co',
  'Mn',
  'Ni',
  'Mg',
  'Ti',
  'Al',
  'ZnFe',
  'FeCo',
  'FeMo',
  'FeMoCo',
  'CoMn',
  'AlTi',
  'AlMg',
  'AlTiMg',
  'TiMg',
] as const;
export const MATRIX_SIZE = LENGTHS_MM * DIAMETERS_MM * SHAPES.length * MATERIALS.length;

export interface Rod {
  material: (typeof MATERIALS)[number];
  shape: (typeof SHAPES)[number];
  lengthMm: number;
  diameterMm: number;
}

/** The columns a generated article fills; every other oxarticles column keeps its default. */
export const ARTICLE_COLUMNS = [
  'OXID',
  'OXSHOPID',
  'OXACTIVE',
  'OXARTNUM',
  'OXTITLE',
  'OXSHORTDESC',
  'OXPRICE',
  'OXSTOCK',
  'OXSTOCKFLAG',
  'OXPARENTID',
] as const;

export type ArticleRow = Record<(typeof ARTICLE_COLUMNS)[number], string | number>;

export function combination(index: number): Rod {
  if (!Number.isInteger(index) || index < 0 || index >= MATRIX_SIZE) {
    throw new RangeError(`rod index ${index} is outside 0..${MATRIX_SIZE - 1}`);
  }
  const diameterMm = (index % DIAMETERS_MM) + 1;
  const lengthMm = (Math.floor(index / DIAMETERS_MM) % LENGTHS_MM) + 1;
  const shapeAndMaterial = Math.floor(index / (DIAMETERS_MM * LENGTHS_MM));
  return {
    material: MATERIALS[Math.floor(shapeAndMaterial / SHAPES.length)],
    shape: SHAPES[shapeAndMaterial % SHAPES.length],
    lengthMm,
    diameterMm,
  };
}

export function indexOf(rod: Rod): number {
  const shapeAndMaterial =
    MATERIALS.indexOf(rod.material) * SHAPES.length + SHAPES.indexOf(rod.shape);
  return (shapeAndMaterial * LENGTHS_MM + rod.lengthMm - 1) * DIAMETERS_MM + rod.diameterMm - 1;
}

/** mulberry32: a tiny seeded PRNG, good enough to spread a sample evenly. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * n distinct indexes of 0..population-1 (partial Fisher–Yates). Whether a rod is in the shop depends
 * only on the seed; where its row sits in the table depends on its OXID (see inPrimaryKeyOrder).
 */
export function sample(seed: number, n: number, population: number = MATRIX_SIZE): Uint32Array {
  if (n > population) {
    throw new RangeError(`cannot sample ${n} of ${population}`);
  }
  const random = seededRandom(seed);
  const pool = new Uint32Array(population);
  for (let i = 0; i < population; i++) {
    pool[i] = i;
  }
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (population - i));
    const picked = pool[j];
    pool[j] = pool[i];
    pool[i] = picked;
  }
  return pool.slice(0, n);
}

function oxid(index: number): string {
  return createHash('md5').update(`rod-${index}`).digest('hex');
}

/**
 * The same rods ordered by OXID. InnoDB stores rows in primary-key order whatever the insert order,
 * so this changes nothing in the table but turns a 5 M load into appends instead of random page
 * splits. Sort key: OXID's first 40 bits, then the 24-bit rod index (ties are a handful in 5 M).
 */
export function inPrimaryKeyOrder(indexes: Uint32Array): Uint32Array {
  const keys = new BigUint64Array(indexes.length);
  indexes.forEach((index, i) => {
    keys[i] = (BigInt(`0x${oxid(index).slice(0, 10)}`) << 24n) | BigInt(index);
  });
  keys.sort();
  return Uint32Array.from(keys, (key) => Number(key & 0xffffffn));
}

/** True when OXIDs never go back in the 40 bits inPrimaryKeyOrder sorts by: the load only appends. */
export function isInAppendOrder(oxids: string[]): boolean {
  return oxids.every((oxid, i) => i === 0 || oxid.slice(0, 10) >= oxids[i - 1].slice(0, 10));
}

function title(rod: Rod): string {
  const shape = rod.shape ? `${rod.shape}-shape ` : '';
  return `metal rod ${shape}${rod.material} ${rod.lengthMm}mm length ${rod.diameterMm}mm diameter`;
}

function shortDescription(rod: Rod): string {
  const shape = rod.shape ? `${rod.shape}-shape` : 'straight';
  return `${rod.material} rod, ${shape}, ${rod.lengthMm} mm long, ${rod.diameterMm} mm in diameter`;
}

export function toArticleRow(index: number): ArticleRow {
  const rod = combination(index);
  return {
    OXID: oxid(index),
    OXSHOPID: 1,
    OXACTIVE: 1,
    OXARTNUM: `ROD-${String(index).padStart(7, '0')}`,
    OXTITLE: title(rod),
    OXSHORTDESC: shortDescription(rod),
    OXPRICE: Math.round((1 + (rod.lengthMm * rod.diameterMm) / 1000) * 100) / 100,
    OXSTOCK: 100,
    OXSTOCKFLAG: 1,
    OXPARENTID: '',
  };
}

function escapeTsv(value: string | number): string {
  return String(value).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
}

/** One line for MySQL's `LOAD DATA` defaults (tab-separated, backslash escapes). */
export function toTsvRow(row: ArticleRow): string {
  return ARTICLE_COLUMNS.map((column) => escapeTsv(row[column])).join('\t');
}
