import type { Handle } from 'remix/component';
import { classes } from './classes.ts';

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner(handle: Handle<SpinnerProps>) {
  return () => (
    <div
      role="status"
      className={classes(
        'flex items-center justify-center gap-2 py-4 text-gray-700',
        handle.props.className,
      )}
    >
      <span>{handle.props.label ?? 'Loading…'}</span>
      <svg
        aria-hidden="true"
        className="h-5 w-5 animate-spin text-gray-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}
