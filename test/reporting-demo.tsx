// Browser-only fixture; never included in the production entry.
import { run } from 'remix/spa';
import { installErrorReporting } from '../app/error-runtime.tsx';
import { createAppRouter } from '../app/router.tsx';

const router = createAppRouter();
router.get('/throw', () => {
  throw new Error('Stub page failure');
});
function ThrowingPage() {
  return () => {
    throw new Error('Stub component failure');
  };
}
router.get('/throw-component', ({ render }) => render(<ThrowingPage />));
const app = run(router);
installErrorReporting(app);
