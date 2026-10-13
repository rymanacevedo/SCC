import { run } from 'remix/spa';
import './app.css';
import { router } from './router.tsx';

const app = run(router, { fallback: <p role="status">Loading…</p> });
app.addEventListener('error', (event) =>
  console.error('Application error', event.error),
);
