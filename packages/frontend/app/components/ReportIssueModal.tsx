import { useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { Modal } from './Modal';

type ReportIssueActionData = {
  ok?: boolean;
  error?: string;
  errors?: {
    description?: string[];
  };
};

export function ReportIssueModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fetcher = useFetcher<ReportIssueActionData>();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data?.ok) {
      return;
    }

    formRef.current?.reset();
    onClose();
  }, [fetcher.data, fetcher.state, onClose]);

  return (
    <Modal
      open={open}
      title="Report an issue"
      description="Describe what happened and we'll send the report to support."
      onClose={onClose}
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="report-issue-form"
            disabled={fetcher.state !== 'idle'}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {fetcher.state === 'idle' ? 'Submit' : 'Submitting...'}
          </button>
        </>
      }
    >
      <fetcher.Form
        id="report-issue-form"
        ref={formRef}
        method="post"
        action="/api/report-issue"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();

          const formData = new FormData(event.currentTarget);
          formData.set('url', window.location.href);
          formData.set('timestamp', new Date().toISOString());

          fetcher.submit(formData, {
            method: 'post',
            action: '/api/report-issue',
          });
        }}
      >
        <div className="space-y-2">
          <label
            htmlFor="report-description"
            className="block text-sm font-medium text-slate-700"
          >
            What happened?
          </label>
          <textarea
            id="report-description"
            name="description"
            required
            rows={6}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="Describe the issue you ran into."
          />
          {fetcher.data?.errors?.description ? (
            <p className="text-sm text-rose-600">
              {fetcher.data.errors.description.join(', ')}
            </p>
          ) : null}
        </div>

        {fetcher.data?.error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {fetcher.data.error}
          </p>
        ) : null}
      </fetcher.Form>
    </Modal>
  );
}
