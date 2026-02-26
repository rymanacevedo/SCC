import { useEffect, useState } from 'react';
import { isRouteErrorResponse } from 'react-router';
import { reportError } from '../utils/reportError';
import Modal from './Modal';

export function RouteErrorBoundary({ error }: { error: unknown }) {
  const [isModalOpen, setIsModalOpen] = useState(true);

  useEffect(() => {
    reportError(error);
  }, [error]);

  let message = 'Oops!';
  let details = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={message}
      >
        <p className="text-gray-700 mb-4">{details}</p>
        <p className="text-sm text-gray-500 mb-4">
          This error has been automatically reported. You can also use the
          &quot;Report an issue&quot; button in the footer to provide additional
          details.
        </p>
        {import.meta.env.DEV && error instanceof Error && error.stack && (
          <pre className="w-full p-4 overflow-x-auto text-xs bg-gray-100 rounded mb-4">
            <code>{error.stack}</code>
          </pre>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Close
          </button>
        </div>
      </Modal>
    </main>
  );
}
