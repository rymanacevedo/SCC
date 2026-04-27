import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <h1 id={titleId} className="text-2xl font-semibold">
            {title}
          </h1>
          {description ? (
            <p id={descriptionId} className="text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>

        {children}

        {actions ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
