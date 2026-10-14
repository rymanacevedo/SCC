import { type Handle, on } from 'remix/component';
import { educationLevels } from '../../shared/schemas/education.ts';
import { formValues, isChecked } from '../builder/form.ts';
import {
  BuilderField,
  BuilderLayout,
  type BuilderPageProps,
} from '../builder/layout.tsx';
import { normalizeEducationEntry } from '../education.ts';
import { Alert } from '../ui/alert.tsx';
import { Button } from '../ui/button.tsx';
import { Checkbox } from '../ui/checkbox.tsx';

export function EducationLevelPage(handle: Handle<BuilderPageProps>) {
  return () => {
    const { values, errors } = handle.props;
    return (
      <BuilderLayout
        {...handle.props}
        step="education-level"
        title="What best describes your level of education?"
        subtitle="Select the best option and we'll help you structure your education section."
        hideSubmit
      >
        {/* Each level submits the form, as in the old app; the saved one is primary. */}
        <fieldset className="mx-auto flex max-w-xs flex-col justify-center gap-4 md:max-w-4xl md:flex-row md:flex-wrap">
          <legend className="sr-only">Education level</legend>
          {educationLevels.map((value) => {
            const saved = values.educationLevel === value;
            return (
              <Button
                key={value}
                type="submit"
                name="educationLevel"
                value={value}
                variant={saved ? 'primary' : 'secondary'}
                aria-current={saved ? 'true' : undefined}
              >
                {value}
              </Button>
            );
          })}
        </fieldset>
        {errors?.educationLevel ? (
          <Alert tone="error">{errors.educationLevel.join(' ')}</Alert>
        ) : null}
      </BuilderLayout>
    );
  };
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
      title="Tell us about your education"
      subtitle="Enter your education experience so far, even if you are a current student or did not graduate."
    >
      <div
        className="space-y-6"
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
            {/* The school cap is reported against schoolName, asked on the previous Step. */}
            {handle.props.errors?.schoolName ? (
              <Alert tone="error">
                {handle.props.errors.schoolName.join(' ')}
              </Alert>
            ) : null}
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
            <Checkbox
              name="currentlyEnrolled"
              label="I am currently studying here"
              defaultChecked={isChecked(handle.props.values.currentlyEnrolled)}
            />
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
