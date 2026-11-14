import { LoaderCircle } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { Outlet, matchPath, useLocation } from 'react-router-dom';
import { getJobPage } from '@/navigation';
import { useJob } from '@/store/jobStore';
import { DemoTour } from '../demo/DemoTour';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/** Browser tab title for the current route, e.g. "Markup studio · GPPSL-26-0412 · GenSpec". */
function useDocumentTitle() {
  const { pathname } = useLocation();
  const match = matchPath('/jobs/:jobId/:page', pathname);
  const job = useJob(match?.params.jobId);
  const page = getJobPage(match?.params.page);
  useEffect(() => {
    const parts = page && job ? [page.label, job.jobNo] : pathname.startsWith('/settings') ? ['Settings'] : ['Jobs'];
    document.title = [...parts, 'GenSpec'].join(' · ');
  }, [page, job, pathname]);
}

function PageLoading() {
  return (
    <div className="grid h-full place-items-center">
      <span className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle size={16} className="animate-spin" />
        Loading
      </span>
    </div>
  );
}

export function AppShell() {
  useDocumentTitle();
  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-auto bg-canvas">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <DemoTour />
    </div>
  );
}
