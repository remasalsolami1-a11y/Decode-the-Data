import { useState } from 'react';
import { DUPLICATE_COUNT, MISSING_CELLS, RAW_ROW_COUNT, WEEKDAYS, fmtHour } from './dataset';
import { CONFIG_INFO } from './model';
import { FEATURE_AR, Project, traceNumber } from './project';
import { STATIONS } from './stations';
import { Icon } from './Icon';
import { cx } from './ui';

interface Stage {
  id: string;
  owner: string;
  color: string;
  icon: (typeof STATIONS)[number]['icon'];
  title: string;
  input: string;
  op: string;
  output: string;
  trace: string;
}

/** Interactive data lineage: every stage is computed from the participant's own project. */
export function Lineage({ p }: { p: Project }) {
  const t = traceNumber(p);
  const S = (id: string) => STATIONS.find((s) => s.id === id)!;
  const missingAr = { sameSlot: 'متوسط نفس اليوم والساعة', overall: 'المتوسط العام', drop: 'حذف الصفوف', zero: 'صفر' }[p.d.de.missing];
  const stages: Stage[] = [
    {
      id: 'src', owner: 'المصادر', color: '#5B6690', icon: 'store', title: 'الكاشير + تطبيق التوصيل',
      input: 'طلبات حقيقية من المطعم',
      op: 'تسجيل آلي لكل طلب',
      output: `${RAW_ROW_COUNT} صف خام · ${DUPLICATE_COUNT} مكرر · ${MISSING_CELLS.length} خانة فاضية · صيغتا وقت`,
      trace: `${t.when}: الكاشير ما سجّل طلبات الصالة (انقطاع). التوصيل سجّل ${t.rawDelivery} طلب.`,
    },
    {
      id: 'de', owner: S('de').ar, color: S('de').color, icon: S('de').icon, title: 'تنظيف ودمج',
      input: `${RAW_ROW_COUNT} صف خام`,
      op: `حذف ${DUPLICATE_COUNT} مكررات · القيم المفقودة: ${missingAr} · توحيد الوقت · دمج المصدرين`,
      output: `${p.clean.rows.length} سجل ساعي نظيف`,
      trace: t.cleanedOrders == null ? 'الصف انحذف — هذه الساعة ما عادت موجودة في البيانات.' : `الصالة = ${t.cleanedDinein} (${p.d.de.missing === 'sameSlot' ? 'مُقدّرة' : p.d.de.missing === 'zero' ? 'صفر!' : 'متوسط عام'}) ← الإجمالي ${t.cleanedOrders} طلب (الحقيقي كان ${t.trueOrders}).`,
    },
    {
      id: 'da', owner: S('da').ar, color: S('da').color, icon: S('da').icon, title: 'تحليل الأنماط',
      input: `${p.clean.rows.length} سجل`,
      op: 'متوسطات حسب الساعة واليوم · مقارنة الأيام الاستثنائية',
      output: `ذروة ${fmtHour(p.stats.peak.hour)} · أزحم يوم ${WEEKDAYS[p.stats.busiestDay]} · ليلة العيد +${p.deviation[18].pct}%`,
      trace: `هذه الساعة دخلت في متوسط «الخميس 9 مساءً» = ${t.thu21} طلب.`,
    },
    {
      id: 'ds', owner: S('ds').ar, color: S('ds').color, icon: S('ds').icon, title: 'اختيار الخصائص والمنهج',
      input: 'تقرير التحليل + الجدول',
      op: `المنهج: ${{ combined: 'انحدار يجمع العوامل', hourly: 'متوسط كل ساعة', overall: 'متوسط عام' }[p.d.ds.approach]}`,
      output: p.features.length ? p.features.map((f) => FEATURE_AR[f]).join('، ') : 'بدون خصائص',
      trace: `النموذج بيعرف عن هذه الساعة: ${p.features.length ? p.features.map((f) => FEATURE_AR[f]).join('، ') : 'لا شيء'}.`,
    },
    {
      id: 'ml', owner: S('ml').ar, color: S('ml').color, icon: S('ml').icon, title: 'تدريب وتقييم',
      input: `${p.run.ev.trainRows} سجل تدريب`,
      op: CONFIG_INFO[p.run.config].ar,
      output: `خطأ معلن ±${p.run.ev.mae.toFixed(1)} · حقيقي ±${p.run.ev.realMae.toFixed(1)}`,
      trace: `توقع النموذج لهذه الساعة: ${t.prediction} طلب.`,
    },
    {
      id: 'bi', owner: S('bi').ar, color: S('bi').color, icon: S('bi').icon, title: 'لوحة وقرار',
      input: 'توقعات النموذج',
      op: `${p.d.bi.kpis.length} مؤشرات · خطة ${t.staff} موظفين ليلة العيد`,
      output: `${p.outcome.upset} عميل زعلان · رواتب ${p.outcome.labor.toLocaleString('en')} ريال`,
      trace: `ليلة العيد الساعة 9 مساءً: اللوحة تعرض ${t.eidForecast21} طلب ← ${t.staff} موظفين.`,
    },
    {
      id: 'gov', owner: S('gov').ar, color: S('gov').color, icon: S('gov').icon, title: 'مراجعة وحماية',
      input: 'كل ما سبق',
      op: 'تقنيع البيانات الشخصية · صلاحيات · قواعد جودة · مراجعة القرارات',
      output: `${p.audit.filter((i) => i.severity === 'critical').length} حرج · ${p.audit.filter((i) => i.severity === 'warning').length} تحذير`,
      trace: 'مصدر هذا الرقم موثّق: «مُقدّر/معدّل في محطة 1» — أي أحد يقدر يتتبعه.',
    },
  ];
  const [sel, setSel] = useState('de');
  const [trace, setTrace] = useState(false);
  const cur = stages.find((s) => s.id === sel)!;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-ink-600">اضغط على أي مرحلة لتشوف وش دخلها، وش صار فيها، ووش طلع منها.</p>
        <button
          onClick={() => setTrace(!trace)}
          aria-pressed={trace}
          className={cx('rounded-full px-3 py-1.5 text-sm font-semibold border transition', trace ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 hover:border-ink-400')}
        >
          🔎 تتبّع رقمًا واحدًا
        </button>
      </div>
      <ol className="flex items-stretch gap-1 overflow-x-auto pb-2" aria-label="مسار البيانات">
        {stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSel(s.id)}
              aria-pressed={sel === s.id}
              className={cx('w-[118px] rounded-xl border-2 p-2.5 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-200', sel === s.id ? 'shadow-lift' : 'border-ink-200 bg-white hover:border-ink-400')}
              style={sel === s.id ? { borderColor: s.color, background: s.color + '12' } : undefined}
            >
              <span className="grid place-items-center w-7 h-7 rounded-lg text-white mb-1.5" style={{ background: s.color }}>
                <Icon name={s.icon} size={15} />
              </span>
              <div className="text-[11px] text-ink-500 leading-tight">{s.owner}</div>
              <div className="text-sm font-bold leading-tight">{s.title}</div>
              {trace && <div className="text-[11px] mt-1 font-semibold" style={{ color: s.color }}>● تتبع</div>}
            </button>
            {i < stages.length - 1 && <Icon name="arrow" size={16} className="text-ink-300 shrink-0" />}
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl border-2 p-4 animate-rise" style={{ borderColor: cur.color }} key={cur.id + String(trace)}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold rounded-md px-2 py-0.5 text-white" style={{ background: cur.color }}>
            {cur.owner}
          </span>
          <span className="font-bold">{cur.title}</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-[15px]">
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-xs font-bold text-ink-500 mb-1">📥 المدخل</div>
            {cur.input}
          </div>
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-xs font-bold text-ink-500 mb-1">⚙️ وش صار</div>
            {cur.op}
          </div>
          <div className="rounded-xl p-3" style={{ background: cur.color + '14' }}>
            <div className="text-xs font-bold text-ink-500 mb-1">📤 المخرج ← للمرحلة التالية</div>
            <b>{cur.output}</b>
          </div>
        </div>
        {trace && (
          <div className="mt-3 rounded-xl bg-ink-950 text-white p-3 text-[15px]">
            <span className="text-cyan-300 font-bold">🔎 الرقم المتتبَّع: </span>
            {cur.trace}
          </div>
        )}
      </div>
    </div>
  );
}
