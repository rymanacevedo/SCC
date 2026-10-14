import { type Handle, on, ref } from 'remix/component';
import { userIssueReportSchema } from '../../shared/errorReporting.ts';
import { reportIssue } from '../api.ts';

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
      <button
        type="button"
        className="underline"
        mix={[
          ref((node) => {
            opener = node;
          }),
          on('click', open),
        ]}
      >
        Report an issue
      </button>
      <dialog
        aria-labelledby={`${handle.id}-title`}
        aria-describedby={`${handle.id}-help`}
        className="m-auto w-full max-w-lg rounded-lg p-6 shadow-xl backdrop:bg-black/40"
        mix={ref((node) => {
          dialog = node;
        })}
      >
        <h2 id={`${handle.id}-title`} className="text-2xl font-bold">
          Report an issue
        </h2>
        <p id={`${handle.id}-help`} className="my-4">
          Describe what happened and we'll send the report to support.
        </p>
        <form
          novalidate
          mix={[
            ref((node) => {
              form = node;
            }),
            on<HTMLFormElement>('submit', submit),
          ]}
        >
          <label htmlFor={`${handle.id}-description`}>What happened?</label>
          <textarea
            id={`${handle.id}-description`}
            name="description"
            required
            rows={6}
            className="my-2 block w-full rounded border p-3"
          />
          {message && <p role={success ? 'status' : 'alert'}>{message}</p>}
          <div className="mt-4 flex gap-4">
            <button type="submit" disabled={pending || success}>
              {pending ? 'Submitting…' : 'Submit'}
            </button>
            <button type="button" mix={on('click', close)}>
              {success ? 'Close' : 'Cancel'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
