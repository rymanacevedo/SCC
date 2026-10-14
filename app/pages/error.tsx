import type { Handle } from 'remix/component';
import { ERROR_MODAL_MESSAGE } from '../error-reporting.ts';
import { ButtonLink } from '../ui/button.tsx';
import { ReportIssue } from './report-issue.tsx';

/** The error and not-found pages share the old error dialog's card. */
function ErrorCard(handle: Handle<{ title: string; message: string }>) {
  return () => (
    <section className="mx-auto w-[min(32rem,100%)] space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-600">
          Error
        </p>
        <h1 className="text-2xl font-semibold">{handle.props.title}</h1>
        <p role="alert" className="text-sm leading-6 text-slate-600">
          {handle.props.message}
        </p>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <ButtonLink href="/" variant="secondary">
          Return home
        </ButtonLink>
        <ReportIssue variant="primary" />
      </div>
    </section>
  );
}

export function ErrorPage() {
  return () => (
    <ErrorCard title="Something went wrong" message={ERROR_MODAL_MESSAGE} />
  );
}

export function NotFoundPage() {
  return () => (
    <ErrorCard
      title="Page not found"
      message="The page you are looking for could not be found."
    />
  );
}
