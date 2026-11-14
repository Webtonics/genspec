import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** Standard padded, width-limited page body. Full-bleed screens (Markup studio) skip this. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-7xl px-6 py-7 lg:px-8', className)}>{children}</div>;
}

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Small line above the title, e.g. the job number. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="mb-1 font-mono text-xs text-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, ...rest }: HTMLAttributes<HTMLElement> & { 'data-tour'?: string }) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface shadow-sm', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
