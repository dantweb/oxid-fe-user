// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ARTICLE_COLUMNS,
  DIAMETERS_MM,
  LENGTHS_MM,
  MATERIALS,
  MATRIX_SIZE,
  SHAPES,
  combination,
  inPrimaryKeyOrder,
  isInAppendOrder,
  indexOf,
  sample,
  toArticleRow,
  toTsvRow,
} from '../../../scripts/perf/search-index/rodCatalogue';

describe('rod catalogue matrix', () => {
  it('is 1000 lengths × 100 diameters × 5 shapes × 17 materials = 8 500 000', () => {
    expect(LENGTHS_MM).toBe(1000);
    expect(DIAMETERS_MM).toBe(100);
    expect(SHAPES).toEqual(['', 'L', 'U', 'T', 'S']);
    expect(MATERIALS).toEqual([
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
    ]);
    expect(MATRIX_SIZE).toBe(8_500_000);
  });

  it.each([0, 1, 99, 100, 4_242_424, MATRIX_SIZE - 1])(
    'combination(%i) and indexOf round-trip',
    (index) => {
      expect(indexOf(combination(index))).toBe(index);
    },
  );

  it('maps the first and last index to the matrix corners', () => {
    expect(combination(0)).toEqual({ material: 'Zn', shape: '', lengthMm: 1, diameterMm: 1 });
    expect(combination(MATRIX_SIZE - 1)).toEqual({
      material: 'TiMg',
      shape: 'S',
      lengthMm: 1000,
      diameterMm: 100,
    });
  });

  it('rejects an index outside the matrix', () => {
    expect(() => combination(MATRIX_SIZE)).toThrow(RangeError);
    expect(() => combination(-1)).toThrow(RangeError);
  });
});

describe('seeded sample', () => {
  it('yields exactly n distinct indexes inside the population', () => {
    const picked = sample(7, 50, 85);
    expect(picked).toHaveLength(50);
    expect(new Set(picked).size).toBe(50);
    expect(Math.max(...picked)).toBeLessThan(85);
  });

  it('is reproducible for the same seed and differs for another seed', () => {
    expect(sample(20261020, 20, 85)).toEqual(sample(20261020, 20, 85));
    expect(sample(20261020, 20, 85)).not.toEqual(sample(20261021, 20, 85));
  });

  it('takes the whole population when n equals its size', () => {
    expect([...sample(1, 85, 85)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 85 }, (_, i) => i),
    );
  });

  it('picks 5 000 000 distinct rods covering every length, diameter, shape and material', () => {
    const picked = sample(20261020, 5_000_000);
    const seen = new Uint8Array(MATRIX_SIZE);
    const values = {
      material: new Set(),
      shape: new Set(),
      lengthMm: new Set(),
      diameterMm: new Set(),
    };
    for (const index of picked) {
      seen[index] = 1;
      const rod = combination(index);
      values.material.add(rod.material);
      values.shape.add(rod.shape);
      values.lengthMm.add(rod.lengthMm);
      values.diameterMm.add(rod.diameterMm);
    }
    expect(seen.reduce((sum, bit) => sum + bit, 0)).toBe(5_000_000);
    expect([
      values.material.size,
      values.shape.size,
      values.lengthMm.size,
      values.diameterMm.size,
    ]).toEqual([17, 5, 1000, 100]);
  }, 30_000);

  it('rejects asking for more than the population', () => {
    expect(() => sample(1, 86, 85)).toThrow(RangeError);
  });
});

describe('article row', () => {
  it('titles a straight rod without a shape word', () => {
    const row = toArticleRow(indexOf({ material: 'Fe', shape: '', lengthMm: 120, diameterMm: 8 }));
    expect(row.OXTITLE).toBe('metal rod Fe 120mm length 8mm diameter');
  });

  it('titles a shaped rod with its shape before the material', () => {
    const row = toArticleRow(
      indexOf({ material: 'AlTiMg', shape: 'U', lengthMm: 3, diameterMm: 1 }),
    );
    expect(row.OXTITLE).toBe('metal rod U-shape AlTiMg 3mm length 1mm diameter');
  });

  it('describes material, shape, length and diameter in prose', () => {
    const shaped = toArticleRow(
      indexOf({ material: 'FeCo', shape: 'T', lengthMm: 450, diameterMm: 12 }),
    );
    const straight = toArticleRow(
      indexOf({ material: 'Ni', shape: '', lengthMm: 7, diameterMm: 100 }),
    );
    expect(shaped.OXSHORTDESC).toBe('FeCo rod, T-shape, 450 mm long, 12 mm in diameter');
    expect(straight.OXSHORTDESC).toBe('Ni rod, straight, 7 mm long, 100 mm in diameter');
  });

  it('has a stable 32-hex OXID and a ROD- article number', () => {
    const row = toArticleRow(4_242_424);
    expect(row.OXID).toMatch(/^[0-9a-f]{32}$/);
    expect(toArticleRow(4_242_424).OXID).toBe(row.OXID);
    expect(toArticleRow(4_242_425).OXID).not.toBe(row.OXID);
    expect(row.OXARTNUM).toBe('ROD-4242424');
    expect(toArticleRow(5).OXARTNUM).toBe('ROD-0000005');
  });

  it('is an active, in-stock parent article of shop 1', () => {
    const row = toArticleRow(0);
    expect(row).toMatchObject({
      OXSHOPID: 1,
      OXACTIVE: 1,
      OXSTOCK: 100,
      OXSTOCKFLAG: 1,
      OXPARENTID: '',
    });
    expect(row.OXPRICE).toBeGreaterThan(0);
  });

  it('lists its fields in ARTICLE_COLUMNS order', () => {
    expect(Object.keys(toArticleRow(0))).toEqual([...ARTICLE_COLUMNS]);
  });
});

describe('TSV row', () => {
  it('joins the values with tabs in column order', () => {
    const row = toArticleRow(indexOf({ material: 'Fe', shape: '', lengthMm: 120, diameterMm: 8 }));
    const fields = toTsvRow(row).split('\t');
    expect(fields).toHaveLength(ARTICLE_COLUMNS.length);
    expect(fields[ARTICLE_COLUMNS.indexOf('OXTITLE')]).toBe(
      'metal rod Fe 120mm length 8mm diameter',
    );
  });

  it('escapes backslash, tab and newline the way LOAD DATA reads them', () => {
    const row = { ...toArticleRow(0), OXSHORTDESC: 'a\\b\tc\nd' };
    expect(toTsvRow(row)).toContain('a\\\\b\\tc\\nd');
  });
});

describe('primary-key order', () => {
  it('orders the same rods by OXID, so a load appends to the clustered index', () => {
    const picked = sample(3, 1000);
    const ordered = inPrimaryKeyOrder(picked);
    const oxids = Array.from(ordered, (index) => String(toArticleRow(index).OXID));
    expect(oxids).toEqual([...oxids].sort());
    expect([...ordered].sort((a, b) => a - b)).toEqual([...picked].sort((a, b) => a - b));
  });
});

describe('append-order check for chunk files', () => {
  it('accepts OXIDs that never go back in their first 40 bits (ties may interleave)', () => {
    expect(isInAppendOrder(['0a', '1bd6a2d9489a', '1bd6a2d94832', 'ff'])).toBe(true);
  });

  it('rejects OXIDs that go back, as an unsorted sample does', () => {
    expect(isInAppendOrder(['42fd2788', '4b798a9c', '1a000000'])).toBe(false);
  });

  it('holds for the generated order', () => {
    const oxids = Array.from(inPrimaryKeyOrder(sample(5, 2000)), (index) =>
      String(toArticleRow(index).OXID),
    );
    expect(isInAppendOrder(oxids)).toBe(true);
  });
});
