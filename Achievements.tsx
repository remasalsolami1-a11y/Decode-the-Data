import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { featuresTier, useProject, Project } from './project';
import { AppState, STATION_ORDER, useStore } from './store';
import { cx } from './ui';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  how: string;
  optional?: boolean;
}
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'detective', icon: '🔍', name: 'محقق البيانات', how: 'اكتشفت بنفسك أنواع المشاكل الثلاث في البيانات الخام' },
  { id: 'cleaner', icon: '🧹', name: 'منظّف البيانات', how: 'عالجت القيم المفقودة بأفضل طريقة وموثّقة' },
  { id: 'explorer', icon: '📈', name: 'مستكشف الأنماط', how: 'وجدت ليلة العيد ويوم الراتب في البيانات' },
  { id: 'selector', icon: '🧪', name: 'منتقي الخصائص', how: 'اخترت خصائص مفيدة نعرفها مسبقًا وبدون تسرّب' },
  { id: 'builder', icon: '🤖', name: 'باني النماذج', how: 'درّبت نموذجًا وقيّمته بأمانة على بيانات لم يرها' },
  { id: 'decider', icon: '📊', name: 'صانع القرار', how: 'خطة توظيف ليلة العيد نجحت فعلًا بدون هدر' },
  { id: 'guardian', icon: '🛡️', name: 'حارس البيانات', how: 'اعتمدت النظام بدون مشاكل حرجة ورفضت بيع بيانات العملاء' },
  { id: 'drift', icon: '🌙', name: 'مروّض الانحراف', how: 'أنقذت النظام في تحدي رمضان', optional: true },
  { id: 'deep', icon: '📚', name: 'القارئ المتعمق', how: 'فتحت «استكشف أكثر» في 3 محطات', optional: true },
];

type Any = Record<string, unknown>;
export function earnedAchievements(state: AppState, p: Project): string[] {
  const st = (id: string) => (state.station[id as 'de'] ?? {}) as Any;
  const auto = (id: string) => ((st(id).auto as number[]) ?? []);
  const out: string[] = [];
  if (((st('de').found as string[]) ?? []).length === 3 && !auto('de').includes(0)) out.push('detective');
  if (st('de').missing === 'sameSlot' && state.completed.de) out.push('cleaner');
  const special = (st('da').special as number[]) ?? [];
  if (special.includes(18) && special.includes(9)) out.push('explorer');
  if (st('ds').featuresDone && featuresTier(p.d.ds) === 'best') out.push('selector');
  if (st('ml').snip === 'c' && st('ml').trained) out.push('builder');
  if (st('bi').planStaff != null && p.outcome.tier === 'best') out.push('decider');
  if (STATION_ORDER.every((x) => state.completed[x]) && st('gov').ethic === 'consent' && !p.audit.some((i) => i.severity === 'critical')) out.push('guardian');
  if (state.boss.done) out.push('drift');
  if ((state.explored ?? []).length >= 3) out.push('deep');
  return out;
}

export function Achievements({ compact }: { compact?: boolean }) {
  const { state } = useStore();
  const p = useProject();
  const earned = earnedAchievements(state, p);
  return (
    <div>
      <div className="text-sm text-ink-600 mb-3">
        {earned.filter((e) => !ACHIEVEMENTS.find((a) => a.id === e)?.optional).length} من 7 أساسية · الإنجازات تُكتسب من نتائج حقيقية، مو من مجرد التنقل.
      </div>
      <ul className={cx('grid gap-2', compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
        {ACHIEVEMENTS.map((a) => {
          const on = earned.includes(a.id);
          return (
            <li key={a.id} className={cx('rounded-xl border p-3 text-center', on ? 'border-cyan-300 bg-cyan-50' : 'border-dashed border-ink-200 bg-white opacity-70')}>
              <div className={cx('text-2xl', !on && 'grayscale opacity-50')} aria-hidden="true">
                {a.icon}
              </div>
              <div className="font-bold text-sm mt-1">{a.name}</div>
              {!compact && <div className="text-[11px] text-ink-500 mt-0.5 leading-snug">{a.how}</div>}
              {a.optional && <div className="text-[10px] text-ink-400 mt-0.5">تحدٍّ اختياري</div>}
              <span className="sr-only">{on ? 'مكتسب' : 'غير مكتسب بعد'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Shows a small toast when a new achievement is earned (persisted so it only appears once). */
export function AchievementWatcher() {
  const { state, dispatch } = useStore();
  const p = useProject();
  const earned = earnedAchievements(state, p);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number>();
  useEffect(() => {
    const fresh = earned.filter((e) => !(state.awarded ?? []).includes(e));
    if (!fresh.length) return;
    dispatch({ type: 'set', patch: { awarded: [...(state.awarded ?? []), ...fresh] } });
    setToast(fresh[fresh.length - 1]);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3800);
  }, [earned.join(','), state.awarded, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!toast) return null;
  const a = ACHIEVEMENTS.find((x) => x.id === toast)!;
  return createPortal(
    <div role="status" aria-live="polite" className="fixed top-20 inset-x-0 z-[70] flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink-950 text-white shadow-lift px-4 py-3 animate-pop">
        <span className="text-2xl">{a.icon}</span>
        <div>
          <div className="text-xs text-cyan-300 font-bold">إنجاز جديد</div>
          <div className="font-bold">{a.name}</div>
          <div className="text-xs text-white/70">{a.how}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
