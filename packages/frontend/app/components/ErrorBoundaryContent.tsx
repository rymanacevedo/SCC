import { useEffect, useRef, useState } from 'react';
import { isRouteErrorResponse } from 'react-router';
import {
  ERROR_MODAL_MESSAGE,
  getErrorMessage,
  getErrorStackTrace,
  reportErrorTelemetry,
} from '../utils/errorTelemetry';
import { useReportIssue } from './AppShell';
import { Modal } from './Modal';

export function ErrorBoundaryContent({ error }: { error: unknown }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasReported = useRef(false);
  const { openReportIssue } = useReportIssue();

  useEffect(() => {
    if (!hasReported.current) {
      hasReported.current = true;
      void reportErrorTelemetry(error);
    }
  }, [error]);

  const stack = import.meta.env.DEV ? getErrorStackTrace(error) : undefined;
  const title =
    isRouteErrorResponse(error) && error.status === 404
      ? 'Page not found'
      : 'Something went wrong';

  return (
    <>
      <div className="min-h-[16rem]" aria-hidden={isOpen} />
      <Modal
        open={isOpen}
        title={title}
        description={ERROR_MODAL_MESSAGE}
        onClose={() => setIsOpen(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openReportIssue();
              }}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Report an issue
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Close
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-600">
            Error
          </p>
          {import.meta.env.DEV ? (
            <p className="text-sm text-slate-500">{getErrorMessage(error)}</p>
          ) : null}
        </div>
      </Modal>

      {stack ? (
        <pre className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <code>{stack}</code>
        </pre>
      ) : null}
    </>
  );
}

export { ErrorBoundaryContent as RouteErrorBoundary };
