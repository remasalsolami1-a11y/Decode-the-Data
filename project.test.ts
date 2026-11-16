import { describe, expect, it } from 'vitest';
import { BEST_FEATURES } from './model';
import { buildDataset, thu21, TRUTH } from './dataset';
import { Decisions, computeProject, decisionsFrom, eidOutcome } from './project';

const base = (): Decisions => ({
  de: { missing: 'sameSlot', timeFmt: '24' },
  da: { conclusion: 'right', specialFound: [] },
  ds: { features: [...BEST_FEATURES], approach: 'combined' },
  ml: { config: 'honest' },
  bi: { kpis: ['avgDaily', 'peakHour', 'tonight', 'staff'], charts: {}, staff: null, scope: 'evening' },
  gov: { sensitive: [], qfix: null, ethic: null, disclaimer: false },
  source: { de: 'participant', da: 'participant', ds: 'participant', ml: 'participant', bi: 'participant', gov: 'participant' },
});
const with_ = (patch: (d: Decisions) => void) => {
  const d = base();
  patch(d);
  return computeProject(d);
};

describe('station 1 → dataset', () => {
  it('each missing-value strategy produces a different dataset', () => {
    expect(buildDataset('sameSlot').rows).toHaveLength(336);
    expect(buildDataset('drop').rows).toHaveLength(336 - 12);
    const t21 = (s: Parameters<typeof buildDataset>[0]) => thu21(buildDataset(s).rows);
    expect(t21('zero')).toBeLessThan(t21('overall'));
    expect(t21('overall')).toBeLessThan(t21('sameSlot'));
  });
  it('best strategy stays closest to the truth on the missing cells', () => {
    const err = (s: Parameters<typeof buildDataset>[0]) =>
      buildDataset(s)
        .rows.filter((r) => r.imputed)
        .reduce((a, r) => a + Math.abs(r.orders - TRUTH.find((t) => t.id === r.id)!.orders), 0);
    expect(err('sameSlot')).toBeLessThan(err('overall'));
    expect(err('overall')).toBeLessThan(err('zero'));
  });
});

describe('decisions propagate downstream', () => {
  it('a bad cleaning decision lowers the Eid forecast and hurts the Eid-night outcome', () => {
    const good = computeProject(base());
    const bad = with_((d) => (d.de.missing = 'zero'));
    expect(Math.max(...bad.eidForecast)).toBeLessThan(Math.max(...good.eidForecast));
    expect(bad.run.ev.realMae).toBeGreaterThan(good.run.ev.realMae);
    expect(bad.stats.peak.value).toBeLessThan(good.stats.peak.value);
    expect(bad.audit.some((i) => i.id === 'de-zero' && i.severity === 'critical')).toBe(true);
  });
  it('removing the Eid feature makes the model blind to Eid → under-staffing', () => {
    const p = with_((d) => (d.ds.features = d.ds.features.filter((f) => f !== 'eid')));
    expect(Math.max(...p.eidForecast)).toBeLessThan(Math.max(...p.eidTruth) * 0.75);
    expect(p.outcome.tier).toBe('harm');
    expect(p.audit.find((i) => i.id === 'ds-noeid')).toBeTruthy();
  });
  it('data leakage looks great in testing but fails in real use', () => {
    const p = with_((d) => d.ds.features.push('staff'));
    expect(p.run.ev.mae).toBeLessThan(p.run.ev.realMae);
    expect(p.tiers.ds).toBe('harm');
  });
  it('evaluating on training data reports an optimistic error', () => {
    const p = with_((d) => (d.ml.config = 'same'));
    expect(p.run.ev.mae).toBeLessThan(p.run.ev.realMae);
    expect(p.audit.find((i) => i.id === 'ml-same')?.severity).toBe('critical');
  });
  it('training only on weeks 1–2 never sees Eid', () => {
    const good = computeProject(base());
    const p = with_((d) => (d.ml.config = 'small'));
    expect(Math.max(...p.eidForecast)).toBeLessThan(Math.max(...good.eidForecast) * 0.8);
  });
  it('approach choice changes what the model can see', () => {
    expect(with_((d) => (d.ds.approach = 'overall')).features).toEqual([]);
    expect(with_((d) => (d.ds.approach = 'hourly')).features).toEqual(['hour']);
  });
});

describe('station 5 outcome is judged against the true world', () => {
  it('following the best model recommendation keeps customers happy', () => {
    const p = computeProject(base());
    expect(p.outcome.tier).not.toBe('harm');
  });
  it('keeping the old schedule (5 staff) on Eid night is harmful', () => {
    const p = computeProject(base());
    expect(eidOutcome(p.eidForecast, 5, 'evening').tier).toBe('harm');
  });
  it('staffing all day costs more than staffing the evening', () => {
    const p = computeProject(base());
    const ev = eidOutcome(p.eidForecast, p.recommendedStaff, 'evening');
    const all = eidOutcome(p.eidForecast, p.recommendedStaff, 'allday');
    expect(all.labor).toBeGreaterThan(ev.labor);
  });
});

describe('reading decisions from saved state', () => {
  it('falls back to safe defaults and marks them as defaults', () => {
    const d = decisionsFrom({ station: {} });
    expect(d.de.missing).toBe('sameSlot');
    expect(d.source.de).toBe('default');
  });
  it('uses the participant choices when present', () => {
    const d = decisionsFrom({ station: { de: { missing: 'drop' }, ml: { snip: 'b' }, ds: { featuresDone: true, features: ['hour'], approach: 'combined' } } });
    expect(d.de.missing).toBe('drop');
    expect(d.ml.config).toBe('small');
    expect(d.ds.features).toEqual(['hour']);
    expect(d.source.de).toBe('participant');
  });
});

import { migrate } from './store';
describe('saved progress migration', () => {
  it('migrates v2 progress without losing completed stations', () => {
    const m = migrate({ v: 2, screen: 'bi', mode: 'workshop', completed: { de: true, da: true, ds: true, ml: true, bi: true }, station: { ds: { featureOk: true, features: ['hour'] }, bi: { step: 4, decision: 'evening' } }, outputs: {}, career: { ratings: {}, picks: {} }, name: 'سارة', presenter: false, boss: { step: 0, peaks: [] } });
    expect(m.v).toBe(3);
    expect(m.completed.de).toBe(true);
    expect(m.mode).toBe('workshop');
    expect(m.name).toBe('سارة');
    expect((m.station.ds as Record<string, unknown>).featuresDone).toBe(true);
    expect((m.station.bi as Record<string, unknown>).decision).toBeUndefined();
    expect(m.completed.bi).toBe(false);
  });
  it('ignores unknown or broken data', () => {
    expect(migrate(null).v).toBe(3);
    expect(migrate({ v: 99 } as Record<string, unknown>).screen).toBe('landing');
  });
});
