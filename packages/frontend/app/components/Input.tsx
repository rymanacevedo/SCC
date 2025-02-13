import { memo } from 'react';
import { type InputTypeKeys, inputTypes } from '../utils/inputTypes';

export type FormErrors = {
  [key: string]: string[] | undefined;
};

type BaseInputProps = {
  label: string;
  hideLabel?: boolean;
  defaultValue?: string;
  id: string;
  required?: boolean;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  classNames?: string;
  error?: FormErrors;
  disabled?: boolean;
};

type NumberRequiredProps = {
  min: number | string;
  max: number | string;
  step: number | string;
};

type InputProps =
  | (BaseInputProps & { type: 'number' } & NumberRequiredProps)
  | (BaseInputProps & {
      type: Exclude<InputTypeKeys, 'number'>;
      min?: string;
      max?: string;
      placeholder?: string;
    });

function Input(props: InputProps) {
  const inputStyles = inputTypes[props.type];
  const {
    label,
    hideLabel,
    defaultValue,
    type,
    required,
    classNames,
    id,
    error,
    disabled,
  } = props;

  const isNumberInput = (
    p: unknown,
  ): p is BaseInputProps & { type: 'number' } & NumberRequiredProps => {
    return (
      typeof p === 'object' && p !== null && 'type' in p && p.type === 'number'
    );
  };

  return (
    <div>
      <label
        htmlFor={id}
        className={`block text-sm font-medium dark:text-gray-300 text-gray-700 ${
          hideLabel ? 'sr-only' : null
        }`}
      >
        {label}
      </label>
      <input
        required={required}
        type={type}
        id={id}
        min={isNumberInput(props) ? props.min : undefined}
        max={isNumberInput(props) ? props.max : undefined}
        step={isNumberInput(props) ? props.step : undefined}
        name={id}
        defaultValue={defaultValue}
        className={`${inputStyles} ${classNames} ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
            : ''
        }`}
        disabled={disabled}
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error[id]}</p> : null}
    </div>
  );
}

export default memo(Input);
