import { FileSpreadsheet, Link2, LoaderCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { calculateJob } from '@/calc';
import { JobPageHeader } from '@/components/JobPageHeader';
import { ListTable } from '@/components/lists/ListTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Page';
import { Page } from '@/components/ui/Page';
import { useCurrentJob } from '@/hooks/useCurrentJob';
import { cx } from '@/lib/cx';
import { buildLists } from '@/lists/buildLists';
import { LIST_BY_KEY, LIST_DEFS, LIST_KEYS, type ListKey, isListKey } from '@/lists/definitions';
import { downloadLists } from '@/lists/exportXlsx';
import { useJobListFields } from '@/store/listStore';
import { useRules } from '@/store/settingsStore';

export function ListsPage() {
  const job = useCurrentJob();
  const rules = useRules();
  const fields = useJobListFields(job.id);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const active: ListKey = isListKey(tabParam) ? tabParam : 'blinds';
  const [exporting, setExporting] = useState<'tab' | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calc = useMemo(() => calculateJob(job, rules), [job, rules]);
  const lists = useMemo(() => buildLists(job, fields, calc, new Date()), [job, fields, calc]);
  const def = LIST_BY_KEY[active];

  const exportLists = async (which: 'tab' | 'all') => {
    setError(null);
    setExporting(which);
    try {
      await downloadLists(job, lists, which === 'all' ? LIST_KEYS : [active]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The export failed.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <Page className="max-w-[1600px]">
      <JobPageHeader
        job={job}
        pageKey="lists"
        actions={
          <>
            <Button onClick={() => exportLists('tab')} disabled={exporting !== null}>
              {exporting === 'tab' ? <LoaderCircle size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              Export {def.title.toLowerCase()}
            </Button>
            <Button variant="primary" onClick={() => exportLists('all')} disabled={exporting !== null}>
              {exporting === 'all' ? <LoaderCircle size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              Export all (.xlsx)
            </Button>
          </>
        }
      />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div role="tablist" aria-label="Lists" data-tour="list-tabs" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {LIST_DEFS.map((d) => {
          const selected = d.key === active;
          const count = lists[d.key].length;
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setParams({ tab: d.key }, { replace: true })}
              className={cx(
                '-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
                selected ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {d.title}
              <span
                className={cx(
                  'min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums',
                  selected ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted ring-1 ring-line',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-3 text-sm text-muted">{def.description}</p>

      <Card className="overflow-hidden">
        <ListTable job={job} def={def} rows={lists[active]} />
      </Card>

      <p className="mt-3 flex flex-wrap items-center gap-x-1 text-xs leading-relaxed text-muted">
        Rows come straight from the markups, so they follow the drawing. Columns marked
        <Link2 size={12} className="text-primary" aria-hidden />
        edit the markup itself. Grey values are defaults that follow the job until changed.
      </p>
    </Page>
  );
}
