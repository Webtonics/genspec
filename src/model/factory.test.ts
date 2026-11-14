import { describe, expect, it } from 'vitest';
import { makeJob, makeSection, nextJobNo, nextSectionName, uid } from './factory';

describe('nextSectionName', () => {
  it('starts at TP-001', () => {
    expect(nextSectionName([])).toBe('TP-001');
  });

  it('continues from the highest existing number', () => {
    expect(nextSectionName([{ name: 'TP-013' }, { name: 'TP-012' }])).toBe('TP-014');
  });

  it('ignores names without a trailing number', () => {
    expect(nextSectionName([{ name: 'Riser' }, { name: 'TP-002' }])).toBe('TP-003');
  });
});

describe('nextJobNo', () => {
  const nov2026 = new Date('2026-11-13T09:00:00Z');

  it('formats as GPPSL-YY-NNNN', () => {
    expect(nextJobNo([], nov2026)).toBe('GPPSL-26-0001');
  });

  it('continues from the highest existing job number', () => {
    expect(nextJobNo([{ jobNo: 'GPPSL-26-0398' }, { jobNo: 'GPPSL-26-0412' }], nov2026)).toBe('GPPSL-26-0413');
  });
});

describe('makeJob', () => {
  it('creates a FOR REVIEW job at revision A with one section and no markups', () => {
    const job = makeJob([]);
    expect(job.status).toBe('FOR REVIEW');
    expect(job.revision).toBe('A');
    expect(job.approvedBy).toBeUndefined();
    expect(job.sections).toHaveLength(1);
    expect(job.sections[0].name).toBe('TP-001');
    expect(job.markups).toEqual([]);
    expect(job.drawing).toBeUndefined();
  });

  it('applies overrides', () => {
    expect(makeJob([], { medium: 'nitrogen', code: 'ASME B31.8' })).toMatchObject({
      medium: 'nitrogen',
      code: 'ASME B31.8',
    });
  });
});

describe('ids', () => {
  it('are unique and prefixed', () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid('x')));
    expect(ids.size).toBe(500);
    expect([...ids].every((id) => id.startsWith('x_'))).toBe(true);
    expect(makeSection('TP-001').id).not.toBe(makeSection('TP-001').id);
  });
});
