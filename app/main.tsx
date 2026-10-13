import { run } from 'remix/spa';
import './app.css';
import { builderPageIds, router } from './router.tsx';
import { guardInitialUrl } from './steps.ts';
import { userStorage } from './user.ts';

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
app.addEventListener('error', (event) =>
  console.error('Application error', event.error),
);
