import { type Handle, on } from 'remix/component';
import { EducationLevelSchema } from '../../shared/schemas/education.ts';
import { formValues } from '../builder/form.ts';
import {
  BuilderField,
  BuilderLayout,
  type BuilderPageProps,
} from '../builder/layout.tsx';
import { normalizeEducationEntry } from '../education.ts';

export function EducationLevelPage(handle: Handle<BuilderPageProps>) {
  return () => (
    <BuilderLayout
      {...handle.props}
      step="education-level"
      title="What best describes your level of education?"
    >
      <label htmlFor="educationLevel">Education level</label>
      <select
        id="educationLevel"
        name="educationLevel"
        aria-invalid={handle.props.errors?.educationLevel ? 'true' : undefined}
        aria-describedby="educationLevel-error"
      >
        <option value="" selected={!handle.props.values.educationLevel}>
          Select a level
        </option>
        {EducationLevelSchema.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            selected={handle.props.values.educationLevel === option.value}
          >
            {option.value}
          </option>
        ))}
      </select>
      {handle.props.errors?.educationLevel?.map((message) => (
        <p id="educationLevel-error" role="alert">
          {message}
        </p>
      ))}
    </BuilderLayout>
  );
}
export function EducationPage(handle: Handle<BuilderPageProps>) {
  return educationFields(handle, false);
}
export function EducationEntryPage(handle: Handle<BuilderPageProps>) {
  return educationFields(handle, true);
}
function educationFields(handle: Handle<BuilderPageProps>, details: boolean) {
  let saveError: string | undefined;
  const normalized = normalizeEducationEntry(
    handle.props.values as Parameters<typeof normalizeEducationEntry>[0],
  );
  const fixedDegree =
    normalized.degree === 'Diploma' || normalized.degree === 'Certificate'
      ? normalized.degree
      : undefined;
  return () => (
    <BuilderLayout
      {...handle.props}
      errors={
        saveError
          ? { ...handle.props.errors, _form: [saveError] }
          : handle.props.errors
      }
      step={details ? 'education-entry' : 'education'}
      title={details ? 'Tell us about your education' : 'Where did you study?'}
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
          name="educationId"
          value={String(handle.props.values.educationId ?? '')}
        />
        {details ? (
          <>
            {handle.props.errors?.schoolName?.map((message) => (
              <p role="alert">{message}</p>
            ))}
            {fixedDegree ? (
              <input type="hidden" name="degree" value={fixedDegree} />
            ) : (
              <BuilderField name="degree" label="Degree" {...handle.props} />
            )}
            <BuilderField
              name="location"
              label={
                normalized.educationLevel === 'Certificate'
                  ? 'Location (Optional)'
                  : 'Location'
              }
              {...handle.props}
            />
            <BuilderField
              name="graduationDate"
              label="Graduation Year"
              {...handle.props}
            />
            <label>
              <input
                type="checkbox"
                name="currentlyEnrolled"
                defaultChecked={
                  handle.props.values.currentlyEnrolled === 'true'
                }
              />{' '}
              I am currently studying here
            </label>
          </>
        ) : (
          <BuilderField
            name="schoolName"
            label="School Name"
            {...handle.props}
          />
        )}
      </div>
    </BuilderLayout>
  );
}
