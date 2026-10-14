import { type Handle, on } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';

interface ChipProps {
  children?: RemixNode;
  /** Shows a × button labelled by removeLabel. */
  onRemove?: () => void;
  removeLabel?: string;
}

export function Chip(handle: Handle<ChipProps>) {
  return () => {
    const { children, onRemove, removeLabel } = handle.props;
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
        {children}
        {onRemove ? (
          <button
            type="button"
            aria-label={removeLabel}
            className="ml-2 cursor-pointer text-blue-400 hover:text-blue-600"
            mix={on('click', onRemove)}
          >
            ×
          </button>
        ) : null}
      </span>
    );
  };
}
