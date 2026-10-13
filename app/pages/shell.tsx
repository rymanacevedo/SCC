import type { Handle } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';

export function Shell(handle: Handle<{ children?: RemixNode }>) {
  let loading = false;
  handle.queueTask(() => {
    for (const [event, pending] of [
      ['reloadStart', true],
      ['reloadComplete', false],
    ] as const) {
      handle.frame.addEventListener(
        event,
        () => {
          loading = pending;
          void handle.update();
        },
        { signal: handle.signal },
      );
    }
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
    </div>
  );
}

export function ComingSoon() {
  return () => (
    <p>
      The resume builder is being prepared. <a href="/">Return home</a>
    </p>
  );
}
