import type { Runtime } from 'remix/spa';
import { isNotFoundResponse, reportErrorTelemetry } from './error-reporting.ts';
import { ErrorPage, NotFoundPage } from './pages/error.tsx';
import { Shell } from './pages/shell.tsx';

/** Component and navigation errors occur after the controller response. */
export function installErrorReporting(app: Runtime) {
  app.addEventListener('error', (event) => {
    void reportErrorTelemetry(event.error);
    const notFound = isNotFoundResponse(event.error);
    void app.frames.top
      .replace(<Shell>{notFound ? <NotFoundPage /> : <ErrorPage />}</Shell>)
      .catch(() => {});
  });
}
