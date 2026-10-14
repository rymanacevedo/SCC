import { type Handle, on, ref } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import type { FieldErrors } from '../../shared/fieldErrors.ts';
import { builderNav, type StepId } from '../steps.ts';
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
  children: RemixNode;
  suggestions?: RemixNode;
  beforeForm?: RemixNode;
}
export function BuilderLayout(handle: Handle<LayoutProps>) {
  const pending = formPending(handle);
  let form: HTMLFormElement | undefined;
  let focusedErrors: FieldErrors | undefined;
  return () => {
    const { step, title, url, errors, children, suggestions } = handle.props;
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
    let submitLabel =
      step.endsWith('-summary') || step === 'finish-up'
        ? 'Continue'
        : 'Next Step';
    if (pending.pending) {
      submitLabel = 'Saving…';
    } else if (nav.returnUrl) {
      submitLabel = 'Resubmit';
    }
    return (
      <section>
        <h1 className="mb-6 text-3xl font-bold">{title}</h1>
        {handle.props.beforeForm}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
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
              <p role="alert">{message}</p>
            ))}
            <nav className="flex justify-between">
              {!nav.returnUrl ? <a href={nav.previous}>Previous</a> : null}
              <button
                type="submit"
                disabled={pending.pending}
                className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
              >
                {submitLabel}
              </button>
            </nav>
          </form>
          {suggestions ? (
            <aside aria-label="Suggestions" style={{ minHeight: '24rem' }}>
              {suggestions}
            </aside>
          ) : null}
        </div>
      </section>
    );
  };
}
interface FieldProps {
  name: string;
  label: string;
  values: FormValues;
  errors?: FieldErrors;
  type?: 'text' | 'tel' | 'email';
  textarea?: boolean;
  capture?: (element: HTMLTextAreaElement) => void;
}
export function BuilderField(handle: Handle<FieldProps>) {
  return () => {
    const {
      name,
      label,
      values,
      errors,
      type = 'text',
      textarea,
      capture,
    } = handle.props;
    const value = values[name];
    const text = typeof value === 'string' ? value : '';
    const messages = errors?.[name];
    const attributes = {
      id: name,
      name,
      'aria-invalid': messages?.length ? ('true' as const) : undefined,
      'aria-describedby': messages?.length ? `${name}-error` : undefined,
      className: 'block w-full rounded border p-3',
    };
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        {textarea ? (
          <textarea
            {...attributes}
            rows={8}
            defaultValue={text}
            mix={ref((node) => {
              capture?.(node);
            })}
          />
        ) : (
          <input
            {...attributes}
            type={type}
            list={undefined}
            defaultValue={text}
          />
        )}
        {messages?.length ? (
          <p id={`${name}-error`} role="alert">
            {messages.join(' ')}
          </p>
        ) : null}
      </div>
    );
  };
}
