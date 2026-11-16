import { useEffect, useState } from 'react';
import { CHARACTERS, OWNER, STATIONS } from './stations';
import { Avatar } from './Avatar';
import { STATS, hourLabelAr, WEEKDAYS } from './dataset';
import { isUnlocked, Mode, STATION_ORDER, useStore } from './store';
import { Icon } from './Icon';
import { Button, Card, cx } from './ui';
import { Logo } from './Shell';

function HeroVisual() {
  // animated "crowd over the day" bars built from the real hourly profile
  const vals = STATS.byHour.map((x) => x.value);
  const max = Math.max(...vals);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setT(1);
    const id = setTimeout(() => setT(1), 150);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[.04] p-5 backdrop-blur-sm" dir="ltr">
      <div className="flex items-center justify-between text-white/60 text-xs mb-4 font-mono">
        <span>databite.orders_by_hour</span>
        <span className="flex items-center gap-1.5">
          <i className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> live model
        </span>
      </div>
      <div className="flex items-end gap-1.5 h-44">
        {vals.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${(v / max) * 100 * t}%`,
                transition: `height .9s cubic-bezier(.2,.8,.2,1) ${i * 60}ms`,
                background: STATIONS[i % 6].color,
                opacity: v === max ? 1 : 0.55,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-white/40 mt-2 font-mono">
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      <div className="absolute -top-4 -left-4 rounded-2xl bg-white text-ink-900 px-3.5 py-2.5 shadow-lift text-right" dir="rtl">
        <div className="text-[11px] text-ink-500">ذروة متوقعة</div>
        <div className="font-bold">{hourLabelAr(STATS.peak.hour)} · {WEEKDAYS[STATS.busiestDay]}</div>
      </div>
    </div>
  );
}

export function Landing() {
  const { state, go } = useStore();
  const hasProgress = STATION_ORDER.some((s) => state.completed[s]) || (state.screen !== 'landing' && !!state.startedAt);
  const resumeTarget = STATION_ORDER.find((s) => !state.completed[s]) ?? 'system';
  return (
    <div>
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: 'linear-gradient(#ffffff10 1px, transparent 1px), linear-gradient(90deg, #ffffff10 1px, transparent 1px)', backgroundSize: '44px 44px' }}
        />
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(#3B6EF5, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-20 w-[420px] h-[420px] rounded-full blur-3xl opacity-25" style={{ background: 'radial-gradient(#22D3EE, transparent 70%)' }} />
        <div className="relative max-w-6xl mx-auto px-4 pt-6 pb-16 sm:pb-24">
          <div className="flex justify-between items-center mb-12 sm:mb-16">
            <Logo light />
            <span className="text-xs text-white/50">ورشة تفاعلية · بدون تسجيل</span>
          </div>
          <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-12 items-center">
            <div className="animate-rise">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80 mb-5">
                <Icon name="spark" size={14} />
                6 مسارات · مشروع واحد · 25–45 دقيقة
              </div>
              <h1 className="font-bold leading-[1.1] tracking-tight">
                <bdi dir="ltr" className="block text-5xl sm:text-6xl lg:text-7xl">
                  Decode the Data
                </bdi>
                <span className="block mt-3 text-3xl sm:text-4xl text-white/90">اكتشف البيانات واكتشف مسارك</span>
              </h1>
              <p className="mt-6 text-lg text-white/70 max-w-xl leading-relaxed">
                انضم لفريق تقني يساعد مطعم <b className="text-white">DataBite</b> على كورنيش جدة يتوقّع أوقات الازدحام — من ليلة العيد إلى يوم الراتب. في كل محطة تجرّب بنفسك عمل تخصص من تخصصات البيانات — وفي النهاية يكون عندك نظام ذكي ساهمت في بنائه، وفكرة أوضح عن المسار اللي يناسبك.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="!bg-white !text-ink-950 hover:!bg-ink-100" iconEnd="arrow" onClick={() => go(hasProgress ? resumeTarget : 'mission')}>
                  {hasProgress ? 'أكمل رحلتك' : 'ابدأ الرحلة'}
                </Button>
                <Button
                  size="lg"
                  variant="dark"
                  onClick={() => document.getElementById('tracks')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  استكشف المسارات
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
                <li className="flex items-center gap-1.5">
                  <Icon name="check" size={16} className="text-emerald-400" /> لا تحتاج أي خبرة سابقة
                </li>
                <li className="flex items-center gap-1.5">
                  <Icon name="check" size={16} className="text-emerald-400" /> بدون كتابة أكواد
                </li>
                <li className="flex items-center gap-1.5">
                  <Icon name="check" size={16} className="text-emerald-400" /> يحفظ تقدمك تلقائيًا
                </li>
              </ul>
            </div>
            <div className="hidden sm:block animate-rise" style={{ animationDelay: '.15s' }}>
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      <section id="tracks" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
        <div className="max-w-2xl mb-8">
          <h2 className="text-3xl font-bold">ستة مسارات… تبني نظامًا واحدًا</h2>
          <p className="text-ink-600 mt-2 text-lg">كل مسار يستلم نتيجة المسار اللي قبله ويضيف عليها — مثل فريق حقيقي.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STATIONS.map((s) => (
            <Card key={s.id} className="p-5 group hover:shadow-lift transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <span className="grid place-items-center w-11 h-11 rounded-xl text-white" style={{ background: s.color }}>
                  <Icon name={s.icon} size={22} />
                </span>
                <span className="text-4xl font-bold text-ink-100 tabular-nums">0{s.num}</span>
              </div>
              <h3 className="text-xl font-bold">{s.ar}</h3>
              <bdi dir="ltr" className="block text-sm text-ink-500 font-mono">
                {s.en}
              </bdi>
              <p className="text-ink-600 mt-2">{s.verb}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white border border-ink-200 p-5">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-ink-100">
              <Icon name="clock" />
            </span>
            <div>
              <div className="font-bold">25 دقيقة (نسخة الورشة) أو 45 دقيقة (كاملة)</div>
              <div className="text-sm text-ink-500">تستخدمها مع المقدّمين في الورشة، أو لحالك في أي وقت.</div>
            </div>
          </div>
          <Button size="lg" iconEnd="arrow" onClick={() => go(hasProgress ? resumeTarget : 'mission')}>
            {hasProgress ? 'أكمل رحلتك' : 'ابدأ الرحلة'}
          </Button>
        </div>
      </section>
      <footer className="border-t border-ink-200/70 py-6 text-center text-sm text-ink-500">
        البيانات المستخدمة وهمية لأغراض تعليمية. · Decode the Data
      </footer>
    </div>
  );
}

export function Mission() {
  const { go } = useStore();
  const [scene, setScene] = useState(0);
  const scenes = [
    {
      t: 'ليلة العيد، الساعة 9',
      d: 'فرع DataBite على كورنيش جدة ممتلئ. الطابور وصل للشارع، وطلبات التوصيل تتراكم على الشاشة.',
      icon: 'store' as const,
    },
    {
      t: 'المطبخ ما يلحق',
      d: '5 موظفين بس في الوردية. وقت الانتظار تجاوز 50 دقيقة، وعملاء مشوا قبل ما يطلبون.',
      icon: 'clock' as const,
    },
    {
      t: 'والأسبوع اللي بعده…',
      d: 'يوم الاثنين المطعم شبه فاضي، و6 موظفين واقفين بدون شغل. أم فهد تخطط الورديات بالتخمين.',
      icon: 'user' as const,
    },
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
      <div className="text-sm font-semibold text-ink-500 mb-2">مقدمة المهمة</div>
      <h1 className="text-3xl sm:text-4xl font-bold">مطعم DataBite يحتاج فريقك</h1>
      <div className="mt-5 flex items-end gap-3 max-w-2xl">
        <Avatar c={OWNER} size={72} mood={scene >= 1 ? 'worried' : 'happy'} bg="#FDEDF3" className="shrink-0" />
        <div className="rounded-2xl rounded-br-sm bg-white border border-ink-200 shadow-card px-4 py-3 text-[16px] leading-relaxed">
          <div className="text-xs font-bold text-ink-500 mb-0.5">{OWNER.name} · صاحبة مطعم DataBite في جدة</div>
          عندي بيانات طلبات أربعة أسابيع، وما أعرف وش أسوي فيها. خلني أحكيك وش صار… اضغط على المشاهد.
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-8">
        {scenes.map((s, i) => (
          <button
            key={s.t}
            onClick={() => setScene(Math.max(scene, i + 1))}
            disabled={i > scene}
            className={cx(
              'text-right rounded-2xl border p-5 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200',
              i < scene ? 'bg-white border-ink-200 shadow-card' : i === scene ? 'bg-ink-900 text-white border-ink-900 shadow-lift animate-pop' : 'bg-ink-50 border-dashed border-ink-200 text-ink-300',
            )}
          >
            <Icon name={s.icon} size={24} className={i === scene ? 'text-white' : i < scene ? 'text-ink-700' : ''} />
            <div className="font-bold mt-3">{s.t}</div>
            {i < scene ? <p className="text-ink-600 mt-1.5 text-[15px] leading-relaxed animate-rise">{s.d}</p> : i === scene ? <p className="text-white/70 text-sm mt-1.5">اضغط لتشوف وش صار</p> : null}
          </button>
        ))}
      </div>

      {scene >= 3 && (
        <div className="mt-8 space-y-6 animate-rise">
          <Card className="p-6 sm:p-8 border-2 border-ink-900">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-500 mb-2">
              <Icon name="spark" size={16} /> مهمتك
            </div>
            <p className="text-2xl font-bold leading-snug">
              نبني نظامًا يستخدم البيانات <span className="underline decoration-[#E8467C] decoration-4 underline-offset-4">ليتوقع الازدحام</span> قبل ما يصير — عشان المطعم يجهّز الموظفين في الوقت الصح.
            </p>
            <p className="text-ink-600 mt-3">ما يقدر شخص واحد يبنيه. نحتاج ستة تخصصات، كل واحد يكمل شغل اللي قبله.</p>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="الفريق">
              {STATIONS.map((s, i) => (
                <div key={s.id} className="flex flex-col items-center gap-1 animate-pop" style={{ animationDelay: `${i * 90}ms` }}>
                  <Avatar c={CHARACTERS[s.id]} size={52} bg={s.soft} />
                  <span className="text-[11px] font-semibold" style={{ color: s.color }}>
                    {s.ar}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <ModePicker onPick={() => go('map')} />
        </div>
      )}
    </div>
  );
}

function ModePicker({ onPick }: { onPick: () => void }) {
  const { state, dispatch } = useStore();
  const pick = (mode: Mode) => {
    dispatch({ type: 'set', patch: { mode } });
    onPick();
  };
  return (
    <div>
      <div className="font-bold text-lg mb-3">كيف تبي تمشي الرحلة؟</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {(
          [
            ['workshop', '⚡ نسخة الورشة', 'حوالي 25 دقيقة. الخطوات الأساسية في كل محطة، والباقي ينجز تلقائيًا (وتقدر تفتحه وتشوفه).'],
            ['full', '🧭 النسخة الكاملة', 'حوالي 45 دقيقة. كل الخطوات والتجارب — مثالية لو تجرب لحالك على راحتك.'],
          ] as [Mode, string, string][]
        ).map(([m, t, d]) => (
          <button
            key={m}
            onClick={() => pick(m)}
            className={cx(
              'text-right rounded-2xl border-2 p-5 transition hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200',
              state.mode === m ? 'border-ink-900 bg-white' : 'border-ink-200 bg-white hover:border-ink-400',
            )}
          >
            <div className="text-xl font-bold">{t}</div>
            <p className="text-ink-600 mt-1.5 text-[15px]">{d}</p>
            <div className="mt-3 text-sm font-bold text-ink-900">ابدأ ←</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function JourneyMap() {
  const { state, go, dispatch } = useStore();
  const nextUp = STATION_ORDER.find((s) => !state.completed[s]);
  const allDone = !nextUp;
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-sm font-semibold text-ink-500 mb-2">خريطة الرحلة</div>
          <h1 className="text-3xl sm:text-4xl font-bold">من بيانات فوضوية إلى نظام ذكي</h1>
          <p className="text-ink-600 mt-2 text-lg">ست محطات متصلة. مخرج كل محطة هو مدخل المحطة اللي بعدها.</p>
          <div className="mt-4 inline-flex rounded-xl border border-ink-200 bg-white p-1 text-sm" role="radiogroup" aria-label="نسخة الرحلة">
            {(
              [
                ['workshop', '⚡ نسخة الورشة (~25 د)'],
                ['full', '🧭 كاملة (~45 د)'],
              ] as [Mode, string][]
            ).map(([m, l]) => (
              <button
                key={m}
                role="radio"
                aria-checked={state.mode === m}
                onClick={() => dispatch({ type: 'set', patch: { mode: m } })}
                className={cx('rounded-lg px-3 py-1.5 font-semibold transition', state.mode === m ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {allDone ? (
          <Button size="lg" iconEnd="arrow" onClick={() => go('system')}>
            شاهد النظام المكتمل
          </Button>
        ) : (
          <Button size="lg" iconEnd="arrow" onClick={() => go(nextUp!)}>
            {state.completed.de ? 'أكمل المحطة التالية' : 'ابدأ المحطة الأولى'}
          </Button>
        )}
      </div>

      <ol className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
        {STATIONS.map((s, i) => {
          const done = !!state.completed[s.id];
          const open = isUnlocked(state, s.id);
          const isNext = s.id === nextUp;
          return (
            <li key={s.id} className="relative">
              <button
                onClick={() => open && go(s.id)}
                disabled={!open}
                className={cx(
                  'w-full h-full text-right rounded-2xl border-2 p-5 bg-white transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200',
                  open ? 'hover:-translate-y-0.5 hover:shadow-lift' : 'opacity-60 cursor-not-allowed',
                  isNext ? 'shadow-lift' : 'shadow-card',
                )}
                style={{ borderColor: isNext || done ? s.color : '#EEF0F7' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl text-white" style={{ background: open ? s.color : '#B9C0DA' }}>
                    <Icon name={open ? s.icon : 'lock'} />
                  </span>
                  <div className="flex-1">
                    <div className="text-xs text-ink-500">المحطة {s.num}</div>
                    <div className="font-bold text-lg leading-tight">{s.ar}</div>
                  </div>
                  {done && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-1">
                      <Icon name="check" size={13} stroke={3} /> مكتملة
                    </span>
                  )}
                  {isNext && !done && <span className="text-xs font-bold rounded-full px-2 py-1 text-white" style={{ background: s.color }}>التالية</span>}
                </div>
                <p className="text-ink-600 text-[15px]">{s.verb}</p>
                <div className="mt-3 pt-3 border-t border-ink-100 text-sm flex items-start gap-1.5">
                  <Icon name="arrow" size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="text-ink-500">يسلّم: </span>
                    {s.output}
                  </span>
                </div>
                <div className="text-xs text-ink-400 mt-2">يقدّمها: {s.presenter}</div>
              </button>
              {i < 5 && <span className="hidden lg:block absolute top-1/2 -left-3 w-2 h-2 rounded-full bg-ink-300 z-10" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-green-300 bg-green-50/60 p-4 flex gap-3 items-start">
        <Icon name="shield" className="text-green-600 shrink-0 mt-0.5" />
        <p className="text-green-900">
          <b>ملاحظة مهمة:</b> حوكمة البيانات لها محطة مخصصة في النهاية، لكنها تمتد على كامل الرحلة. راقب "لمسات الحوكمة" الخضراء في كل محطة.
        </p>
      </div>
      {state.presenter && <p className="mt-4 text-sm text-ink-500">وضع المقدّم مفعّل: كل المحطات مفتوحة للتنقل الحر.</p>}
    </div>
  );
}
