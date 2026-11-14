import { describe, expect, it } from 'vitest';
import { currentRevisionComments, nextRevision, revisionRows } from './revision';
import { makeDemoJobs } from './seed';

describe('nextRevision', () => {
  it.each([
    ['A', 'B'],
    ['B', 'C'],
    ['Z', 'AA'],
    ['AZ', 'BA'],
    ['ZZ', 'AAA'],
    ['b', 'C'],
    ['0', '1'],
    ['9', '10'],
    ['', 'A'],
  ])('%s goes to %s', (from, to) => {
    expect(nextRevision(from)).toBe(to);
  });
});

describe('revision table', () => {
  const [hydro, n2] = makeDemoJobs();

  it('starts with the first issue', () => {
    expect(revisionRows(hydro, 'GPPSL')).toEqual([
      { rev: 'A', at: '2026-11-10T08:00:00.000Z', description: 'First issue for review', by: 'GPPSL' },
    ]);
  });

  it('adds client comments and approvals in order', () => {
    expect(revisionRows(n2, 'GPPSL').map((r) => [r.rev, r.description, r.by])).toEqual([
      ['A', 'First issue for review', 'GPPSL'],
      ['B', 'Client comment: Route the purge vent to the flare knock-out drum, not to atmosphere.', 'Client'],
      ['B', 'Approved', 'O. Adeyemi'],
    ]);
  });

  it('only clouds comments raised at the current revision', () => {
    expect(currentRevisionComments(n2)).toHaveLength(1);
    expect(currentRevisionComments({ ...n2, revision: 'C' })).toHaveLength(0);
  });
});
