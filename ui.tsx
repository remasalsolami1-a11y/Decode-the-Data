import { ButtonHTMLAttributes, CSSProperties, ReactNode, forwardRef, useEffect, useRef } from 'react';
import { findTerm, openGlossary } from './Glossary';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import type { IconName } from '../data/stations';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconEnd?: IconName;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', icon, iconEnd, className, children, ...rest }, ref) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.98] select-none';
  const sizes = { sm: 'text-sm px-3 py-1.5', md: 'text-[15px] px-4 py-2.5', lg: 'text-lg px-6 py-3.5' }[size];
  const variants = {
    primary: 'bg-ink-900 text-white hover:bg-ink-800 focus-visible:ring-ink-300 shadow-card',
    accent: 'bg-[var(--accent)] text-white hover:brightness-110 focus-visible:ring-[var(--accent)]/30 shadow-card',
    secondary: 'bg-white text-ink-900 border border-ink-200 hover:border-ink-400 hover:bg-ink-50 focus-visible:ring-ink-200',
    ghost: 'text-ink-700 hover:bg-ink-100 focus-visible:ring-ink-200',
    dark: 'bg-white/10 text-white border border-white/20 hover:bg-white/20 focus-visible:ring-white/30',
  }[variant];
  return (
    <button ref={ref} className={cx(base, sizes, variants, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={size === 'lg' ? 20 : 18} />}
    </button>
  );
});

/** English technical term shown inline inside Arabic text (isolated for correct bidi). */
export function En({ children }: { children: ReactNode }) {
  const term = typeof children === 'string' ? findTerm(children) : null;
  if (term)
    return (
      <button
        type="button"
        onClick={() => openGlossary(term.id)}
        title="اضغط لشرح المصطلح"
        className="inline font-mono text-[.86em] px-1.5 py-0.5 mx-0.5 rounded-md bg-ink-100 text-ink-700 whitespace-nowrap underline decoration-dotted decoration-ink-400 underline-offset-4 hover:bg-[var(--accent-soft,#EEF0F7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
        dir="ltr"
      >
        {children}
      </button>
    );
  return (
    <bdi dir="ltr" className="font-mono text-[.86em] px-1.5 py-0.5 mx-0.5 rounded-md bg-ink-100 text-ink-700 whitespace-nowrap">
      {children}
    </bdi>
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={cx('bg-white rounded-2xl border border-ink-200/70 shadow-card', className)} style={style}>
      {children}
    </div>
  );
}

export type FeedbackKind = 'success' | 'hint' | 'info' | 'warn';
export function Feedback({ kind, title, children }: { kind: FeedbackKind; title?: string; children: ReactNode }) {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    hint: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-ink-50 border-ink-200 text-ink-800',
    warn: 'bg-rose-50 border-rose-200 text-rose-900',
  }[kind];
  const icon: IconName = kind === 'success' ? 'check' : kind === 'info' ? 'bulb' : 'bulb';
  return (
    <div role="status" aria-live="polite" className={cx('flex gap-3 rounded-xl border px-4 py-3 text-[15px] leading-relaxed animate-rise', styles)}>
      <span className={cx('mt-0.5 shrink-0 grid place-items-center w-6 h-6 rounded-full', kind === 'success' ? 'bg-emerald-500 text-white' : 'bg-white/70')}>
        <Icon name={icon} size={14} stroke={2.5} />
      </span>
      <div>
        {title && <div className="font-bold mb-0.5">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function GovTip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 items-start rounded-xl border border-dashed border-green-300 bg-green-50/60 px-4 py-3 text-sm text-green-900">
      <span className="shrink-0 text-green-600 mt-0.5">
        <Icon name="shield" size={18} />
      </span>
      <div>
        <span className="font-bold">لمسة حوكمة: </span>
        {children}
      </div>
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className,
  disabled,
  ariaLabel,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/25 disabled:opacity-40',
        active ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm' : 'bg-white border-ink-200 text-ink-700 hover:border-[var(--accent)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A big selectable option card (used for choices — never a "test"). */
export function OptionCard({
  selected,
  state,
  onClick,
  children,
  disabled,
}: {
  selected?: boolean;
  state?: 'right' | 'wrong' | null;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        'w-full text-right rounded-xl border-2 px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/25',
        state === 'right' && 'border-emerald-500 bg-emerald-50',
        state === 'wrong' && 'border-amber-400 bg-amber-50 animate-shake',
        !state && selected && 'border-[var(--accent)] bg-[var(--accent-soft)]',
        !state && !selected && 'border-ink-200 bg-white hover:border-ink-400',
        disabled && 'cursor-default',
      )}
    >
      {children}
    </button>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-2xl shadow-lift max-w-md w-full p-6 animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-3">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white px-4 py-3">
      <div className="text-xs text-ink-500 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function SimLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-600">
      <Icon name="eye" size={12} />
      {children}
    </span>
  );
}
