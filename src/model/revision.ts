import type { Job, RevisionEvent } from './types';

/** Next revision letter: A to B, Z to AA, AZ to BA. Numeric revisions count up: 0 to 1. */
export function nextRevision(rev: string): string {
  const r = rev.trim().toUpperCase();
  if (/^\d+$/.test(r)) return String(Number(r) + 1);
  if (!/^[A-Z]+$/.test(r)) return 'A';
  const chars = r.split('');
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A';
      i -= 1;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join('');
    }
  }
  return `A${chars.join('')}`;
}

export type RevisionRow = { rev: string; at?: string; description: string; by: string };

/** Revision table rows, oldest first: first issue, then each client comment and approval. */
export function revisionRows(job: Job, company: string): RevisionRow[] {
  const firstRev = /^\d+$/.test(job.revision.trim()) ? '0' : 'A';
  const rows: RevisionRow[] = [{ rev: firstRev, at: job.createdAt, description: 'First issue for review', by: company }];
  for (const e of job.history ?? []) {
    rows.push(
      e.kind === 'comment'
        ? { rev: e.rev, at: e.at, description: `Client comment: ${e.text}`, by: 'Client' }
        : { rev: e.rev, at: e.at, description: 'Approved', by: e.by },
    );
  }
  return rows;
}

/** Client comments raised at the job's current revision: these get revision clouds. */
export function currentRevisionComments(job: Job): Extract<RevisionEvent, { kind: 'comment' }>[] {
  return (job.history ?? []).filter((e): e is Extract<RevisionEvent, { kind: 'comment' }> => e.kind === 'comment' && e.rev === job.revision);
}
