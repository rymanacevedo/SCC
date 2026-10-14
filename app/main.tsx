import { run } from 'remix/spa';
import { installErrorReporting } from './error-runtime.tsx';
import './app.css';
import { builderPageIds, router } from './router.tsx';
import { guardInitialUrl } from './steps.ts';
import { userStorage } from './user.ts';

function start() {
  // remix/spa's initial reload follows a 303 but leaves the document URL unchanged.
  // Apply the same prerequisite guard before capturing the initial frame URL.
  const stored = userStorage.read();
  if (stored.ok) {
    const target = guardInitialUrl(
      new URL(window.location.href),
      stored.value.user,
      stored.value.drafts,
      Object.values(builderPageIds),
    );
    if (target) window.history.replaceState(window.history.state, '', target);
  }

  const app = run(router, { fallback: <p role="status">Loading…</p> });
  installErrorReporting(app);
}

// Evaluating the bundle and the first render are each a long task on slow phones; yield between
// them so they don't block input as one. scheduler.yield resumes ahead of other queued tasks.
// Not a top-level await: that splits the entry chunk and costs first paint a request.
void (
  globalThis.scheduler?.yield?.() ??
  new Promise((resolve) => setTimeout(resolve))
).then(start);
