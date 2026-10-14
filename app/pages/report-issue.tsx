import { type Handle, on, ref } from 'remix/component';
import { userIssueReportSchema } from '../../shared/errorReporting.ts';
import { reportIssue } from '../api.ts';
import { Alert } from '../ui/alert.tsx';
import { Button } from '../ui/button.tsx';
import { controlClass } from '../ui/field.tsx';

const REPORT_FAILURE_MESSAGE =
  'Your issue could not be reported. Please try again.';

export function ReportIssue(handle: Handle) {
  let dialog: HTMLDialogElement;
  let form: HTMLFormElement;
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
      const parsed = userIssueReportSchema.safeParse({
        description: new FormData(form).get('description'),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
      if (!parsed.success) {
        message = 'Please describe what happened.';
        await handle.update();
        form.querySelector('textarea')?.focus();
        return;
      }
      pending = true;
      message = '';
      await handle.update();
      const result = await reportIssue(parsed.data, handle.signal);
      if (handle.signal.aborted) return;
      success = result.ok;
      message = result.ok
        ? 'Thank you. Your issue has been reported.'
        : REPORT_FAILURE_MESSAGE;
      if (result.ok) form.reset();
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
        variant="outline"
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
        <h2 id={`${handle.id}-title`} className="text-2xl font-semibold">
          Report an issue
        </h2>
        <p
          id={`${handle.id}-help`}
          className="text-sm leading-6 text-slate-600"
        >
          Describe what happened and we'll send the report to support.
        </p>
        <form
          novalidate
          className="space-y-4"
          mix={[
            ref((node) => {
              form = node;
            }),
            on<HTMLFormElement>('submit', submit),
          ]}
        >
          <label
            htmlFor={`${handle.id}-description`}
            className="block text-sm font-medium text-gray-700"
          >
            What happened?
          </label>
          <textarea
            id={`${handle.id}-description`}
            name="description"
            required
            rows={6}
            className={controlClass('textarea', false)}
          />
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
