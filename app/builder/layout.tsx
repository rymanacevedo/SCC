import { type Handle, on, ref } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import type { FieldErrors } from '../../shared/fieldErrors.ts';
import { builderNav, type StepId } from '../steps.ts';
import { Alert } from '../ui/alert.tsx';
import { Button, ButtonLink } from '../ui/button.tsx';
import { Field, type FieldProps as UiFieldProps } from '../ui/field.tsx';
import { PageHeading } from '../ui/heading.tsx';
import { type FormValues, formPending } from './form.ts';
export interface BuilderPageProps {
  url: URL;
  values: FormValues;
  errors?: FieldErrors;
  prompt?: string;
  saveDraft?: (values: FormValues) => string | undefined;
}
interface LayoutProps extends BuilderPageProps {
  step: StepId;
  title: string;
  subtitle?: string;
  children: RemixNode;
  suggestions?: RemixNode;
  /** From md up, show Suggestions in the left column; the form stays first in DOM order. */
  suggestionsFirst?: boolean;
  beforeForm?: RemixNode;
  /** Pages whose own buttons submit the form (education level) drop the nav submit. */
  hideSubmit?: boolean;
}
export function BuilderLayout(handle: Handle<LayoutProps>) {
  const pending = formPending(handle);
  let form: HTMLFormElement | undefined;
  let focusedErrors: FieldErrors | undefined;
  return () => {
    const { step, title, subtitle, url, errors, children, suggestions } =
      handle.props;
    if (errors && errors !== focusedErrors) {
      focusedErrors = errors;
      handle.queueTask(() => {
        // Reused SPA frames receive new errors; wait until the frame is attached.
        requestAnimationFrame(() => {
          if (!handle.signal.aborted)
            form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        });
      });
    }
    const nav = builderNav(step, url);
    let submitLabel = 'Next Step';
    if (step === 'finish-up') submitLabel = 'Preview Resume';
    else if (step.endsWith('-summary')) submitLabel = 'Continue';
    if (pending.pending) {
      submitLabel = 'Saving…';
    } else if (nav.returnUrl) {
      submitLabel = 'Resubmit';
    }
    return (
      <section className="mx-auto max-w-4xl">
        <PageHeading title={title} subtitle={subtitle} />
        {handle.props.beforeForm}
        <div
          className={
            suggestions ? 'grid grid-cols-1 gap-8 md:grid-cols-2' : undefined
          }
        >
          <form
            method="post"
            action={`${url.pathname}${url.search}`}
            data-rmx-history="push"
            data-rmx-reset-scroll="false"
            noValidate
            // Push intentionally permits a duplicate history entry after a 400.
            className="space-y-6"
            aria-busy={pending.pending}
            mix={[
              ref((node) => {
                form = node;
              }),
              on('submit', (event) => pending.submit(event)),
            ]}
          >
            {children}
            {errors?._form?.map((message) => (
              <Alert tone="error">{message}</Alert>
            ))}
            <nav className="flex items-center justify-between gap-4 pt-4">
              {!nav.returnUrl ? (
                <ButtonLink href={nav.previous} variant="secondary">
                  Previous
                </ButtonLink>
              ) : null}
              {handle.props.hideSubmit ? null : (
                <Button
                  type="submit"
                  disabled={pending.pending}
                  className="ml-auto"
                >
                  {submitLabel}
                </Button>
              )}
            </nav>
          </form>
          {suggestions ? (
            <aside
              aria-label="Suggestions"
              className={
                handle.props.suggestionsFirst ? 'md:order-first' : undefined
              }
              style={{ minHeight: '24rem' }}
            >
              {suggestions}
            </aside>
          ) : null}
        </div>
      </section>
    );
  };
}
interface FieldProps extends Omit<UiFieldProps, 'value' | 'errors'> {
  values: FormValues;
  errors?: FieldErrors;
}
/** A Field bound to a builder page's form values and Field errors. */
export function BuilderField(handle: Handle<FieldProps>) {
  return () => {
    const { name, values, errors, ...field } = handle.props;
    const value = values[name];
    return (
      <Field
        {...field}
        name={name}
        value={typeof value === 'string' ? value : ''}
        errors={errors?.[name]}
      />
    );
  };
}
