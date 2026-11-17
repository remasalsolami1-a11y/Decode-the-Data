import { describe, expect, it } from 'vitest';
import { SAMPLES, clean, decodeText, detectRoles, inspect, looksHijri, parseCSV, patterns, toDate, toNumber } from './tabular';

describe('try-your-own-data engine', () => {
  it('parses CSV with quotes, Arabic digits and currency', () => {
    const t = parseCSV('التاريخ,المبلغ,البند\n"٢٠٢٦-٠٩-٠١","١٢٫٥ ريال","قهوة, كبيرة"\n2026-09-02,30,مطاعم\n');
    expect(t.headers).toEqual(['التاريخ', 'المبلغ', 'البند']);
    expect(t.rows[0][2]).toBe('قهوة, كبيرة');
    expect(toNumber(t.rows[0][1])).toBe(12.5);
    expect(toDate(t.rows[0][0])!.toISOString().slice(0, 10)).toBe('2026-09-01');
  });
  it('reads day-first dates and Excel serials', () => {
    expect(toDate('05/09/2026')!.toISOString().slice(0, 10)).toBe('2026-09-05');
    expect(toDate('25/12/2026')!.toISOString().slice(0, 10)).toBe('2026-12-25');
    expect(toDate(46000)!.getUTCFullYear()).toBe(2025);
    expect(toDate('مرحبا')).toBeNull();
  });
  it('every sample is detected, inspected, cleaned and forecast', () => {
    for (const s of SAMPLES) {
      const t = s.table();
      const r = detectRoles(t)!;
      expect(r, s.id).not.toBeNull();
      expect(t.headers[r.date]).toBe('التاريخ');
      const ins = inspect(t, r);
      expect(ins.dupIdx.size, s.id).toBeGreaterThan(0);
      expect(ins.missingValueIdx.size, s.id).toBeGreaterThan(0);
      const recs = clean(t, r, ins, 'mean');
      expect(recs.length).toBe(t.rows.length - ins.dupIdx.size - ins.missingDateIdx.size);
      const p = patterns(recs)!;
      expect(p.forecast.every((x) => x >= 0)).toBe(true);
      expect(p.byWeekday).toHaveLength(7);
      expect(p.nextMonth).toBeGreaterThan(0);
    }
  });
  it('drop strategy removes rows with missing numbers', () => {
    const t = SAMPLES[0].table();
    const r = detectRoles(t)!;
    const ins = inspect(t, r);
    expect(clean(t, r, ins, 'drop').length).toBe(clean(t, r, ins, 'mean').length - ins.missingValueIdx.size);
  });
});

describe('messy real-world files', () => {
  it('skips title rows above the header', () => {
    const t = parseCSV('تقرير المبيعات\n\nالتاريخ,المبلغ\n2026-01-01,5\n2026-01-02,7\n');
    expect(t.headers).toEqual(['التاريخ', 'المبلغ']);
    expect(t.rows).toHaveLength(2);
  });
  it('reads Arabic month names', () => {
    expect(toDate('1 سبتمبر 2026')!.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(toDate('15 أيلول 2026')!.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(toDate('الأحد 3 ابريل 2026')!.toISOString().slice(0, 10)).toBe('2026-04-03');
  });
  it('flags Hijri dates instead of guessing', () => {
    const t = parseCSV('التاريخ,المبلغ\n1448/03/01,20\n1448/03/02,30\n');
    expect(detectRoles(t)).toBeNull();
    expect(looksHijri(t)).toBe(true);
  });
  it('decodes Windows-1256 CSV', () => {
    const bytes = new Uint8Array([0xc7, 0xe1, 0xca, 0xc7, 0xd1, 0xed, 0xce]); // "التاريخ" in cp1256
    expect(decodeText(bytes.buffer)).toBe('التاريخ');
  });
});
