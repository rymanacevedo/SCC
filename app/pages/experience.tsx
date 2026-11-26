import { type Handle, on } from 'remix/component';
import { usStates } from '../../shared/usStates.ts';
import {
  type FormValues,
  formValues,
  isChecked,
  monthValue,
} from '../builder/form.ts';
import {
  BuilderField,
  BuilderLayout,
  type BuilderPageProps,
} from '../builder/layout.tsx';
import { Checkbox } from '../ui/checkbox.tsx';

function toggleOverrideUntilValuesChange() {
  let override: { forValues: FormValues; checked: boolean } | undefined;
  return {
    resolve(values: FormValues, fallback: boolean): boolean {
      if (!override || override.forValues !== values) {
        override = undefined;
        return fallback;
      }
      return override.checked;
    },
    set(forValues: FormValues, checked: boolean) {
      override = { forValues, checked };
    },
  };
}

export function ExperiencePage(handle: Handle<BuilderPageProps>) {
  let saveError: string | undefined;
  const currentlyEmployedOverride = toggleOverrideUntilValuesChange();
  return () => {
    const { values, errors } = handle.props;
    const currentlyEmployed = currentlyEmployedOverride.resolve(
      values,
      isChecked(values.currentlyEmployed),
    );
    return (
      <BuilderLayout
        {...handle.props}
        errors={saveError ? { ...errors, _form: [saveError] } : errors}
        step="experience"
        title="Tell us about your most recent job"
        subtitle="We'll start there and work backwards."
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
            name="jobId"
            value={String(values.jobId ?? '')}
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <BuilderField
              name="jobTitle"
              label="Job Title"
              values={values}
              errors={errors}
            />
            <BuilderField
              name="employer"
              label="Employer"
              values={values}
              errors={errors}
            />
            <BuilderField
              name="city"
              label="City"
              placeholder="Denver"
              values={values}
              errors={errors}
            />
            <BuilderField
              name="state"
              label="State"
              options={usStates}
              placeholder="Select a state"
              values={values}
              errors={errors}
            />
            <BuilderField
              name="startDate"
              label="Start Date"
              type="month"
              values={{ startDate: monthValue(values.startDate) }}
              errors={errors}
            />
            <BuilderField
              name="endDate"
              label="End Date"
              type="month"
              disabled={currentlyEmployed}
              values={{ endDate: monthValue(values.endDate) }}
              errors={errors}
            />
          </div>
          <Checkbox
            name="currentlyEmployed"
            label="I currently work here"
            defaultChecked={isChecked(values.currentlyEmployed)}
            onToggle={(checked) => {
              currentlyEmployedOverride.set(handle.props.values, checked);
              void handle.update();
            }}
          />
        </div>
      </BuilderLayout>
    );
  };
}
