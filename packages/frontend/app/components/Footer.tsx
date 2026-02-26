import { useCallback, useState } from 'react';
import ReportIssueModal from './ReportIssueModal';

export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <>
      <footer className="mt-auto border-t border-gray-200 py-4 px-4">
        <div className="max-w-4xl mx-auto flex justify-center">
          <button
            type="button"
            onClick={openModal}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Report an issue
          </button>
        </div>
      </footer>
      <ReportIssueModal isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
}
