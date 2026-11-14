import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { JobRoute } from './components/layout/JobRoute';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

// The job screens carry the heavy libraries (pdfjs, pdf-lib, exceljs), so they
// load on first visit instead of with the dashboard.
const JobSetupPage = lazy(() => import('./pages/JobSetupPage').then((m) => ({ default: m.JobSetupPage })));
const MarkupStudioPage = lazy(() => import('./pages/MarkupStudioPage').then((m) => ({ default: m.MarkupStudioPage })));
const ListsPage = lazy(() => import('./pages/ListsPage').then((m) => ({ default: m.ListsPage })));
const CalculationsPage = lazy(() => import('./pages/CalculationsPage').then((m) => ({ default: m.CalculationsPage })));
const SpreadDiagramPage = lazy(() => import('./pages/SpreadDiagramPage').then((m) => ({ default: m.SpreadDiagramPage })));
const TestPackPage = lazy(() => import('./pages/TestPackPage').then((m) => ({ default: m.TestPackPage })));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="jobs/:jobId" element={<JobRoute />}>
            <Route index element={<Navigate to="markup" replace />} />
            <Route path="setup" element={<JobSetupPage />} />
            <Route path="markup" element={<MarkupStudioPage />} />
            <Route path="lists" element={<ListsPage />} />
            <Route path="calculations" element={<CalculationsPage />} />
            <Route path="spread" element={<SpreadDiagramPage />} />
            <Route path="test-pack" element={<TestPackPage />} />
          </Route>
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
