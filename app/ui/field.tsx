import { type Handle, ref } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import { classes } from './classes.ts';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldProps {
  name: string;
  label: string;
  value?: string;
  errors?: readonly string[];
  type?: 'text' | 'tel' | 'email' | 'month';
  /** Disabled controls are greyed out and left out of the form submission. */
  disabled?: boolean;
  /** Renders a select with an empty placeholder option first. */
  options?: readonly FieldOption[];
  placeholder?: string;
  textarea?: boolean;
  capture?: (element: HTMLTextAreaElement) => void;
}

const control = 'mt-1 block w-full border px-3 py-3 text-lg shadow-sm';
const disabledControl =
  'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50';

export function controlClass(
  kind: 'input' | 'select' | 'textarea',
  invalid: boolean,
): string {
  const shape =
    kind === 'textarea'
      ? 'mt-1 block w-full rounded-md border p-3 shadow-sm'
      : control;
  return classes(
    shape,
    disabledControl,
    kind === 'select' && 'bg-white text-gray-900',
    invalid ? 'border-red-500' : kind === 'select' && 'border-gray-300',
  );
}

export function Field(handle: Handle<FieldProps>) {
  return () => {
    const {
      name,
      label,
      value = '',
      errors,
      type = 'text',
      options,
      placeholder,
      textarea,
      capture,
      disabled,
    } = handle.props;
    const invalid = Boolean(errors?.length);
    const attributes = {
      id: name,
      name,
      'aria-invalid': invalid ? ('true' as const) : undefined,
      'aria-describedby': invalid ? `${name}-error` : undefined,
      disabled,
    };
    let input: RemixNode;
    if (textarea) {
      input = (
        <textarea
          {...attributes}
          rows={8}
          defaultValue={value}
          placeholder={placeholder}
          className={controlClass('textarea', invalid)}
          mix={ref((node) => {
            capture?.(node);
          })}
        />
      );
    } else if (options) {
      input = (
        <select {...attributes} className={controlClass('select', invalid)}>
          <option value="" selected={!value}>
            {placeholder ?? 'Select an option'}
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              selected={value === option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      );
    } else if (type === 'month') {
      input = (
        <input
          {...attributes}
          type="month"
          defaultValue={value}
          className={controlClass('input', invalid)}
        />
      );
    } else {
      input = (
        <input
          {...attributes}
          type={type}
          list={undefined}
          defaultValue={value}
          placeholder={placeholder}
          className={controlClass('input', invalid)}
        />
      );
    }
    return (
      <div>
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
        {input}
        {invalid ? <FieldError id={`${name}-error`} errors={errors} /> : null}
      </div>
    );
  };
}

/** Red Field error text under an answer; the answer points at it with aria-describedby. */
export function FieldError(
  handle: Handle<{ id: string; errors?: readonly string[] }>,
) {
  return () => (
    <p id={handle.props.id} role="alert" className="mt-1 text-sm text-red-600">
      {handle.props.errors?.join(' ')}
    </p>
  );
}
