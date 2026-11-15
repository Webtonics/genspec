import { Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAiStatus } from '@/ai/client';
import { tourSteps, useTour } from '@/demo/tour';
import { cx } from '@/lib/cx';
import { useJobStore } from '@/store/jobStore';
import { Button, IconButton } from '../ui/Button';

type Rect = { left: number; top: number; width: number; height: number };

const same = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

/**
 * Guided demo: moves through the pages in order, dims the screen around the
 * element being talked about, and explains it. The page stays fully usable.
 */
export function DemoTour() {
  const { active, step, go, stop } = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<Rect | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Re-render when the job changes so an action's availability updates.
  useJobStore((s) => s.jobs);
  const ai = useAiStatus();
  const steps = tourSteps(Boolean(ai?.enabled));
  const def = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  useEffect(() => {
    if (!active) return;
    setMessage(null);
    if (location.pathname !== def.route) navigate(def.route);
    def.onEnter?.();
    // Navigation and onEnter belong to entering the step, not to later renders.
  }, [active, step]);

  // Follow the spotlighted element as pages load, scroll and resize.
  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    let scrolled = false;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${def.target}"]`);
      if (el && !scrolled) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        scrolled = true;
      }
      const r = el?.getBoundingClientRect();
      const next = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
      setRect((prev) => (same(prev, next) ? prev : next));
    };
    update();
    const timer = window.setInterval(update, 120);
    return () => window.clearInterval(timer);
  }, [active, step, def.target]);

  if (!active) return null;

  const pad = 6;
  return (
    <>
      {rect && (
        <div
          aria-hidden
          data-testid="tour-spotlight"
          className="pointer-events-none fixed z-40 rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + 2 * pad,
            height: rect.height + 2 * pad,
            boxShadow: '0 0 0 9999px rgb(11 18 32 / 0.42)',
          }}
        />
      )}
      <div
        role="dialog"
        aria-label="Guided demo"
        data-testid="tour-card"
        className="fixed right-6 bottom-6 z-50 w-[390px] rounded-xl bg-surface p-5 shadow-2xl ring-1 ring-line"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-primary uppercase">
            <Sparkles size={13} />
            Guided demo · Step {step + 1} of {steps.length}
          </span>
          <IconButton aria-label="End the demo" onClick={stop}>
            <X size={16} />
          </IconButton>
        </div>
        <h2 className="mt-1 text-base font-semibold text-ink">{def.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{def.body}</p>

        {def.action?.available() && !message && (
          <Button size="sm" className="mt-3" onClick={() => setMessage(def.action?.run() ?? null)}>
            <Sparkles size={14} />
            {def.action.label}
          </Button>
        )}
        {message && <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink ring-1 ring-line">{message}</p>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-primary' : 'w-1.5 bg-line-strong')} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
              Back
            </Button>
            <Button size="sm" variant="primary" onClick={() => (last ? stop() : go(step + 1))}>
              {last ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
