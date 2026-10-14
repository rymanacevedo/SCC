import type { Handle } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';

interface AlertProps {
  /** error: announced Form error; tips: static writing guidance. */
  tone: 'error' | 'tips';
  title?: string;
  children?: RemixNode;
}

export function Alert(handle: Handle<AlertProps>) {
  return () => {
    const { tone, title, children } = handle.props;
    if (tone === 'error') {
      return (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {title ? <p className="font-medium">{title}</p> : null}
          {children}
        </div>
      );
    }
    return (
      <div className="rounded-md bg-blue-50 p-4">
        {title ? (
          <h2 className="mb-2 text-base font-medium text-blue-800">{title}</h2>
        ) : null}
        <div className="space-y-2 text-sm text-blue-700">{children}</div>
      </div>
    );
  };
}
