import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveRestaurant, simulate } from './LiveRestaurant';
import { Button } from './ui';

/**
 * "See the consequence of your mistake": fast-forward to the night the wrong
 * choice would hit the restaurant, then rewind (VHS style) back to the decision.
 */
export function Consequence({
  open,
  headline,
  story,
  hour,
  orders,
  staff,
  eid,
  lesson,
  onRewind,
  onProceed,
}: {
  open: boolean;
  headline: string;
  story: string;
  hour: number;
  orders: number;
  staff: number;
  eid?: boolean;
  lesson: string;
  onRewind: () => void;
  /** harmful decisions can still be kept — their damage then flows downstream and governance will flag it */
  onProceed?: () => void;
}) {
  const [rewinding, setRewinding] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) {
      setRewinding(false);
      setTimeout(() => btn.current?.focus({ preventScroll: true }), 50);
    }
  }, [open]);
  if (!open) return null;
  const sim = simulate(orders, staff);
  const rewind = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setRewinding(true);
    setTimeout(onRewind, reduce ? 10 : 1100);
  };
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-ink-950/90 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label={headline}>
      <div className={rewinding ? 'vhs-rewind' : 'animate-pop'}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-amber-300 font-mono text-sm mb-2" dir="ltr">
            ▶▶ FAST-FORWARD
          </div>
          <h2 className="text-white text-2xl sm:text-3xl font-bold">{headline}</h2>
          <p className="text-white/75 mt-2 text-lg">{story}</p>
          <div className="mt-5">
            <LiveRestaurant hour={hour} orders={orders} staff={staff} eid={eid} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <div className="rounded-xl bg-rose-500/15 border border-rose-400/30 p-3">
              <div className="text-3xl font-bold text-rose-300 tabular-nums">{sim.upset}</div>
              <div className="text-xs text-white/70">عميل زعلان</div>
            </div>
            <div className="rounded-xl bg-amber-500/15 border border-amber-400/30 p-3">
              <div className="text-3xl font-bold text-amber-300 tabular-nums">{sim.waitLabel}</div>
              <div className="text-xs text-white/70">وقت الانتظار</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/15 p-3">
              <div className="text-2xl tracking-wider" aria-label={`${sim.stars} من 5 نجوم`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < sim.stars ? 'text-amber-300' : 'text-white/20 star-fall'} style={{ animationDelay: `${i * 0.15}s` }}>
                    ★
                  </span>
                ))}
              </div>
              <div className="text-xs text-white/70">تقييم المطعم الليلة</div>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-white/10 text-white p-4 text-[15px] leading-relaxed">💡 {lesson}</div>
          <div className="mt-5 flex flex-wrap gap-3 justify-center items-center">
            <Button ref={btn} size="lg" className="!bg-white !text-ink-950" onClick={rewind} disabled={rewinding}>
              ⏪ ارجع وصلّحها
            </Button>
            {onProceed && (
              <button onClick={onProceed} className="text-sm text-white/70 underline underline-offset-4 hover:text-white px-3 py-2">
                كمّل بهذا القرار وشوف أثره على باقي المشروع
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
