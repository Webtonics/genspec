import { CircleAlert, KeyRound, RotateCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { AiRequestError } from '@/ai/client';
import { useAiStore } from '@/ai/aiStore';
import { cx } from '@/lib/cx';
import { Button } from '../ui/Button';

/** Marks anything the AI produced or does. */
export function AiBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-600/20',
        'scada:bg-[#FFB020]/10 scada:text-[#FFB020] scada:ring-[#FFB020]/30',
        className,
      )}
    >
      <Sparkles size={11} />
      AI
    </span>
  );
}

/** Shown where an AI feature would be when the server has no OpenAI key. */
export function AiOffNotice({ className }: { className?: string }) {
  return (
    <div className={cx('rounded-lg border border-dashed border-line bg-surface-2 px-4 py-3 text-sm', className)} data-testid="ai-off">
      <p className="font-medium text-ink">AI is not switched on for this deployment.</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Everything else works without it. To switch it on, an administrator adds an OpenAI API key (OPENAI_API_KEY) to the server settings.
      </p>
    </div>
  );
}

function AccessCodeForm({ onSaved }: { onSaved: () => void }) {
  const current = useAiStore((s) => s.accessCode);
  const setAccessCode = useAiStore((s) => s.setAccessCode);
  const [code, setCode] = useState(current);
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setAccessCode(code);
        onSaved();
      }}
    >
      <input
        type="password"
        value={code}
        autoComplete="off"
        aria-label="AI access code"
        placeholder="Access code"
        onChange={(e) => setCode(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <Button size="sm" variant="primary" type="submit" disabled={!code.trim()}>
        <KeyRound size={13} />
        Save and retry
      </Button>
    </form>
  );
}

/** A failed AI call: the reason, a retry, and an access code prompt when the server asks for one. */
export function AiErrorNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof AiRequestError ? error.status : -1;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm scada:border-red-500/30 scada:bg-red-500/10"
      data-testid="ai-error"
    >
      <p className="flex gap-2 font-medium text-red-800 scada:text-red-300">
        <CircleAlert size={16} className="mt-0.5 shrink-0" />
        {status === 401 ? 'Enter the access code for the AI features.' : message}
      </p>
      {status === 401 ? (
        <AccessCodeForm onSaved={onRetry} />
      ) : (
        <Button size="sm" className="mt-2" onClick={onRetry}>
          <RotateCw size={13} />
          Try again
        </Button>
      )}
    </div>
  );
}
