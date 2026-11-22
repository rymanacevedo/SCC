import { run } from 'remix/spa';
import { installErrorReporting } from './error-runtime.tsx';
import './app.css';
import { builderPageIds, router } from './router.tsx';
import { guardInitialUrl } from './steps.ts';
import { userStorage } from './user.ts';

function start() {
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

void (
  globalThis.scheduler?.yield?.() ??
  new Promise((resolve) => setTimeout(resolve))
).then(start);
