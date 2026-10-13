import type { Handle } from 'remix/component';
import {
  BuilderField,
  BuilderLayout,
  type BuilderPageProps,
} from '../builder/layout.tsx';

const fields = [
  ['firstName', 'First Name'],
  ['lastName', 'Last Name'],
  ['city', 'City'],
  ['state', 'State'],
  ['zipCode', 'ZIP Code'],
  ['phone', 'Phone Number', 'tel'],
  ['email', 'Email Address', 'email'],
] as const;
export function InfoPage(handle: Handle<BuilderPageProps>) {
  return () => (
    <BuilderLayout
      {...handle.props}
      step="info"
      title="Tell us a bit about yourself"
    >
      {fields.map(([name, label, type]) => (
        <BuilderField
          name={name}
          label={label}
          type={type}
          values={handle.props.values}
          errors={handle.props.errors}
        />
      ))}
    </BuilderLayout>
  );
}
