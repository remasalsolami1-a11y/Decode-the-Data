import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { STATIONS, stationById } from './stations';
import { STATION_ORDER, StationId, firstName, useStore } from './store';
import { fixAwaitingDecision, Project, Tier, TIER_COLOR, useProject } from './project';
import { RAW_ROW_COUNT, HOURS } from './dataset';
import { DataRiver, RiverNode } from './DataRiver';
import { TierBadge } from './Decision';
import { youBuilt } from './CompletedSystem';
import { ACHIEVEMENTS, earnedAchievements } from './Achievements';
import { computeScores, PICKS, signalsFrom, TASKS } from './CareerDiscovery';
import { Icon } from './Icon';
import { cx } from './ui';
import { upsetAr } from './sim';

// ---- open/close store (same pattern as the glossary) ----------------------
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const openDashboard = () => {
  open = true;
  emit();
};
const closeDashboard = () => {
  open = false;
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** per-station status for the river: pending until the station is done (or while a governance fix awaits a new decision) */
export function riverNodes(state: ReturnType<typeof useStore>['state'], p: Project): RiverNode[] {
  return STATION_ORDER.map((id) => ({
    id,
    status: state.completed[id] && !fixAwaitingDecision(state.station[id]) ? p.tiers[id] : 'pending',
    current: state.screen === id,
  }));
}

export function DashboardButton() {
  const { state } = useStore();
  const p = useProject();
  const harm = riverNodes(state, p).some((n) => n.status === 'harm');
  return (
    <button
      onClick={openDashboard}
      className="relative flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200"
      style={{ background: '#1F2754' }}
      aria-label="لوحتي: نتائج قراراتك"
    >
      <Icon name="chart" size={16} />
      <span className="hidden sm:inline">لوحتي</span>
      {harm && <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ background: TIER_COLOR.harm }} aria-label="فيه قرار ضار" />}
    </button>
  );
}

function Kpi({ label, value, sub, tier, locked }: { label: string; value: string; sub: string; tier?: Tier; locked?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-ink-200/70 p-4 shadow-card min-w-0">
      <div className="text-xs text-ink-500 mb-1">{label}</div>
      {locked ? (
        <>
          <div className="text-2xl font-bold text-ink-200 tabular-nums">—</div>
          <div className="text-xs text-ink-400 mt-1 flex items-center gap-1">
            <Icon name="lock" size={12} /> {locked}
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold tabular-nums" dir="ltr" style={{ textAlign: 'right' }}>
            {value}
          </div>
          <div className="text-xs mt-1 font-semibold" style={{ color: tier ? TIER_COLOR[tier] : '#64748B' }}>
            {sub}
          </div>
        </>
      )}
    </div>
  );
}

export function eidTier(p: Project): Tier {
  const gap = Math.abs(Math.max(...p.eidForecast) - Math.max(...p.eidTruth));
  return gap <= 10 ? 'best' : gap <= 18 ? 'cost' : 'harm';
}

function EidChart({ p, ready }: { p: Project; ready: boolean }) {
  const idx = HOURS.map((h, i) => (h >= 18 ? i : -1)).filter((i) => i >= 0);
  const max = Math.max(...idx.map((i) => Math.max(p.eidForecast[i], p.eidTruth[i]))) * 1.08;
  return (
    <div className="rounded-2xl bg-white border border-ink-200/70 p-5 shadow-card min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="font-bold">ليلة العيد: توقعك مقابل الواقع</h3>
        {ready && <TierBadge tier={eidTier(p)} />}
      </div>
      <p className="text-xs text-ink-500 mb-4">طلبات كل ساعة من 6 مساءً لين 11 مساءً</p>
      {ready ? (
        <>
          <div className="flex items-end gap-3 h-40" dir="ltr" role="img" aria-label={`توقع نموذجك في الذروة ${Math.round(Math.max(...p.eidForecast))} والطلب الحقيقي ${Math.round(Math.max(...p.eidTruth))}`}>
            {idx.map((i) => (
              <div key={i} className="flex-1 h-full flex flex-col justify-end">
                <div className="flex items-end gap-1 h-full">
                  <div className="flex-1 rounded-t-md bg-[#2F6BFF] transition-all duration-700" style={{ height: `${(p.eidForecast[i] / max) * 100}%` }} title={`توقعك ${Math.round(p.eidForecast[i])}`} />
                  <div className="flex-1 rounded-t-md bg-ink-200 transition-all duration-700" style={{ height: `${(p.eidTruth[i] / max) * 100}%` }} title={`الواقع ${Math.round(p.eidTruth[i])}`} />
                </div>
                <div className="text-[11px] text-ink-500 text-center mt-1.5 tabular-nums">{HOURS[i] - 12}م</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-ink-600 mt-3">
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-sm bg-[#2F6BFF]" /> توقع نموذجك
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-sm bg-ink-200" /> الطلب الحقيقي
            </span>
          </div>
        </>
      ) : (
        <div className="h-40 grid place-items-center rounded-xl border-2 border-dashed border-ink-200 text-sm text-ink-400 text-center px-4">
          يظهر بعد ما تدرّب نموذجك في محطة تعلم الآلة
        </div>
      )}
    </div>
  );
}

export function DashboardHost() {
  const isOpen = useSyncExternalStore(subscribe, () => open);
  const { state, go } = useStore();
  const p = useProject();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeDashboard();
    window.addEventListener('keydown', k);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const nodes = riverNodes(state, p);
  const done = (id: StationId) => nodes.find((n) => n.id === id)!.status !== 'pending';
  const doneCount = nodes.filter((n) => n.status !== 'pending').length;
  const built = youBuilt(p);
  const earned = earnedAchievements(state, p);
  const core = ACHIEVEMENTS.filter((a) => !a.optional);
  const { ratings, picks } = state.career;
  const careerReady = TASKS.every((t) => ratings[t.id] != null) && PICKS.every((x) => picks[x.id]);
  const career = careerReady ? computeScores(ratings, picks, signalsFrom(earned, state.explored ?? [], !!state.boss.done)) : null;
  const harmAt = nodes.findIndex((n) => n.status === 'harm');
  const visit = (id: StationId) => {
    closeDashboard();
    go(id);
  };
  const critical = p.audit.filter((i) => i.severity === 'critical').length;
  const C = 2 * Math.PI * 22;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-sm overflow-y-auto overscroll-contain" onClick={closeDashboard}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="لوحتي"
        className="min-h-full sm:min-h-0 sm:my-6 sm:mx-auto sm:max-w-5xl sm:rounded-3xl bg-paper overflow-hidden shadow-lift animate-rise w-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header + river */}
        <div className="relative bg-ink-950 text-white px-4 sm:px-6 pt-5 pb-3 overflow-hidden">
          <div className="absolute inset-0 opacity-25 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#ffffff10 1px, transparent 1px), linear-gradient(90deg, #ffffff10 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: 'radial-gradient(#22D3EE, transparent 70%)' }} />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0 -rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="6" />
                <circle cx="28" cy="28" r="22" fill="none" stroke="#22D3EE" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(doneCount / 6) * C} ${C}`} style={{ transition: 'stroke-dasharray .8s' }} />
              </svg>
              <div>
                <h2 className="text-2xl font-bold">لوحتي{firstName(state) ? ` · ${firstName(state)}` : ''}</h2>
                <p className="text-sm text-white/60">
                  {doneCount}/6 محطات · كل رقم هنا محسوب من قراراتك وتتحدث تلقائيًا
                </p>
              </div>
            </div>
            <button onClick={closeDashboard} className="p-2 rounded-lg text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="إغلاق اللوحة">
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className="relative mt-3">
            <DataRiver nodes={nodes} onSelect={visit} height={150} />
          </div>
          <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60 pb-1">
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full bg-[#22D3EE]" /> بيانات سليمة
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: TIER_COLOR.cost }} /> مقبولة مع تكلفة
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: TIER_COLOR.harm }} /> ملوّثة بقرار ضار
            </span>
            <span className="ms-auto">اضغط على أي محطة لتروح لها</span>
          </div>
          {harmAt >= 0 && (
            <div className="relative mt-2 rounded-xl bg-rose-500/15 border border-rose-400/30 px-3 py-2 text-sm text-rose-100">
              ⚠ قرارك في <b>{STATIONS[harmAt].ar}</b> ملوّث البيانات، والتلوث ماشي لكل المحطات اللي بعدها.{' '}
              <button className="underline font-semibold" onClick={() => visit(nodes[harmAt].id)}>
                روح صلّحه
              </button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="بيانات نظّفتها" value={`${p.clean.rows.length}`} sub={`من ${RAW_ROW_COUNT} صف خام`} tier={p.tiers.de} locked={done('de') ? undefined : 'بعد محطة هندسة البيانات'} />
            <Kpi label="خطأ نموذجك على أسبوع جديد" value={`±${p.run.ev.realMae.toFixed(1)}`} sub="طلب في الساعة" tier={p.tiers.ml} locked={done('ml') ? undefined : 'بعد محطة تعلم الآلة'} />
            <Kpi
              label="ذروة ليلة العيد"
              value={`${Math.round(Math.max(...p.eidForecast))}`}
              sub={`توقعك · الواقع ${Math.round(Math.max(...p.eidTruth))}`}
              tier={eidTier(p)}
              locked={done('ml') ? undefined : 'بعد محطة تعلم الآلة'}
            />
            <Kpi label="نتيجة ليلة العيد" value={`${p.outcome.upset}`} sub={upsetAr(p.outcome.upset)} tier={p.outcome.tier} locked={done('bi') ? undefined : 'بعد محطة ذكاء الأعمال'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">
            <EidChart p={p} ready={done('ml')} />

            {/* decisions */}
            <div className="rounded-2xl bg-white border border-ink-200/70 p-5 shadow-card min-w-0">
              <h3 className="font-bold mb-3">قراراتك</h3>
              <ul className="divide-y divide-ink-100">
                {STATION_ORDER.map((id) => {
                  const s = stationById(id);
                  const st = nodes.find((n) => n.id === id)!.status;
                  return (
                    <li key={id}>
                      <button onClick={() => visit(id)} className="w-full flex items-center gap-3 py-2.5 text-right hover:bg-ink-50 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-200">
                        <span className="grid place-items-center w-8 h-8 rounded-lg text-white shrink-0" style={{ background: st === 'pending' ? '#CBD2E3' : s.color }}>
                          <Icon name={s.icon} size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold">{s.ar}</span>
                          <span className={cx('block text-xs truncate', st === 'pending' ? 'text-ink-400' : 'text-ink-600')}>{st === 'pending' ? 'لسا ما وصلت لها' : built[id].decision}</span>
                        </span>
                        {st !== 'pending' && <TierBadge tier={st} className="shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* governance + career */}
            <div className="rounded-2xl bg-white border border-ink-200/70 p-5 shadow-card min-w-0">
              <h3 className="font-bold mb-2">المسار الأقرب لك</h3>
              {career ? (
                <div className="space-y-2">
                  {career.ranked.slice(0, 3).map((id, i) => {
                    const s = stationById(id);
                    return (
                      <div key={id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={cx(i === 0 && 'font-bold')}>{s.ar}</span>
                          <span className="tabular-nums text-ink-500">{career.fit(id)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${career.fit(id)}%`, background: s.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink-500">يظهر بعد ما تجاوب أسئلة «اكتشف مسارك» في نهاية الرحلة.</p>
              )}
              <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between gap-2 text-sm">
                <span className="text-ink-600">مراجعة الحوكمة</span>
                {!done('gov') ? (
                  <span className="text-ink-400 text-xs">بعد المحطة السادسة</span>
                ) : critical ? (
                  <TierBadge tier="harm" />
                ) : (
                  <span className="font-bold text-emerald-600">✓ معتمد</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-ink-200/70 p-5 shadow-card min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">إنجازاتك</h3>
                <span className="text-sm text-ink-500 tabular-nums">
                  {earned.filter((e) => core.some((a) => a.id === e)).length} من {core.length}
                </span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                {ACHIEVEMENTS.map((a) => {
                  const got = earned.includes(a.id);
                  return (
                    <div key={a.id} title={`${a.name}: ${a.how}`} className={cx('aspect-square rounded-xl grid place-items-center text-2xl border', got ? 'bg-amber-50 border-amber-200' : 'bg-ink-50 border-ink-100 grayscale opacity-40')}>
                      <span aria-label={`${a.name}${got ? ' — مكتسب' : ' — غير مكتسب'}`} role="img">
                        {a.icon}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
