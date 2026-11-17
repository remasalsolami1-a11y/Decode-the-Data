import { useState } from 'react';
import { CHARACTERS, OWNER, STATIONS } from './stations';
import { Avatar } from './Avatar';
import { firstName, isUnlocked, Mode, STATION_ORDER, useStore } from './store';
import { Icon } from './Icon';
import { Button, Card, cx } from './ui';
import { Logo } from './Shell';
import { STATS, hourLabelAr } from './dataset';
import { CLUB_NAVY, LOGO_MARK } from './logoMark';
import { DataRiver } from './DataRiver';
import { riverNodes } from './MyDashboard';
import { useProject } from './project';

/** "When is DataBite busy?" — the average orders per hour, peak highlighted. A teaser of what the journey uncovers. */
function BusyHoursTeaser() {
  const rows = STATS.byHour;
  const max = Math.max(...rows.map((r) => r.value));
  const peak = rows.find((r) => r.value === max)!;
  const short = (h: number) => (h === 12 ? '12ظ' : `${h % 12}م`);
  return (
    <section className="max-w-6xl mx-auto px-4 pt-16">
      <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-8 items-center">
        <div>
          <h2 className="text-3xl font-bold">متى يزدحم مطعم DataBite؟</h2>
          <p className="text-ink-600 mt-3 text-lg leading-relaxed">
            هذا متوسط عدد الطلبات في كل ساعة، من بيانات المطعم اللي بتشتغل عليها. الذروة واضحة الساعة <b className="text-ink-900">{hourLabelAr(peak.hour)}</b> — بس ليش بعض الليالي أزحم بكثير من غيرها؟ هذا اللي بتكتشفه في الرحلة.
          </p>
        </div>
        <div className="rounded-3xl bg-white border border-ink-200/70 shadow-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="font-bold">متوسط الطلبات في كل ساعة</div>
              <div className="text-xs text-ink-500 mt-0.5">كل أيام الأسبوع · 4 أسابيع</div>
            </div>
            <span className="shrink-0 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 px-3 py-1 text-sm font-bold">الذروة: {hourLabelAr(peak.hour)}</span>
          </div>
          <div className="flex items-stretch gap-1 sm:gap-2 h-52 pt-5" dir="ltr" role="img" aria-label={`متوسط الطلبات لكل ساعة، الذروة ${hourLabelAr(peak.hour)} بمتوسط ${Math.round(max)} طلب`}>
            {rows.map((r) => {
              const isPeak = r.hour === peak.hour;
              return (
                <div key={r.hour} className="flex-1 h-full flex flex-col items-center">
                  <div className="relative w-full flex-1 flex items-end">
                    <div className={cx('relative w-full rounded-t-md', isPeak ? 'bg-cyan-500' : 'bg-ink-200')} style={{ height: `${(r.value / max) * 100}%` }} title={`${hourLabelAr(r.hour)}: ${Math.round(r.value)} طلب`}>
                      {isPeak && <span className="absolute -top-5 inset-x-0 text-center text-xs font-bold text-cyan-700 tabular-nums">{Math.round(r.value)}</span>}
                    </div>
                  </div>
                  <bdi dir="rtl" className={cx('text-[10px] sm:text-[11px] mt-1.5 tabular-nums whitespace-nowrap', isPeak ? 'font-bold text-cyan-700' : 'text-ink-500')}>{short(r.hour)}</bdi>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-ink-400 mt-3">ظ = الظهر · م = بعد الظهر والمساء · بيانات تعليمية</div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  // the club mark, large, with a slow glow and a few drifting "data points"
  const dots = [
    [12, 22, 7], [86, 18, 5], [92, 62, 6], [8, 70, 5], [20, 88, 4], [78, 88, 6], [50, 6, 4],
  ];
  return (
    <div className="relative mx-auto w-full max-w-[420px] aspect-square" aria-hidden="true">
      <div className="absolute inset-[12%] rounded-full blur-3xl opacity-50 animate-pulse" style={{ background: 'radial-gradient(#3B6EF5, transparent 70%)', animationDuration: '4s' }} />
      <div className="absolute inset-[18%] rounded-[2.5rem] border border-white/10 shadow-lift grid place-items-center" style={{ background: CLUB_NAVY }}>
        <img src={LOGO_MARK} alt="" className="w-[78%] h-[78%] object-contain select-none" draggable={false} />
      </div>
      {dots.map(([x, y, r], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-cyan-300/70 hero-float"
          style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, animationDelay: `${i * 0.7}s`, boxShadow: '0 0 12px rgba(34,211,238,.7)' }}
        />
      ))}
      <div className="absolute bottom-[4%] inset-x-0 text-center">
        <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70 tracking-wide" dir="ltr">
          Data Science Club
        </span>
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

      <BusyHoursTeaser />

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

      <section className="max-w-6xl mx-auto px-4 pb-4">
        <button onClick={() => go('mydata')} className="w-full rounded-3xl p-6 text-right text-white flex flex-wrap items-center gap-4 hover:opacity-95 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-300" style={{ background: CLUB_NAVY }}>
          <span className="text-4xl" aria-hidden="true">📊</span>
          <span className="flex-1 min-w-[220px]">
            <span className="block font-bold text-xl">عندك ملف Excel؟ جرّب على بياناتك</span>
            <span className="block text-white/70 mt-1">مصاريفك، مبيعات، حضور… نظّفه وشوف أنماطه وتوقع الشهر الجاي. الملف ما يطلع من جهازك.</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white text-ink-950 font-bold px-4 py-2.5">
            جرّب الحين <Icon name="arrow" size={18} />
          </span>
        </button>
      </section>
      <footer className="border-t border-ink-200/70 py-6 text-center text-sm text-ink-500">
        البيانات المستخدمة وهمية لأغراض تعليمية. · Decode the Data
      </footer>
    </div>
  );
}

export function Mission() {
  const { state, dispatch, go } = useStore();
  const first = firstName(state);
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
          {first ? (
            <>أهلًا {first}، تشرفنا! عندي بيانات طلبات أربعة أسابيع، وما أعرف وش أسوي فيها. خلني أحكيك وش صار… اضغط على المشاهد.</>
          ) : (
            <>أهلًا وسهلًا! قبل ما أحكيك وش صار في مطعمي… وش اسمك؟</>
          )}
        </div>
      </div>

      <div className="mt-4 max-w-2xl rounded-2xl bg-white border border-ink-200 shadow-card p-4">
        <label htmlFor="mission-name" className="font-bold block mb-2">
          وش اسمك؟
        </label>
        <input
          id="mission-name"
          value={state.name}
          maxLength={40}
          autoComplete="given-name"
          onChange={(e) => dispatch({ type: 'set', patch: { name: e.target.value } })}
          placeholder="اكتب اسمك الأول"
          className="w-full rounded-xl border-2 border-ink-200 px-4 py-2.5 text-[16px] focus:border-ink-900 focus:outline-none"
        />
        <p className="text-xs text-ink-500 mt-2">اختياري — الفريق بيناديك فيه طول الرحلة، ويبقى على جهازك فقط.</p>
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
  const project = useProject();
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

      <div className="relative rounded-3xl bg-ink-950 px-3 sm:px-6 pt-4 pb-3 mb-8 overflow-hidden">
        <div className="absolute inset-0 opacity-25 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#ffffff10 1px, transparent 1px), linear-gradient(90deg, #ffffff10 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="relative flex items-center justify-between text-xs text-white/60">
          <span className="font-semibold text-white/80">نهر البيانات</span>
          <span className="hidden sm:inline">بياناتك تمشي من محطة لمحطة — وأي قرار ضار يلوّث كل اللي بعده</span>
        </div>
        <div className="relative">
          <DataRiver nodes={riverNodes(state, project)} onSelect={(id) => go(id)} canSelect={(id) => isUnlocked(state, id)} height={150} />
        </div>
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
                {s.presenter && <div className="text-xs text-ink-400 mt-2">يقدّمها: {s.presenter}</div>}
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
