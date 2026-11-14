import { Download, ExternalLink, FileStack, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateJob } from '@/calc';
import { JobPageHeader } from '@/components/JobPageHeader';
import { ApprovalCard } from '@/components/testpack/ApprovalCard';
import { ClientCommentCard } from '@/components/testpack/ClientCommentCard';
import { RevisionHistory } from '@/components/testpack/RevisionHistory';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Page';
import { Page } from '@/components/ui/Page';
import { StatusChip } from '@/components/ui/StatusChip';
import { useCurrentJob } from '@/hooks/useCurrentJob';
import { renderThumbnails } from '@/pdf/pdf';
import type { TestPack } from '@/testpack/buildTestPack';
import { useJobListFields } from '@/store/listStore';
import { useRules, useTitleBlock } from '@/store/settingsStore';

type Generated = { pack: TestPack; url: string; thumbs: string[]; inputs: unknown[] };

function save(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const CONTENTS = [
  'Cover sheet with test sections, contents and revisions',
  'Marked-up test limit diagram: the client drawing unaltered, markups on top',
  'Calculations for every test section, with the working shown',
  'Blind, vent and drain, valve line-up, joint and gauge lists',
  'Sign-off sheet',
];

export function TestPackPage() {
  const job = useCurrentJob();
  const rules = useRules();
  const titleBlock = useTitleBlock();
  const listFields = useJobListFields(job.id);
  const calc = useMemo(() => calculateJob(job, rules), [job, rules]);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const inputs = [job, rules, titleBlock, listFields];
  const outdated = generated !== null && generated.inputs.some((v, i) => v !== inputs[i]);

  const generate = async (download: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { buildTestPack } = await import('@/testpack/buildTestPack');
      const pack = await buildTestPack({ job, rules, listFields, titleBlock, generatedAt: new Date() });
      const blob = new Blob([new Uint8Array(pack.bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      if (download) save(url, pack.fileName);
      const thumbs = await renderThumbnails(pack.bytes, 260);
      setGenerated({ pack, url, thumbs, inputs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The test pack could not be generated.');
    } finally {
      setBusy(false);
    }
  };

  // Approving, withdrawing or a client comment changes every title block: refresh an open preview.
  useEffect(() => {
    if (generated) void generate(false);
  }, [job.status, job.revision]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return (
    <Page className="max-w-[1600px]">
      <JobPageHeader
        job={job}
        pageKey="test-pack"
        actions={
          <Button variant="primary" onClick={() => generate(true)} disabled={busy} data-tour="testpack-generate">
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <FileStack size={15} />}
            Generate test pack
          </Button>
        }
      />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0 overflow-hidden">
          {!generated ? (
            <div className="px-8 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-muted ring-1 ring-line">
                <FileStack size={22} />
              </span>
              <h2 className="mt-4 text-base font-semibold text-ink">One click, one PDF</h2>
              <ul className="mx-auto mt-3 max-w-md space-y-1 text-left text-sm text-muted">
                {CONTENTS.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted">
                Every page carries a title block and the status. Until an engineer approves, pages are watermarked FOR REVIEW.
              </p>
              <Button variant="primary" className="mt-6" onClick={() => generate(true)} disabled={busy}>
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : <FileStack size={15} />}
                Generate test pack
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="truncate font-mono text-sm font-semibold text-ink" data-testid="pack-docno">
                      {generated.pack.docNo}
                    </span>
                    <StatusChip status={job.status} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted" data-testid="pack-filename">
                    {generated.pack.fileName} · {generated.pack.pageCount} pages
                  </div>
                </div>
                <div className="flex gap-2">
                  {outdated && (
                    <Button size="sm" onClick={() => generate(false)} disabled={busy}>
                      <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />
                      Job changed, refresh
                    </Button>
                  )}
                  <a href={generated.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-2">
                    <ExternalLink size={14} />
                    Open
                  </a>
                  <Button size="sm" variant="primary" onClick={() => save(generated.url, generated.pack.fileName)}>
                    <Download size={14} />
                    Download
                  </Button>
                </div>
              </div>
              <div className="grid gap-x-6 gap-y-1 border-b border-line px-5 py-3 text-xs sm:grid-cols-2 xl:grid-cols-3">
                {generated.pack.parts.map((p, i) => (
                  <div key={p.title} className="flex justify-between gap-3 py-0.5">
                    <span className="truncate text-ink">
                      {i + 1}. {p.title}
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">
                      {p.pageCount > 1 ? `pp. ${p.firstPage} to ${p.firstPage + p.pageCount - 1}` : `p. ${p.firstPage}`}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 bg-surface-2 p-5 md:grid-cols-3 2xl:grid-cols-4" data-testid="pack-pages">
                {generated.thumbs.map((src, i) => (
                  <figure key={i} className="min-w-0">
                    <img src={src} alt={`Page ${i + 1}`} className="w-full rounded-sm bg-white shadow-md ring-1 ring-black/10" />
                    <figcaption className="mt-1.5 text-center text-[11px] text-muted">Page {i + 1}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <div data-tour="approval">
            <ApprovalCard job={job} calc={calc} />
          </div>
          <ClientCommentCard job={job} />
          <RevisionHistory job={job} />
        </div>
      </div>
    </Page>
  );
}
