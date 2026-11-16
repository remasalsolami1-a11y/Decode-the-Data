import { CSSProperties, ReactNode, useState } from 'react';
import { STATIONS, StationMeta, stationById } from './stations';
import { HOURS, WEEKDAYS, fmtHour, hourLabelAr, round1, staffFor, thu21 } from './dataset';
import { CONFIG_INFO, crowdLevel, realInputs } from './model';
import { FEATURE_AR, Project, TIER_LABEL, useProject } from './project';
import { StationId, useStore } from './store';
import { Icon } from './Icon';
import { Button, Chip, SimLabel, cx } from './ui';
import { BarChart } from './charts';
import { ChartType, DashboardView, Scenario, WidgetId } from './Dashboard';
import { LiveRestaurant } from './LiveRestaurant';
import { Lineage } from './Lineage';
import { TierBadge } from './Decision';
import { Achievements } from './Achievements';

function Panel({ meta, title, children, wide, id }: { meta?: StationMeta; title: string; children: ReactNode; wide?: boolean; id?: string }) {
  const color = meta?.color ?? '#111833';
  return (
    <section id={id} className={cx('bg-white rounded-2xl border border-ink-200/70 shadow-card overflow-hidden scroll-mt-20', wide && 'lg:col-span-2')} style={{ '--accent': color, '--accent-soft': meta?.soft ?? '#EEF0F7' } as CSSProperties}>
      <div className="h-1.5" style={{ background: color }} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-lg">{title}</h2>
          {meta && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 shrink-0" style={{ background: meta.soft, color: meta.color }}>
              <Icon name={meta.icon} size={13} />
              {meta.ar}
            </span>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/** What the participant decided in each station, and what it did — computed, not scripted. */
function youBuilt(p: Project): Record<StationId, { decision: string; impact: string }> {
  const d = p.d;
  return {
    de: {
      decision: `القيم المفقودة: ${{ sameSlot: 'متوسط نفس اليوم والساعة', overall: 'المتوسط العام', drop: 'حذف الصفوف', zero: 'صفر' }[d.de.missing]}`,
      impact: `${p.clean.rows.length} سجل نظيف بُني عليه كل شي بعده. متوسط الخميس 9 مساءً في بياناتك ${thu21(p.clean.rows)} طلب.`,
    },
    da: {
      decision: d.da.conclusion === 'right' ? 'استنتاج يصف النمط كما تثبته الأرقام' : 'استنتاج فيه ادعاء سبب (العروض)',
      impact: `الذروة ${hourLabelAr(p.stats.peak.hour)} (${p.stats.peak.value} طلب)، وأزحم يوم ${WEEKDAYS[p.stats.busiestDay]}، وليلة العيد +${p.deviation[18].pct}%.`,
    },
    ds: {
      decision: p.features.length ? `${p.features.length} خصائص: ${p.features.map((f) => FEATURE_AR[f]).join('، ')}` : 'منهج بلا خصائص (رقم واحد)',
      impact: `بها يتوقع النموذج ذروة ليلة العيد ${Math.round(Math.max(...p.eidForecast))} طلب (الواقع ${Math.round(Math.max(...p.eidTruth))}).`,
    },
    ml: {
      decision: CONFIG_INFO[d.ml.config].ar,
      impact: `خطأ معلن ±${p.run.ev.mae.toFixed(1)}، وعلى أسبوع جديد ±${p.run.ev.realMae.toFixed(1)} طلب/ساعة.`,
    },
    bi: {
      decision: `${d.bi.kpis.length} مؤشرات · ${d.bi.staff ?? p.recommendedStaff} موظفين ليلة العيد (${d.bi.scope === 'evening' ? 'المساء' : 'اليوم كامل'})`,
      impact: `النتيجة: ${p.outcome.upset} عميل زعلان، أقصى انتظار ${p.outcome.maxWait} دقيقة، رواتب ${p.outcome.labor.toLocaleString('en')} ريال.`,
    },
    gov: {
      decision: d.gov.ethic === 'consent' ? 'رفض مشاركة أرقام العملاء بدون موافقة + تقنيع وصلاحيات' : 'تقنيع وصلاحيات وقواعد جودة',
      impact: `المراجعة: ${p.audit.filter((i) => i.severity === 'critical').length} حرج، ${p.audit.filter((i) => i.severity === 'warning').length} تحذير، ${p.audit.filter((i) => i.severity === 'info').length} ملاحظة.`,
    },
  };
}

const FIX: Record<StationId, { step: number; patch: Record<string, unknown> }> = {
  de: { step: 2, patch: { missing: null } },
  da: { step: 3, patch: { concl: null } },
  ds: { step: 3, patch: { featuresDone: false, featureOk: false } },
  ml: { step: 0, patch: { snip: null, trained: false } },
  bi: { step: 3, patch: { planStaff: null } },
  gov: { step: 3, patch: { ethic: null } },
};

export function CompletedSystem() {
  const { state, go, dispatch } = useStore();
  const p = useProject();
  const model = p.run.model;
  const ev = p.run.ev;
  const [sc, setSc] = useState<Scenario>({ weekday: 4, eid: false, event: false, promo: false, payday: false, adjust: 0 });
  const [hour, setHour] = useState(21);
  const [staffOverride, setStaffOverride] = useState<number | null>(null);
  const pred = round1(model.predict(realInputs({ weekday: sc.weekday, hour, promo: sc.promo, event: sc.event && hour >= 19, eid: sc.eid && hour >= 18, payday: sc.payday, day: 60 })) * (1 + sc.adjust / 100));
  const lvl = crowdLevel(pred);
  const staff = staffOverride ?? staffFor(pred);
  const bi = (state.station.bi ?? {}) as { board?: WidgetId[]; kpis?: string[]; charts?: Record<string, ChartType> };
  const board = bi.board?.length ? bi.board : (['kpis', 'forecast', 'hourly'] as WidgetId[]);
  const kpis = bi.kpis?.length ? bi.kpis : ['avgDaily', 'peakHour', 'tonight', 'staff'];
  const S = (id: StationId) => stationById(id);
  const built = youBuilt(p);
  const critical = p.audit.filter((i) => i.severity === 'critical').length;
  const revisit = (id: StationId) => {
    dispatch({ type: 'patchStation', id, patch: { step: FIX[id].step, ...FIX[id].patch } });
    go(id);
  };
  const fc = HOURS.map((h) => round1(model.predict(realInputs({ weekday: sc.weekday, hour: h, promo: sc.promo, event: sc.event && h >= 19, eid: sc.eid && h >= 18, payday: sc.payday, day: 60 })) * (1 + sc.adjust / 100)));
  const set = (patch: Partial<Scenario>) => {
    setSc({ ...sc, ...patch });
    setStaffOverride(null);
  };

  return (
    <div className="pb-24">
      <section className="bg-ink-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(#ffffff22 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative max-w-6xl mx-auto px-4 py-10 sm:py-14">
          <div className="text-sm font-semibold text-cyan-300 mb-2">النظام المكتمل · فرع الكورنيش، جدة</div>
          <h1 className="text-3xl sm:text-5xl font-bold">نظام DataBite الذكي لتوقع الازدحام</h1>
          <p className="text-white/70 mt-3 text-lg max-w-2xl">كل رقم في هذه الصفحة محسوب من قراراتك أنت في المحطات الست. غيّر قرارًا — يتغير النظام كله.</p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            {[
              ['جودة البيانات', `${p.clean.rows.length} سجل`, p.tiers.de],
              ['دقة النموذج', `±${ev.realMae.toFixed(1)}`, p.tiers.ml],
              ['ليلة العيد', `${p.outcome.upset} زعلان`, p.outcome.tier],
              ['الحوكمة', critical ? `${critical} حرج` : 'معتمد', critical ? 'harm' : p.audit.length ? 'cost' : 'best'],
            ].map(([l, v, t]) => (
              <div key={l} className="rounded-xl bg-white/10 px-3 py-2.5">
                <div className="text-xs text-white/60">{l}</div>
                <div className="font-bold text-lg tabular-nums">{v}</div>
                <TierBadge tier={t as 'best'} className="mt-1" />
              </div>
            ))}
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            <Icon name="eye" size={13} /> البيانات والتوقعات محاكاة تعليمية — ليست توقعات تشغيلية لمطعم حقيقي
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 -mt-6 relative grid lg:grid-cols-2 gap-4">
        <Panel title="🧪 ماذا لو؟ جرّب سيناريوهات على نظامك" wide meta={S('ml')}>
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-5 items-start">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d, i) => (
                  <Chip key={d} active={sc.weekday === i} onClick={() => set({ weekday: i })}>
                    {d}
                  </Chip>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-bold flex justify-between">
                  الساعة <bdi dir="ltr">{fmtHour(hour)}</bdi>
                </span>
                <input type="range" min={12} max={23} value={hour} onChange={(e) => (setHour(Number(e.target.value)), setStaffOverride(null))} className="w-full accent-[var(--accent)]" dir="ltr" aria-label="الساعة" />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['eid', 'ليلة العيد'],
                    ['payday', 'يوم 27 (الراتب)'],
                    ['event', 'فعالية على الكورنيش'],
                    ['promo', 'عرض ترويجي'],
                  ] as const
                ).map(([k, l]) => (
                  <Chip key={k} active={sc[k]} onClick={() => set({ [k]: !sc[k] } as Partial<Scenario>)}>
                    {sc[k] ? '✓' : '+'} {l}
                    {!p.features.includes(k) && <span className="text-[10px] opacity-70"> (نموذجك ما يعرفه)</span>}
                  </Chip>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-bold flex justify-between">
                  نشاط إضافي متوقع (حجز جماعي مثلًا) <bdi dir="ltr">{sc.adjust > 0 ? '+' : ''}{sc.adjust}%</bdi>
                </span>
                <input type="range" min={-30} max={50} step={10} value={sc.adjust} onChange={(e) => set({ adjust: Number(e.target.value) })} className="w-full accent-[var(--accent)]" dir="ltr" aria-label="نشاط إضافي" />
                <span className="text-[11px] text-ink-500">تعديل يدوي واضح فوق توقع النموذج — ليس جزءًا من النموذج نفسه.</span>
              </label>
              <SimLabel>نموذجك المدرّب · {CONFIG_INFO[p.run.config].ar} · خطأ متوقع ±{ev.realMae.toFixed(1)}</SimLabel>
            </div>
            <div className="rounded-2xl p-5 text-center border-2" style={{ borderColor: lvl.color }} aria-live="polite">
              <div className="text-sm text-ink-500">
                {WEEKDAYS[sc.weekday]} · <bdi dir="ltr">{fmtHour(hour)}</bdi>
              </div>
              <div className="text-5xl font-bold tabular-nums my-1" style={{ color: lvl.color }}>
                {Math.round(pred)}
              </div>
              <div className="text-sm text-ink-500">طلب متوقع</div>
              <div className="mt-2 inline-block rounded-full px-3 py-1 text-white font-bold text-sm" style={{ background: lvl.color }}>
                {lvl.label}
              </div>
              <div className="text-sm mt-2">
                فريق مقترح: <b>{staffFor(pred)}</b> · اليوم كامل: <b>{Math.round(fc.reduce((a, b) => a + b, 0))}</b> طلب
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="font-bold">المطعم الحي 🔴</div>
              <div className="flex items-center gap-2 text-sm">
                <span>الموظفون:</span>
                <button className="w-8 h-8 rounded-lg border border-ink-200 font-bold hover:border-ink-400" onClick={() => setStaffOverride(Math.max(1, staff - 1))} aria-label="موظف أقل">
                  −
                </button>
                <b className="tabular-nums w-6 text-center">{staff}</b>
                <button className="w-8 h-8 rounded-lg border border-ink-200 font-bold hover:border-ink-400" onClick={() => setStaffOverride(Math.min(16, staff + 1))} aria-label="موظف أكثر">
                  +
                </button>
                {staffOverride != null && (
                  <button className="text-xs underline text-ink-500" onClick={() => setStaffOverride(null)}>
                    حسب النموذج
                  </button>
                )}
              </div>
            </div>
            <LiveRestaurant hour={hour} orders={pred} staff={staff} eid={sc.eid} caption="كل شي هنا محسوب: التوقع من نموذجك، والانتظار من نموذج طابور بسيط (موظف لكل 8 طلبات/ساعة)." />
          </div>
          <div className="mt-5">
            <div className="font-bold mb-2">لوحة الإدارة لهذا السيناريو</div>
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 flex items-center gap-2">
              <Icon name="shield" size={14} /> التوقعات تقديرية من نموذج إحصائي ويُتوقع هامش خطأ. (أُضيف في مراجعة الحوكمة)
            </div>
            <DashboardView widgets={board.filter((w) => w !== 'raw')} kpis={kpis} charts={bi.charts ?? {}} accent={S('bi').color} scenario={sc} />
          </div>
        </Panel>

        <Panel title="🛠️ أنت بنيت هذا النظام" wide id="you-built">
          <p className="text-ink-600 mb-4">قراراتك في كل محطة، وأثرها المحسوب على النظام. تقدر ترجع لأي قرار وتغيّره — والنظام يتحدّث تلقائيًا.</p>
          <ol className="space-y-2.5">
            {STATIONS.map((s) => (
              <li key={s.id} className="rounded-xl border border-ink-200 p-3 flex flex-wrap items-start gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-lg text-white shrink-0" style={{ background: s.color }}>
                  <Icon name={s.icon} size={18} />
                </span>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{s.ar}</b>
                    <TierBadge tier={p.tiers[s.id]} />
                    {p.d.source[s.id] === 'default' && <span className="text-[11px] rounded bg-ink-100 px-1.5 py-0.5 text-ink-500">قيمة افتراضية</span>}
                  </div>
                  <div className="text-[15px] mt-1">
                    <span className="text-ink-500">قرارك: </span>
                    {built[s.id].decision}
                  </div>
                  <div className="text-sm text-ink-600 mt-0.5">
                    <span className="text-ink-500">أثره: </span>
                    {built[s.id].impact}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => revisit(s.id)}>
                  عدّل القرار
                </Button>
              </li>
            ))}
          </ol>
          <p className="text-xs text-ink-500 mt-3">التقييمات ({Object.values(TIER_LABEL).join(' / ')}) محسوبة من نتائج مشروعك، وليست درجات اختبار.</p>
        </Panel>

        <Panel title="🧭 مسار البيانات: من الكاشير إلى قرار أم فهد" wide>
          <Lineage p={p} />
        </Panel>

        <Panel meta={S('ml')} title="ملخص تقييم النموذج">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-ink-50 py-3">
              <div className="text-xs text-ink-500">الخطأ المعلن ({CONFIG_INFO[p.run.config].test})</div>
              <div className="text-2xl font-bold tabular-nums">±{ev.mae.toFixed(1)}</div>
            </div>
            <div className={cx('rounded-xl py-3', ev.realMae > ev.mae + 0.5 ? 'bg-rose-50' : 'bg-emerald-50')}>
              <div className="text-xs text-ink-500">الخطأ على أسبوع جديد</div>
              <div className="text-2xl font-bold tabular-nums">±{ev.realMae.toFixed(1)}</div>
            </div>
          </div>
          <BarChart ariaLabel="توقع ليلة العيد من نموذجك" values={p.eidForecast.map(Math.round)} labels={HOURS.map(String)} color={S('ml').color} height={140} compare={{ values: p.eidTruth.map(Math.round), color: '#111833', label: 'الطلب الحقيقي', mainLabel: 'توقع نموذجك' }} />
          <p className="text-sm text-ink-600 mt-2">ليلة العيد: توقع نموذجك مقابل الطلب الحقيقي في المحاكاة.</p>
        </Panel>

        <Panel meta={S('gov')} title="حالة الجودة والخصوصية">
          {p.audit.length ? (
            <ul className="space-y-1.5 text-[15px]">
              {p.audit.map((i) => (
                <li key={i.id} className="flex gap-2">
                  <span className={cx('mt-1.5 w-2.5 h-2.5 rounded-full shrink-0', i.severity === 'critical' ? 'bg-rose-500' : i.severity === 'warning' ? 'bg-amber-500' : 'bg-ink-300')} />
                  {i.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-emerald-800 font-semibold">✓ لا توجد مشاكل في قرارات المشروع.</p>
          )}
          <ul className="space-y-1.5 text-[15px] mt-3 pt-3 border-t border-ink-100">
            <li className="flex gap-2">
              <Icon name="lock" size={17} className="text-green-600 shrink-0 mt-0.5" /> الاسم والجوال والعنوان مقنّعة · صلاحيات حسب الدور
            </li>
            <li className="flex gap-2">
              <Icon name="check" size={17} className="text-green-600 shrink-0 mt-0.5" /> قواعد جودة تلقائية في أنبوب البيانات
            </li>
            <li className="flex gap-2">
              <Icon name="shield" size={17} className="text-green-600 shrink-0 mt-0.5" />
              {p.d.gov.ethic === 'consent' ? 'لا مشاركة لأرقام العملاء بدون موافقة صريحة (نظام حماية البيانات الشخصية)' : 'قرار مشاركة البيانات يحتاج مراجعة'}
            </li>
          </ul>
        </Panel>

        <Panel title="🏅 إنجازاتك" wide>
          <Achievements />
        </Panel>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8">
        {state.boss.done ? (
          <div className="rounded-2xl bg-white border-2 border-ink-900 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-bold text-xl">بقي سؤال واحد: أي جزء استمتعت فيه أكثر؟</div>
              <p className="text-ink-600 mt-1">تأمل قصير يساعدك تكتشف المسارات الأقرب لاهتماماتك.</p>
            </div>
            <Button size="lg" iconEnd="arrow" onClick={() => go('career')}>
              اكتشف مسارك
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl bg-rose-950 text-white p-6 flex flex-wrap items-center justify-between gap-4 shadow-lift">
            <div>
              <div className="font-bold text-xl">🚨 رسالة عاجلة من أم فهد…</div>
              <p className="text-white/70 mt-1">بعد أشهر من الإطلاق صار شي غريب. الفريق يحتاجك في تحدٍّ أخير (اختياري).</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="text-sm text-white/60 underline underline-offset-4 hover:text-white" onClick={() => go('career')}>
                تخطَّ إلى اكتشاف مسارك
              </button>
              <Button size="lg" className="!bg-white !text-rose-950" iconEnd="arrow" onClick={() => go('ramadan')}>
                افتح الرسالة
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
