import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';

/** Stand-in for a screen or section that is not built yet, listing what it will do. */
export function PlaceholderPanel({
  icon: Icon,
  features,
  title = 'Screen not built yet',
  intro = 'The route, layout and job data are wired up. This screen will provide:',
}: {
  icon: LucideIcon;
  features: string[];
  title?: string;
  intro?: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-line-strong bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-muted ring-1 ring-line">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="text-sm text-muted">{intro}</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-sm leading-snug text-ink">
            <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
    </section>
  );
}
