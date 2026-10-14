import type { Handle } from 'remix/component';

interface PageHeadingProps {
  title: string;
  subtitle?: string;
}

export function PageHeading(handle: Handle<PageHeadingProps>) {
  return () => (
    <div className="mb-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        {handle.props.title}
      </h1>
      {handle.props.subtitle ? (
        <p className="text-sm text-gray-600">{handle.props.subtitle}</p>
      ) : null}
    </div>
  );
}
