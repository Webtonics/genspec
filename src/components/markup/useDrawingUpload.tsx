import { useRef, useState } from 'react';
import { readDrawingFile } from '@/pdf/upload';
import { useJobStore } from '@/store/jobStore';
import { useStudio } from './studioStore';

/** File picker and drop handling for attaching or replacing a job's client drawing. */
export function useDrawingUpload(jobId: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const drawing = await readDrawingFile(file);
      const job = useJobStore.getState().jobs.find((j) => j.id === jobId);
      if (
        job?.drawing &&
        job.markups.length > 0 &&
        !window.confirm('Replace the drawing? Existing markups keep their positions and may need moving.')
      ) {
        return;
      }
      useJobStore.getState().updateJob(jobId, { drawing });
      useStudio.getState().reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This file could not be read.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      data-testid="drawing-file-input"
      onChange={(e) => accept(e.target.files?.[0])}
    />
  );

  return { open: () => inputRef.current?.click(), accept, input, error, busy };
}
