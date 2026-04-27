import { createContext, type ReactNode, useContext, useState } from 'react';
import { ReportIssueModal } from './ReportIssueModal';

type ReportIssueControls = {
  openReportIssue: () => void;
  closeReportIssue: () => void;
};

const ReportIssueContext = createContext<ReportIssueControls | null>(null);

export function useReportIssue() {
  const value = useContext(ReportIssueContext);

  if (!value) {
    throw new Error('useReportIssue must be used within AppShell.');
  }

  return value;
}

export function AppShell({
  children,
  footerMessage,
}: {
  children: ReactNode;
  footerMessage?: string;
}) {
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
  const controls: ReportIssueControls = {
    openReportIssue: () => setIsReportIssueOpen(true),
    closeReportIssue: () => setIsReportIssueOpen(false),
  };

  return (
    <ReportIssueContext.Provider value={controls}>
      <div className="min-h-screen">
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
          {children}
        </div>

        <footer className="border-t border-slate-200">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="text-sm">
              {footerMessage ??
                'Need help? Use the footer controls to report an issue.'}
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              onClick={controls.openReportIssue}
            >
              Report an issue
            </button>
          </div>
        </footer>
      </div>

      {isReportIssueOpen ? (
        <ReportIssueModal
          open={isReportIssueOpen}
          onClose={controls.closeReportIssue}
        />
      ) : null}
    </ReportIssueContext.Provider>
  );
}
