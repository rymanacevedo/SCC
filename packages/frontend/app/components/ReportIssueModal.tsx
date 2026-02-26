import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import Modal from './Modal';

type ReportIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ReportIssueModal({
  isOpen,
  onClose,
}: ReportIssueModalProps) {
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      setShowSuccess(true);
      formRef.current?.reset();
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.state, fetcher.data, onClose]);

  const isSubmitting = fetcher.state !== 'idle';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report an issue">
      {showSuccess ? (
        <p className="text-green-600 font-medium">
          Thank you! Your report has been submitted.
        </p>
      ) : (
        <fetcher.Form ref={formRef} method="post" action="/api/bugs">
          <input
            type="hidden"
            name="url"
            value={typeof window !== 'undefined' ? window.location.href : ''}
          />
          <div className="mb-4">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Describe the issue
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              className="mt-1 block w-full border shadow-sm py-3 px-3 text-lg rounded-md"
              placeholder="What went wrong?"
            />
          </div>
          {fetcher.data?.error && (
            <p className="text-red-600 text-sm mb-4">{fetcher.data.error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </fetcher.Form>
      )}
    </Modal>
  );
}
