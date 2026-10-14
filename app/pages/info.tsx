import type { Handle } from 'remix/component';
import { usStates } from '../../shared/usStates.ts';
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
  ['zipCode', 'Zip Code'],
  ['phone', 'Phone', 'tel'],
  ['email', 'Email', 'email'],
] as const;
export function InfoPage(handle: Handle<BuilderPageProps>) {
  return () => (
    <BuilderLayout
      {...handle.props}
      step="info"
      title="Tell us a bit about yourself"
      subtitle="Let's start with your basic information."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {fields.map(([name, label, type]) => (
          <BuilderField
            name={name}
            label={label}
            type={type}
            options={name === 'state' ? usStates : undefined}
            placeholder={name === 'state' ? 'Select a state' : undefined}
            values={handle.props.values}
            errors={handle.props.errors}
          />
        ))}
      </div>
    </BuilderLayout>
  );
}
