import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { MARKUP_TYPE_LABELS } from '@/model/options';
import { nextRevision } from '@/model/revision';
import type { Job } from '@/model/types';
import { useJobStore } from '@/store/jobStore';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Page';

const control =
  'w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20';

/** A client comment raises the revision letter, sends the pack back for review and clouds what it refers to. */
export function ClientCommentCard({ job }: { job: Job }) {
  const addClientComment = useJobStore((s) => s.addClientComment);
  const [text, setText] = useState('');
  const [markupId, setMarkupId] = useState('');
  const next = nextRevision(job.revision);

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Client comment" description={`Records the comment and issues revision ${next}.`} />
      <form
        className="space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          addClientComment(job.id, text, markupId || undefined);
          setText('');
          setMarkupId('');
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="e.g. Move B1 to the upstream flange of MV-101."
          aria-label="Client comment"
          className={`${control} resize-y py-2 leading-snug`}
        />
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-muted uppercase">Relates to (optional)</span>
          <select value={markupId} onChange={(e) => setMarkupId(e.target.value)} aria-label="Relates to markup" className={`${control} h-9 cursor-pointer`}>
            <option value="">The whole drawing</option>
            {job.markups.map((m) => (
              <option key={m.id} value={m.id}>
                {m.tag} ({MARKUP_TYPE_LABELS[m.type]})
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">
          The pack goes back to FOR REVIEW at revision {next}. The comment is clouded on the drawing with a {next} revision
          triangle and added to the revision table.
        </p>
        <Button type="submit" className="w-full" disabled={!text.trim()}>
          <MessageSquarePlus size={15} />
          Record comment, issue Rev {next}
        </Button>
      </form>
    </Card>
  );
}
