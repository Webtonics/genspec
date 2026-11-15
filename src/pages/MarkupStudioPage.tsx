import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DrawingViewer } from '@/components/markup/DrawingViewer';
import { NoDrawing } from '@/components/markup/NoDrawing';
import { PropertiesPanel } from '@/components/markup/PropertiesPanel';
import { RegisterPanel } from '@/components/markup/RegisterPanel';
import { StudioToolbar } from '@/components/markup/StudioToolbar';
import { useStudio } from '@/components/markup/studioStore';
import { useStudioKeyboard } from '@/components/markup/useStudioKeyboard';
import { useCurrentJob } from '@/hooks/useCurrentJob';

/** The hero screen: client PDF on the left, markup tools on top, properties on the right. */
export function MarkupStudioPage() {
  const job = useCurrentJob();
  const reset = useStudio((s) => s.reset);
  const panel = useStudio((s) => s.panel);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    reset();
  }, [job.id, reset]);

  // ?focus=<markup id> (from the Lists page) selects that markup and scrolls to it.
  const focusId = params.get('focus');
  useEffect(() => {
    if (!focusId) return;
    const markup = job.markups.find((m) => m.id === focusId);
    if (markup) useStudio.getState().focusMarkup(markup.id, markup.page);
    setParams({}, { replace: true });
    // Only react to a new focus request, not to later markup edits.
  }, [focusId]);

  useStudioKeyboard(job.id);

  if (!job.drawing) return <NoDrawing job={job} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StudioToolbar job={job} />
      <div className="flex min-h-0 flex-1">
        <DrawingViewer job={job} />
        {panel === 'register' ? <RegisterPanel job={job} /> : <PropertiesPanel job={job} />}
      </div>
    </div>
  );
}
