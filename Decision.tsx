import { ReactNode } from 'react';
import { Tier, TIER_COLOR, TIER_LABEL } from '../data/project';
import { cx } from './ui';

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white', className)} style={{ background: TIER_COLOR[tier] }}>
      {tier === 'best' ? '★' : tier === 'cost' ? '◐' : '⚠'} {TIER_LABEL[tier]}
    </span>
  );
}

/** "What this decision did" — always shown with real computed numbers. */
export function Impact({ tier, title, children }: { tier: Tier; title: string; children: ReactNode }) {
  const bg = tier === 'best' ? 'bg-emerald-50 border-emerald-200' : tier === 'cost' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
  return (
    <div className={cx('rounded-xl border p-4 animate-rise', bg)} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <TierBadge tier={tier} />
        <span className="font-bold">{title}</span>
      </div>
      <div className="text-[15px] leading-relaxed text-ink-800">{children}</div>
    </div>
  );
}

/** Shows which upstream outputs this station is working with. */
export function Inputs({ items }: { items: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-2xl bg-ink-950 text-white px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="text-white/60 font-semibold">📥 يصلك من المحطات السابقة:</span>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: i.color ?? '#22D3EE' }} />
          <span className="text-white/70">{i.label}:</span>
          <b>{i.value}</b>
        </span>
      ))}
    </div>
  );
}
