import { useParams } from 'react-router-dom';
import type { Job } from '@/model/types';
import { useJob } from '@/store/jobStore';

/** The job for the current /jobs/:jobId route. Only call below <JobRoute>, which guarantees it exists. */
export function useCurrentJob(): Job {
  const { jobId } = useParams();
  const job = useJob(jobId);
  if (!job) throw new Error(`useCurrentJob: no job "${jobId}". Render this page inside <JobRoute>.`);
  return job;
}
