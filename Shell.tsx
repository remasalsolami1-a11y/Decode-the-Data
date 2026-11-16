import { CSSProperties, ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import { CHARACTERS, CONCEPTS, STATIONS, StationMeta, greetingFor, stationById } from './stations';
import { SCREEN_ORDER, STATION_ORDER, StationId, firstName, isFast, useStore } from './store';
import { Avatar } from './Avatar';
import { fixAwaitingDecision, useProject } from './project';
import { Icon } from './Icon';
import { Button, Card, cx, Modal } from './ui';
import { CLUB_NAVY, LOGO_MARK } from './logoMark';
import { DashboardButton } from './MyDashboard';

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5" dir="ltr">
      <span
        className={cx('grid place-items-center w-9 h-9 rounded-xl shrink-0', light && 'ring-1 ring-white/20')}
        style={{ background: CLUB_NAVY }}
      >
        <img src={LOGO_MARK} alt="" width={28} height={28} className="w-7 h-7" draggable={false} />
      </span>
      <span
        className={cx('leading-[1.05] font-black tracking-tight text-[13px] uppercase', compact && 'hidden sm:inline', light ? 'text-white' : 'text-[#1F2754]')}
        style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
      >
        Data Science
        <br />
        Club
      </span>
      <span className="sr-only">Data Science Club</span>
    </span>
  );
}

export function Header() {
  const { state, go, dispatch } = useStore();
  const [confirm, setConfirm] = useState(false);
  const doneCount = STATION_ORDER.filter((s) => state.completed[s]).length;
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-ink-200/60">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-1.5 sm:gap-3">
        <button onClick={() => go('landing')} className="rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200" aria-label="الصفحة الرئيسية">
          <Logo compact />
        </button>
        <nav aria-label="تقدم الرحلة" className="flex-1 min-w-0 flex justify-center">
          <ol className="flex items-center gap-1 sm:gap-1.5">
            {STATIONS.map((s) => {
              const done = !!state.completed[s.id];
              const current = state.screen === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => go('map')}
                    title={`${s.num}. ${s.ar}${done ? ' — مكتملة' : ''}`}
                    aria-label={`${s.num}. ${s.ar}${done ? ' — مكتملة' : current ? ' — المحطة الحالية' : ''}`}
                    aria-current={current ? 'step' : undefined}
                    className={cx(
                      'h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200',
                      current ? 'w-6 sm:w-10' : 'w-3.5 sm:w-7',
                    )}
                    style={{ background: done || current ? s.color : '#DCE0EE', opacity: current && !done ? 0.6 : 1 }}
                  />
                </li>
              );
            })}
          </ol>
          <span className="hidden sm:inline text-xs text-ink-500 ms-3 tabular-nums">{doneCount}/6</span>
        </nav>
        <DashboardButton />
        <Button variant="ghost" size="sm" icon="map" onClick={() => go('map')} aria-label="خريطة الرحلة">
          <span className="hidden sm:inline">الخريطة</span>
        </Button>
        <button
          onClick={() => dispatch({ type: 'set', patch: { presenter: !state.presenter } })}
          aria-pressed={state.presenter}
          title="وضع المقدّم: خط أكبر، نقاط للشرح، وفتح جميع المحطات"
          className={cx(
            'hidden md:flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200',
            state.presenter ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 text-ink-600 hover:border-ink-400',
          )}
        >
          <Icon name="present" size={15} />
          وضع المقدّم
        </button>
        <button
          onClick={() => setConfirm(true)}
          className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200"
          aria-label="البدء من جديد"
          title="البدء من جديد"
        >
          <Icon name="restart" size={18} />
        </button>
      </div>
      <Modal open={confirm} title="تبدأ الرحلة من جديد؟" onClose={() => setConfirm(false)}>
        <p className="text-ink-600 mb-5">سيتم مسح تقدمك واختياراتك المحفوظة على هذا الجهاز، وتبدأ من الصفحة الرئيسية.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => {
              dispatch({ type: 'reset' });
              setConfirm(false);
              go('landing');
            }}
          >
            نعم، ابدأ من جديد
          </Button>
        </div>
      </Modal>
    </header>
  );
}

/** suggested minutes per station: [workshop, full] */
export const DURATIONS: Record<StationId, [number, number]> = { de: [4, 7], da: [4, 7], ds: [4, 7], ml: [4, 7], bi: [4, 6], gov: [4, 6] };

const TALKING_POINTS: Record<StationId, string[]> = {
  de: ['اسأل: لو بنينا تحليلًا على بيانات فيها تكرار، وش بيصير؟', 'وضّح أن 60–80% من وقت مشاريع البيانات يذهب للتجهيز والتنظيف.', 'اربط: كل المحطات القادمة تعتمد على هذا الجدول.'],
  da: ['خلّ المشاركين يجربون الفلاتر قبل ما تعطيهم الجواب.', 'لحظة يوم 27 (الراتب): اسألهم قبل الكشف «ليش تتوقعون هذا اليوم أعلى؟»', 'ركّز على الفرق بين "ملاحظة" و"استنتاج تدعمه البيانات".', 'التقرير الناتج هو ما سيبني عليه عالم البيانات.'],
  ds: ['قصة عدد الموظفين: ارتباط قوي جدًا لكنه ليس سببًا — وهو غير معروف مسبقًا.', 'ليلة العيد ويوم الراتب: عوامل نعرف مواعيدها مسبقًا، فتصلح للتنبؤ.', 'فرّق بين علم البيانات (يحقق ويقترح) وهندسة تعلم الآلة (ينفّذ ويقيّم ويشغّل).', 'الحرارة: ارتباط ضعيف — ليس كل متغير متاح مفيدًا.'],
  ml: ['اشرح فكرة بيانات الاختبار: النموذج لم يرَ الأسبوع الرابع أبدًا.', 'الأرقام محسوبة فعليًا في المتصفح على بيانات تعليمية — ليست أرقامًا تسويقية.', 'النموذج وحده لا يكفي: قيمته عندما يصير خاصية يستخدمها الناس.'],
  bi: ['اسأل: لو أنتِ أم فهد، وش أول رقم تبين تشوفينه الصبح؟', 'خلّهم يجربون «نخلي الجدول مثل ما هو» ويشوفون ليلة العيد تنهار — ثم يرجعون.', 'المؤشر الجيد مرتبط بقرار. "عدد المتابعين" لا يساعد في قرار التوظيف.', 'اختيار نوع الرسم جزء من الوضوح وليس زينة.'],
  gov: ['ذكّرهم بلمسات الحوكمة في كل محطة سابقة.', 'قرار بيع الأرقام: خذ تصويت سريع من القاعة قبل ما تكشف الجواب.', 'مبدأ أقل صلاحية لازمة (Least Privilege).', 'أي قيمة غريبة: لا نحذفها بصمت — نعلّمها ونتحقق من مصدرها.'],
};

/** Lets every Step know which station it belongs to (for «edit»). */
const StationCtx = createContext<StationId | null>(null);

export function StationShell({ meta, children }: { meta: StationMeta; children: ReactNode }) {
  const { state } = useStore();
  const style = { '--accent': meta.color, '--accent-soft': meta.soft } as CSSProperties;
  return (
    <div style={style} className="pb-24">
      <section className="relative overflow-hidden border-b border-ink-200/60" style={{ background: `linear-gradient(180deg, ${meta.soft}, #FBFAF7)` }}>
        <div className="absolute inset-0 opacity-[.35] pointer-events-none" style={{ backgroundImage: `radial-gradient(${meta.color}22 1px, transparent 1px)`, backgroundSize: '18px 18px' }} />
        <div className="relative max-w-4xl mx-auto px-4 pt-8 pb-7">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: meta.color }}>
            <span className="grid place-items-center w-7 h-7 rounded-lg text-white" style={{ background: meta.color }}>
              <Icon name={meta.icon} size={16} />
            </span>
            المحطة {meta.num} من 6
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink-950 leading-tight">
            {meta.ar}
            <bdi dir="ltr" className="block sm:inline sm:mr-3 text-lg sm:text-xl font-medium text-ink-500 font-mono">
              {meta.en}
            </bdi>
          </h1>
          <p className="mt-3 text-lg text-ink-700 max-w-2xl leading-relaxed">{meta.objective}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {meta.presenter && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-ink-200 px-3 py-1">
                <Icon name="user" size={14} />
                يقدّمها: <b>{meta.presenter}</b>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-ink-200 px-3 py-1">
              <Icon name="spark" size={14} />
              المخرج: {meta.output}
            </span>
          </div>
          <div className="mt-5 flex items-end gap-3 max-w-2xl">
            <Avatar c={CHARACTERS[meta.id]} size={64} bg={meta.color + '22'} className="shrink-0 animate-pop" />
            <div className="relative rounded-2xl rounded-br-sm bg-white border border-ink-200 shadow-card px-4 py-3 text-[15px] leading-relaxed animate-rise">
              <div className="text-xs font-bold mb-0.5" style={{ color: meta.color }}>
                {CHARACTERS[meta.id].name}
              </div>
              {greetingFor(meta.id, firstName(state))}
            </div>
          </div>
          {isFast(state) && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold">
              ⚡ نسخة الورشة: بعض الخطوات تنجز تلقائيًا
            </div>
          )}
          {state.presenter && (
            <details className="mt-4 rounded-xl bg-ink-900 text-white px-4 py-3 text-sm max-w-2xl" open>
              <summary className="cursor-pointer font-bold">
                🎤 للمقدّم فقط · المدة المقترحة {isFast(state) ? DURATIONS[meta.id][0] : DURATIONS[meta.id][1]} دقائق
              </summary>
              <ul className="mt-2 space-y-1 list-disc pe-1 ps-5 text-white/85">
                {TALKING_POINTS[meta.id].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>
      <StationCtx.Provider value={meta.id}>
        <div className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
          <GovFixBanner id={meta.id} />
          <Explore id={meta.id} color={meta.color} />
          {children}
        </div>
      </StationCtx.Provider>
    </div>
  );
}

/** Two levels of explanation: simple first, then "Explore further" for those who want more. */
export function Explore({ id, color }: { id: StationId; color: string }) {
  const { state, dispatch } = useStore();
  const c = CONCEPTS[id];
  const [open, setOpen] = useState(false);
  const toggle = () => {
    setOpen(!open);
    if (!open && !(state.explored ?? []).includes(id)) dispatch({ type: 'set', patch: { explored: [...(state.explored ?? []), id] } });
  };
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-xs font-bold rounded-md px-2 py-1 text-white" style={{ background: color }}>
          الفكرة ببساطة
        </span>
        <div className="flex-1">
          <div className="font-bold">{c.title}</div>
          <p className="text-[15px] text-ink-700 mt-0.5 leading-relaxed">{c.simple}</p>
          <button onClick={toggle} aria-expanded={open} className="mt-2 text-sm font-semibold underline underline-offset-4" style={{ color }}>
            {open ? 'إخفاء التفاصيل' : 'استكشف أكثر ←'}
          </button>
          {open && (
            <div className="mt-2 rounded-xl bg-ink-50 p-3 animate-rise">
              <ul className="space-y-1.5 text-[15px] text-ink-800 list-disc ps-5">
                {c.deeper.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <div className="text-sm text-ink-500 mt-2">{c.pro}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One guided interaction. Hidden until the previous one is done. */
export function Step({
  n,
  reached,
  title,
  instruction,
  children,
  skipped,
}: {
  n: number;
  reached: number;
  title: string;
  instruction?: ReactNode;
  children: ReactNode;
  /** auto-completed in the workshop version */
  skipped?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = n <= reached + 1;
  const done = n <= reached;
  const stationId = useContext(StationCtx);
  const { state, dispatch } = useStore();
  /** reopen this step: later steps hide again, and everything downstream recomputes from the new choice */
  const reopen = () => {
    if (!stationId) return;
    const cur = (state.station[stationId] ?? {}) as { noAuto?: number[] };
    dispatch({ type: 'patchStation', id: stationId, patch: { step: n - 1, noAuto: [...new Set([...(cur.noAuto ?? []), n - 1])] } });
  };
  // sent back by governance → jump straight to the step that needs fixing
  useEffect(() => {
    const fix = stationId && (state.station[stationId] as { govFix?: unknown } | undefined)?.govFix;
    if (fix && visible && !done) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const t = setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.scrollY - 200; // leave room for the sticky header + fix banner
        window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      }, 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (visible && !done && n > 1) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => ref.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 120);
    }
  }, [visible, done, n]);
  if (skipped && done) {
    return (
      <details className="group rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-3">
        <summary className="flex items-center gap-3 cursor-pointer list-none">
          <span className="grid place-items-center w-8 h-8 rounded-full bg-amber-400 text-white text-sm font-bold">⚡</span>
          <span className="font-medium text-ink-700">{title}</span>
          <span className="ms-auto text-xs text-amber-800 font-semibold">أُنجزت تلقائيًا في نسخة الورشة · اضغط للعرض</span>
        </summary>
        <div className="mt-3">
          {children}
          {stationId && (
            <div className="mt-3 flex justify-end">
              <button onClick={reopen} className="text-sm font-semibold rounded-lg border border-amber-300 bg-white px-3 py-1.5 hover:border-amber-500">
                جرّبها بنفسك
              </button>
            </div>
          )}
        </div>
      </details>
    );
  }
  if (!visible) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ink-200 px-5 py-4 text-ink-400">
        <span className="grid place-items-center w-8 h-8 rounded-full bg-ink-100 text-sm font-bold">{n}</span>
        <span className="font-medium">{title}</span>
        <Icon name="lock" size={16} className="ms-auto" />
      </div>
    );
  }
  return (
    <div ref={ref} className="scroll-mt-20 animate-rise">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <span
            className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-sm font-bold text-white transition-colors"
            style={{ background: done ? '#10B981' : 'var(--accent)' }}
          >
            {done ? <Icon name="check" size={16} stroke={3} /> : n}
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-ink-950">{title}</h2>
            {instruction && <p className="text-ink-600 mt-1 leading-relaxed">{instruction}</p>}
          </div>
          {done && stationId && (
            <button
              onClick={reopen}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-semibold text-ink-700 hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200"
              aria-label={`عدّل: ${title}`}
              title="ارجع لهذه الخطوة وغيّر قرارك — النتائج بعدها تتحدث تلقائيًا"
            >
              ✎ عدّل
            </button>
          )}
        </div>
        {children}
      </Card>
    </div>
  );
}

/** Output + profession explanation + continue button at the end of a station. */
export function StationOutro({ meta, output, onContinue, nextLabel }: { meta: StationMeta; output: ReactNode; onContinue: () => void; nextLabel: string }) {
  const { state, go } = useStore();
  const govReviewing = meta.id !== 'gov' && ((state.station.gov as { step?: number } | undefined)?.step ?? 0) >= 4;
  return (
    <div className="space-y-5 animate-rise">
      <div className="rounded-2xl p-5 sm:p-6 text-white shadow-lift relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color}, #111833)` }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-2">
          <Icon name="spark" size={16} />
          مخرج المحطة — ينتقل للمرحلة التالية
        </div>
        {output}
      </div>
      <Card className="p-5 sm:p-6">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <span style={{ color: meta.color }}>
            <Icon name={meta.icon} />
          </span>
          وش يسوي {meta.role}؟
        </h3>
        <p className="text-ink-700 leading-relaxed">{meta.profession}</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-sm font-bold text-ink-500 mb-2">مهام يومية</div>
            <ul className="space-y-1.5 text-[15px]">
              {meta.dayToDay.map((d) => (
                <li key={d} className="flex gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-sm font-bold text-ink-500 mb-2">أدوات شائعة</div>
            <div className="flex flex-wrap gap-1.5" dir="ltr">
              {meta.tools.map((t) => (
                <span key={t} className="text-xs font-mono rounded-md bg-ink-100 px-2 py-1 text-ink-700">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <p className="text-sm text-ink-500">تقدمك محفوظ تلقائيًا على هذا الجهاز.</p>
        <div className="flex flex-wrap gap-2">
          {govReviewing && (
            <Button variant="secondary" size="lg" icon="shield" onClick={() => go('gov')}>
              ارجع لمراجعة الحوكمة
            </Button>
          )}
          <Button variant="accent" size="lg" iconEnd="arrow" onClick={onContinue}>
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function nextAfter(id: StationId) {
  const i = STATION_ORDER.indexOf(id);
  return i < 5 ? STATION_ORDER[i + 1] : 'system';
}
export function nextLabelFor(id: StationId) {
  const n = nextAfter(id);
  return n === 'system' ? 'شاهد النظام المكتمل' : `انتقل إلى ${stationById(n as StationId).ar}`;
}

/**
 * Workshop version: auto-complete chosen steps with their correct result.
 * `skips` maps a 0-based step index to the state patch that completes it.
 */
export function useFastSkip<T extends { step: number }>(st: T, set: (p: Partial<T>) => void, skips: Record<number, Partial<T>>) {
  const { state } = useStore();
  const fast = isFast(state);
  const noAuto = ((st as unknown as { noAuto?: number[] }).noAuto ?? []).includes(st.step);
  const patch = noAuto ? undefined : skips[st.step];
  useEffect(() => {
    if (fast && patch) set({ ...patch, step: st.step + 1, auto: [...(((st as unknown as { auto?: number[] }).auto) ?? []), st.step] } as unknown as Partial<T>);
  }, [fast, patch, st, set]);
  return (n: number) => fast && n - 1 in skips && !((st as unknown as { noAuto?: number[] }).noAuto ?? []).includes(n - 1);
}

/** Presenter / projector toolbar: big previous-next buttons and a timer for the current screen. */
export function PresenterBar() {
  const { state, go } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!state.presenter) return null;
  const i = SCREEN_ORDER.indexOf(state.screen);
  const prev = SCREEN_ORDER[i - 1];
  const next = SCREEN_ORDER[i + 1];
  const secs = Math.max(0, Math.floor((now - (state.screenAt ?? now)) / 1000));
  const isStation = (STATION_ORDER as string[]).includes(state.screen);
  const target = isStation ? DURATIONS[state.screen as StationId][isFast(state) ? 0 : 1] * 60 : 0;
  const over = target > 0 && secs > target;
  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl bg-ink-950 text-white shadow-lift p-1.5 print:hidden" role="toolbar" aria-label="أدوات المقدّم">
      <button disabled={!prev} onClick={() => prev && go(prev)} className="rounded-xl px-4 py-3 text-lg font-bold hover:bg-white/10 disabled:opacity-30" aria-label="الشاشة السابقة">
        →
      </button>
      <div className={cx('px-3 text-center tabular-nums min-w-[86px]', over && 'text-rose-300')} aria-live="off">
        <div className="text-xl font-bold leading-none">
          {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}
        </div>
        <div className="text-[10px] text-white/60 mt-1">{target ? `الهدف ${target / 60} د` : 'مؤقت الشاشة'}</div>
      </div>
      <button disabled={!next} onClick={() => next && go(next)} className="rounded-xl px-4 py-3 text-lg font-bold hover:bg-white/10 disabled:opacity-30" aria-label="الشاشة التالية">
        ←
      </button>
    </div>
  );
}

/** When governance sends the participant back to fix something, say exactly what — and confirm when it's fixed. */
function GovFixBanner({ id }: { id: StationId }) {
  const { state, dispatch, go } = useStore();
  const project = useProject();
  const fix = (state.station[id] as { govFix?: { id: string; title: string; hint: string } } | undefined)?.govFix;
  if (!fix) return null;
  const resolved = !project.audit.some((i) => i.id === fix.id) && !fixAwaitingDecision(state.station[id]);
  const dismiss = () => dispatch({ type: 'patchStation', id, patch: { govFix: undefined } });
  return (
    <div className={cx('sticky top-16 z-20 rounded-2xl border-2 p-4 shadow-lift', resolved ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50')} role="status" aria-live="polite">
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-xl" aria-hidden="true">
          {resolved ? '✅' : '🛡️'}
        </span>
        <div className="flex-1 min-w-[220px]">
          <div className="text-xs font-bold text-ink-500">{resolved ? 'تم الإصلاح' : 'مراجعة الحوكمة أرجعتك هنا بسبب:'}</div>
          <div className="font-bold">{fix.title}</div>
          {!resolved && fix.hint && (
            <p className="text-[15px] mt-1">
              <b>المطلوب: </b>
              {fix.hint}
            </p>
          )}
          {resolved && <p className="text-[15px] mt-1">المشكلة اختفت من المراجعة. كمّل خطوات المحطة أو ارجع للمراجعة مباشرة.</p>}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={resolved ? 'accent' : 'secondary'}
            icon="shield"
            onClick={() => {
              dismiss();
              go('gov');
            }}
          >
            ارجع للمراجعة
          </Button>
        </div>
      </div>
    </div>
  );
}
