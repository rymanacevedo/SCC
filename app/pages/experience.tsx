import { type Handle, on } from 'remix/component';
import { formValues } from '../builder/form.ts';
import {
  BuilderField,
  BuilderLayout,
  type BuilderPageProps,
} from '../builder/layout.tsx';

export function ExperiencePage(handle: Handle<BuilderPageProps>) {
  let saveError: string | undefined;
  return () => (
    <BuilderLayout
      {...handle.props}
      errors={
        saveError
          ? { ...handle.props.errors, _form: [saveError] }
          : handle.props.errors
      }
      step="experience"
      title="Tell us about your job"
    >
      <div
        mix={on('input', (event) => {
          const form = (event.target as HTMLElement).closest('form');
          if (form) {
            saveError = handle.props.saveDraft?.(
              formValues(new FormData(form)),
            );
            void handle.update();
          }
        })}
      >
        <input
          type="hidden"
          name="jobId"
          value={String(handle.props.values.jobId ?? '')}
        />
        {(
          [
            'jobTitle',
            'employer',
            'city',
            'state',
            'startDate',
            'endDate',
          ] as const
        ).map((name) => (
          <BuilderField
            name={name}
            label={
              {
                jobTitle: 'Job Title',
                employer: 'Employer',
                city: 'City',
                state: 'State',
                startDate: 'Start date',
                endDate: 'End date',
              }[name]
            }
            values={handle.props.values}
            errors={handle.props.errors}
          />
        ))}
        <label>
          <input
            type="checkbox"
            name="currentlyEmployed"
            defaultChecked={handle.props.values.currentlyEmployed === 'true'}
          />{' '}
          I currently work here
        </label>
      </div>
    </BuilderLayout>
  );
}
