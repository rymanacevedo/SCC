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
    <div className="min-h-screen font-sans text-gray-900">
      <header className="border-b px-6 py-4">
        <a href="/" className="font-bold">
          SCC
        </a>
      </header>
      {loading ? (
        <div
          role="progressbar"
          aria-label="Loading page"
          className="h-1 animate-pulse bg-blue-700"
        />
      ) : null}
      <main aria-busy={loading} className="mx-auto max-w-4xl px-6 py-12">
        {handle.props.children}
      </main>
      <footer className="border-t px-6 py-4">
        <ReportIssue />
      </footer>
    </div>
  );
}
