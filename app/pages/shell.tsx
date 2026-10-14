import type { Handle } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import { ReportIssue } from './report-issue.tsx';

export function Shell(handle: Handle<{ children?: RemixNode }>) {
  let loading = false;

  function setLoading(pending: boolean) {
    loading = pending;
    void handle.update();
  }

  handle.queueTask(() => {
    handle.frame.addEventListener('reloadStart', () => setLoading(true), {
      signal: handle.signal,
    });
    handle.frame.addEventListener('reloadComplete', () => setLoading(false), {
      signal: handle.signal,
    });
  });

  return () => (
    <div className="flex min-h-screen flex-col font-sans text-gray-900">
      {loading ? (
        <div
          role="progressbar"
          aria-label="Loading page"
          className="h-1 animate-pulse bg-blue-600"
        />
      ) : null}
      <main
        aria-busy={loading}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8"
      >
        {handle.props.children}
      </main>
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="text-sm text-slate-700">
            Need help? Click the report issue button to submit a report.
          </p>
          <ReportIssue />
        </div>
      </footer>
    </div>
  );
}
