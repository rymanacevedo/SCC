import { type Handle, on, ref } from 'remix/component';
import { sanitizeUserIssueReport } from '../../shared/errorReporting.ts';
import { reportIssue } from '../api.ts';
import { Alert } from '../ui/alert.tsx';
import { Button, type ButtonVariant } from '../ui/button.tsx';

const REPORT_FAILURE_MESSAGE =
  'Your issue could not be reported. Please try again.';
const REPORT_SUCCESS_MESSAGE =
  "Thank you. We've sent this page and the time to support.";

interface ReportIssueProps {
  /** The opener's style: outline in the footer, primary on the error page. */
  variant?: ButtonVariant;
}

/**
 * The Report an issue button and the dialog it opens. A User report carries
 * only the page and the time: nothing the user could type is sent.
 */
export function ReportIssue(handle: Handle<ReportIssueProps>) {
  let dialog: HTMLDialogElement;
  let pending = false;
  let message = '';
  let success = false;
  let opener: HTMLButtonElement;

  function open() {
    message = '';
    success = false;
    void handle.update();
    dialog.showModal();
  }

  function close() {
    dialog.close();
    opener.focus();
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (pending) return;
    try {
      pending = true;
      message = '';
      await handle.update();
      const result = await reportIssue(
        sanitizeUserIssueReport({
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
        handle.signal,
      );
      if (handle.signal.aborted) return;
      success = result.ok;
      message = result.ok ? REPORT_SUCCESS_MESSAGE : REPORT_FAILURE_MESSAGE;
    } catch {
      message = REPORT_FAILURE_MESSAGE;
    } finally {
      pending = false;
      if (!handle.signal.aborted) await handle.update().catch(() => {});
    }
  }

  return () => (
    <>
      <Button
        variant={handle.props.variant ?? 'outline'}
        mix={[
          ref((node) => {
            opener = node;
          }),
          on('click', open),
        ]}
      >
        Report an issue
      </Button>
      <dialog
        aria-labelledby={`${handle.id}-title`}
        aria-describedby={`${handle.id}-help`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
        mix={ref((node) => {
          dialog = node;
        })}
      >
        <div className="space-y-2">
          <h2 id={`${handle.id}-title`} className="text-2xl font-semibold">
            Report an issue
          </h2>
          <p
            id={`${handle.id}-help`}
            className="text-sm leading-6 text-slate-600"
          >
            We'll send this page and the time to support.
          </p>
        </div>
        <form
          novalidate
          className="space-y-4"
          mix={on<HTMLFormElement>('submit', submit)}
        >
          {message && success ? (
            <p role="status" className="text-sm text-slate-700">
              {message}
            </p>
          ) : null}
          {message && !success ? <Alert tone="error">{message}</Alert> : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" mix={on('click', close)}>
              {success ? 'Close' : 'Cancel'}
            </Button>
            <Button type="submit" variant="dark" disabled={pending || success}>
              {pending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
