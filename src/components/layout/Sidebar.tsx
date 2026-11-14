import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cx } from '@/lib/cx';
import { DASHBOARD_NAV, JOB_PAGES, SETTINGS_NAV, jobPath } from '@/navigation';
import { useJobStore } from '@/store/jobStore';
import { StatusChip } from '../ui/StatusChip';
import { LogoMark } from './LogoMark';

const itemBase =
  'group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors';

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          itemBase,
          isActive ? 'bg-side-active text-white scada:text-side-accent' : 'text-side-ink/80 hover:bg-side-hover hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-side-accent" aria-hidden />}
          <Icon size={17} className={cx('shrink-0', isActive ? 'text-side-accent' : 'text-side-muted group-hover:text-side-ink')} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function DisabledNavItem({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <span className={cx(itemBase, 'cursor-not-allowed text-side-muted/50')} title="Create a job first">
      <Icon size={17} className="shrink-0" />
      {label}
    </span>
  );
}

export function Sidebar() {
  const activeJob = useJobStore((s) => s.jobs.find((j) => j.id === s.activeJobId) ?? s.jobs[0]);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-side-line bg-side text-side-ink">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-side-line px-4">
        <LogoMark />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-white">GenSpec</div>
          <div className="text-[11px] text-side-muted">by Area50</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <NavItem to={DASHBOARD_NAV.path} label={DASHBOARD_NAV.label} icon={DASHBOARD_NAV.icon} end />

        <div className="mt-6 mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-side-muted">
          Current job
        </div>
        {activeJob ? (
          <div className="mb-2 rounded-md border border-side-line bg-white/[0.03] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px] text-side-muted">{activeJob.jobNo}</span>
              <span className="font-mono text-[11px] text-side-muted">Rev {activeJob.revision}</span>
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-side-ink">{activeJob.title}</div>
            <StatusChip status={activeJob.status} className="mt-2 scale-90 origin-left" />
          </div>
        ) : (
          <p className="mb-2 px-2.5 text-xs text-side-muted">No jobs yet. Create one from the dashboard.</p>
        )}

        <div className="space-y-0.5">
          {JOB_PAGES.map((page) =>
            activeJob ? (
              <NavItem key={page.key} to={jobPath(activeJob.id, page.key)} label={page.label} icon={page.icon} />
            ) : (
              <DisabledNavItem key={page.key} label={page.label} icon={page.icon} />
            ),
          )}
        </div>
      </nav>

      <div className="shrink-0 border-t border-side-line px-3 py-3">
        <NavItem to={SETTINGS_NAV.path} label={SETTINGS_NAV.label} icon={SETTINGS_NAV.icon} />
        <div className="mt-3 px-2.5 text-[11px] leading-relaxed text-side-muted">
          Prepared for <span className="font-semibold text-side-ink">GPPSL</span>
          <br />
          Prototype v0.1
        </div>
      </div>
    </aside>
  );
}
