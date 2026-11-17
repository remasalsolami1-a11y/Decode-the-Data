import { useMemo, useRef, useState } from 'react';
import { BarChart, LineChart } from './charts';
import { Button, Card, cx } from './ui';
import { Icon } from './Icon';
import { useStore } from './store';
import { CLUB_NAVY } from './logoMark';
import {
  FillStrategy,
  Roles,
  SAMPLES,
  Table,
  WEEKDAY_AR,
  clean,
  decodeText,
  detectRoles,
  looksHijri,
  fmtDateAr,
  fmtNum,
  inspect,
  parseCSV,
  parseXLSX,
  patterns,
} from './tabular';

const BLUE = '#2F6BFF';
const CYAN = '#06B6D4';

function StepHead({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={cx('grid place-items-center w-8 h-8 rounded-full text-sm font-bold text-white shrink-0', done ? 'bg-emerald-500' : '')} style={done ? undefined : { background: CLUB_NAVY }}>
        {done ? <Icon name="check" size={16} /> : n}
      </span>
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
  );
}
const Note = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-ink-500 mt-2 text-center">{children}</p>;

function BigStat({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'amber' | 'green' | 'ink' }) {
  const c = { red: 'text-rose-600 bg-rose-50 border-rose-200', amber: 'text-amber-600 bg-amber-50 border-amber-200', green: 'text-emerald-600 bg-emerald-50 border-emerald-200', ink: 'text-ink-900 bg-white border-ink-200' }[tone ?? 'ink'];
  return (
    <div className={cx('rounded-2xl border p-4 text-center transition-colors duration-500', c)}>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}

export function MyData() {
  const { go } = useStore();
  const [table, setTable] = useState<Table | null>(null);
  const [source, setSource] = useState('');
  const [roles, setRoles] = useState<Roles | null>(null);
  const [err, setErr] = useState('');
  const [fill, setFill] = useState<FillStrategy>('mean');
  const [cleaned, setCleaned] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (t: Table, name: string) => {
    const r = detectRoles(t);
    if (!t.rows.length) return setErr('الملف فاضي.');
    if (!r) return setErr(looksHijri(t) ? 'التواريخ في ملفك هجرية. حوّلها لميلادية في Excel وجرّب مرة ثانية.' : 'ما لقينا عمود تاريخ وعمود أرقام في الملف. نحتاج الاثنين عشان نرسم ونتوقع.');
    setErr('');
    setTable(t);
    setRoles(r);
    setSource(name);
    setCleaned(false);
    setTimeout(() => document.getElementById('md-cols')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const readFile = async (f: File) => {
    try {
      if (/\.xlsx$/i.test(f.name)) load(parseXLSX(await f.arrayBuffer()), f.name);
      else if (/\.(csv|txt|tsv)$/i.test(f.name)) load(parseCSV(decodeText(await f.arrayBuffer())), f.name);
      else if (/\.xls$/i.test(f.name)) setErr('هذا ملف Excel قديم (‎.xls). افتحه في Excel واحفظه بصيغة ‎.xlsx وجرّب مرة ثانية.');
      else setErr('نقدر نقرأ ملفات Excel (‎.xlsx) و CSV بس.');
    } catch {
      setErr('ما قدرنا نقرأ الملف. جرّب تحفظه من Excel بصيغة ‎.xlsx أو CSV.');
    }
  };
  const reset = () => {
    setTable(null);
    setRoles(null);
    setCleaned(false);
    setErr('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ins = useMemo(() => (table && roles ? inspect(table, roles) : null), [table, roles]);
  const recs = useMemo(() => (table && roles && ins && cleaned ? clean(table, roles, ins, fill) : null), [table, roles, ins, cleaned, fill]);
  const pat = useMemo(() => (recs ? patterns(recs) : null), [recs]);
  const missingRows = ins ? new Set([...ins.missingValueIdx, ...ins.missingDateIdx]).size : 0;
  const problems = ins ? ins.dupIdx.size + missingRows : 0;
  const valueName = table && roles ? table.headers[roles.value] : '';

  return (
    <div className="pb-24">
      <section className="bg-ink-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(#ffffff10 1px, transparent 1px), linear-gradient(90deg, #ffffff10 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="relative max-w-5xl mx-auto px-4 py-10 sm:py-12">
          <h1 className="text-3xl sm:text-5xl font-bold">جرّب على بياناتك</h1>
          <p className="text-white/70 mt-3 text-lg">نفس خطوات المطعم: تنظيف ← أنماط ← توقع. على ملفك أنت.</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
            <Icon name="lock" size={13} /> الملف يُقرأ داخل جهازك، وما يطلع لأي مكان
          </span>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 mt-8 space-y-6">
        {/* 1 · upload */}
        <Card className="p-5 sm:p-6">
          <StepHead n={1} title="اختر ملف" done={!!table} />
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) readFile(f);
            }}
            className={cx('w-full rounded-2xl border-2 border-dashed py-10 px-4 grid place-items-center gap-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200', drag ? 'border-cyan-500 bg-cyan-50' : 'border-ink-200 hover:border-ink-400 bg-ink-50/50')}
          >
            <span className="text-4xl" aria-hidden="true">
              📄
            </span>
            <span className="font-bold">{table ? source : 'اسحب ملفك هنا أو اضغط'}</span>
            <span className="text-xs text-ink-500">Excel ‎(.xlsx) أو CSV · فيه عمود تاريخ وعمود أرقام</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
              e.target.value = '';
            }}
          />
          {err && (
            <p className="mt-3 text-sm text-rose-600 font-semibold" role="alert">
              {err}
            </p>
          )}
          <div className="mt-5 text-sm font-bold text-ink-600 mb-2">ما عندك ملف؟ جرّب واحد جاهز:</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                onClick={() => load(s.table(), s.title)}
                className={cx('rounded-2xl border p-4 text-right transition hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200', source === s.title ? 'border-ink-900 bg-white shadow-card' : 'border-ink-200 bg-white')}
              >
                <span className="text-2xl" aria-hidden="true">
                  {s.icon}
                </span>
                <div className="font-bold mt-1">{s.title}</div>
                <div className="text-xs text-ink-500">{s.sub}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* 2 · columns */}
        {table && roles && ins && (
          <Card className="p-5 sm:p-6 animate-rise scroll-mt-20">
            <div id="md-cols" className="scroll-mt-20" />
            <StepHead n={2} title="عرفنا أعمدتك" done />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ['date', '📅', 'التاريخ'],
                  ['value', '🔢', 'الرقم'],
                  ['category', '🏷️', 'التصنيف'],
                ] as const
              ).map(([k, ic, label]) => (
                <label key={k} className="rounded-2xl border border-ink-200 bg-white p-3 flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {ic}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-ink-500">{label}</span>
                    <select
                      value={roles[k] ?? -1}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setRoles({ ...roles, [k]: k === 'category' && v < 0 ? null : v });
                        setCleaned(false);
                      }}
                      className="w-full font-bold bg-transparent focus:outline-none"
                    >
                      {k === 'category' && <option value={-1}>بدون</option>}
                      {table.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              ))}
            </div>
            <Note>{table.rows.length} صف · تقدر تغيّر أي عمود لو خمّنّاه غلط</Note>
          </Card>
        )}

        {/* 3 · clean */}
        {table && roles && ins && (
          <Card className="p-5 sm:p-6 animate-rise">
            <StepHead n={3} title="نظّفه" done={cleaned} />
            <div className="grid grid-cols-3 gap-3">
              <BigStat label="صف" value={fmtNum(cleaned && recs ? recs.length : ins.total)} />
              <BigStat label="مكرر" value={cleaned ? '0' : String(ins.dupIdx.size)} tone={cleaned ? 'green' : ins.dupIdx.size ? 'red' : 'green'} />
              <BigStat label="ناقص" value={cleaned ? '0' : String(missingRows)} tone={cleaned ? 'green' : missingRows ? 'amber' : 'green'} />
            </div>

            {!cleaned && problems > 0 && (
              <div className="mt-4 rounded-xl border border-ink-200 overflow-hidden text-sm">
                {[...new Set([...ins.dupIdx, ...ins.missingValueIdx, ...ins.missingDateIdx])]
                  .sort((a, b) => a - b)
                  .slice(0, 6)
                  .map((i) => {
                    const row = table.rows[i];
                    const dup = ins.dupIdx.has(i);
                    return (
                      <div key={i} className={cx('grid grid-cols-[auto_1fr_1fr_1fr] gap-3 px-3 py-2 border-b border-ink-100 last:border-0 items-center', dup ? 'bg-rose-50 text-rose-700 line-through decoration-rose-400' : 'bg-amber-50')}>
                        <span className="text-xs font-bold no-underline">{dup ? 'مكرر' : 'ناقص'}</span>
                        {[roles.date, roles.value, roles.category].map((c, j) => (
                          <span key={j} className={cx('truncate', c != null && row[c] == null && 'font-bold text-amber-700')}>
                            {c == null ? '' : row[c] == null ? '؟' : String(row[c])}
                          </span>
                        ))}
                      </div>
                    );
                  })}
              </div>
            )}

            {!cleaned && ins.missingValueIdx.size > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">الأرقام الناقصة:</span>
                {(
                  [
                    ['mean', 'عوّضها بالمتوسط'],
                    ['drop', 'احذفها'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} onClick={() => setFill(k)} aria-pressed={fill === k} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold border transition', fill === k ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 hover:border-ink-400')}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {!cleaned ? (
              <div className="mt-5">
                <Button variant="accent" icon="spark" onClick={() => setCleaned(true)}>
                  نظّف البيانات
                </Button>
              </div>
            ) : (
              <Note>
                ✓ حذفنا {ins.dupIdx.size} مكرر
                {ins.missingDateIdx.size ? ` و${ins.missingDateIdx.size} بدون تاريخ` : ''}
                {ins.missingValueIdx.size ? (fill === 'mean' ? ` وعوّضنا ${ins.missingValueIdx.size} بالمتوسط` : ` وحذفنا ${ins.missingValueIdx.size} ناقص`) : ''}
              </Note>
            )}
          </Card>
        )}

        {/* 4 · patterns */}
        {pat && roles && table && (
          <Card className="p-5 sm:p-6 animate-rise">
            <StepHead n={4} title="الأنماط" done />
            <div className={cx('grid gap-6', pat.byCategory.length ? 'lg:grid-cols-2' : '')}>
              <div className="min-w-0">
                <div className="font-bold text-sm mb-2 text-center">كل يوم في الأسبوع</div>
                <BarChart
                  ariaLabel={`متوسط ${valueName} لكل يوم في الأسبوع`}
                  values={pat.byWeekday}
                  labels={WEEKDAY_AR.map((d) => d.replace('ال', ''))}
                  highlight={pat.byWeekday.indexOf(Math.max(...pat.byWeekday))}
                  color={BLUE}
                  height={200}
                />
                <Note>
                  أعلى يوم: <b className="text-ink-800">{WEEKDAY_AR[pat.byWeekday.indexOf(Math.max(...pat.byWeekday))]}</b> · أقل يوم: {WEEKDAY_AR[pat.byWeekday.indexOf(Math.min(...pat.byWeekday))]}
                </Note>
              </div>
              {pat.byCategory.length > 0 && (
                <div className="min-w-0">
                  <div className="font-bold text-sm mb-2 text-center">حسب {table.headers[roles.category!]}</div>
                  <BarChart ariaLabel={`مجموع ${valueName} حسب التصنيف`} values={pat.byCategory.map((c) => c.total)} labels={pat.byCategory.map((c) => c.name)} highlight={0} color={CYAN} height={200} />
                  <Note>
                    الأكبر: <b className="text-ink-800">{pat.byCategory[0].name}</b> ({Math.round((pat.byCategory[0].total / pat.byCategory.reduce((a, b) => a + b.total, 0)) * 100)}% من المجموع)
                  </Note>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 5 · forecast */}
        {pat && (
          <Card className="p-5 sm:p-6 animate-rise">
            <StepHead n={5} title="التوقع" done />
            <div className="grid lg:grid-cols-[1fr_220px] gap-5 items-center">
              <div className="min-w-0">
                <LineChart
                  ariaLabel={`مجموع ${valueName} كل أسبوع، والتوقع للأسابيع الأربعة الجاية`}
                  labels={[...pat.weekly.map((w) => fmtDateAr(w.start)), 'أ+1', 'أ+2', 'أ+3', 'أ+4']}
                  labelEvery={Math.max(1, Math.ceil((pat.weekly.length + 4) / 8))}
                  series={[
                    { name: 'اللي صار', values: [...pat.weekly.map((w) => w.total), null, null, null, null], color: BLUE, area: true },
                    { name: 'التوقع', values: [...pat.weekly.map((_, i) => (i === pat.weekly.length - 1 ? pat.weekly[i].total : null)), ...pat.forecast], color: '#F59E0B', dashed: true },
                  ]}
                  height={220}
                />
              </div>
              <div className="rounded-2xl text-white p-5 text-center" style={{ background: CLUB_NAVY }}>
                <div className="text-xs text-white/70">الشهر الجاي تقريبًا</div>
                <div className="text-4xl font-bold tabular-nums mt-1">{fmtNum(pat.nextMonth)}</div>
                <div className="text-xs text-white/70 mt-1">{valueName}</div>
                <div className={cx('mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold', pat.trendPct > 2 ? 'bg-amber-400/20 text-amber-200' : pat.trendPct < -2 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/80')}>
                  {pat.trendPct > 2 ? `↑ ${pat.trendPct}% عن آخر شهر` : pat.trendPct < -2 ? `↓ ${Math.abs(pat.trendPct)}% عن آخر شهر` : 'تقريبًا نفس آخر شهر'}
                </div>
              </div>
            </div>
            <Note>تقدير بسيط من اتجاه {pat.weekly.length} أسابيع · كل ما زادت بياناتك صار أدق</Note>
          </Card>
        )}

        {table && (
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Button variant="secondary" icon="restart" onClick={reset}>
              جرّب ملف ثاني
            </Button>
            <Button variant="ghost" onClick={() => go('landing')}>
              الصفحة الرئيسية
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

