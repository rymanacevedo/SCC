import { memo } from 'react';
import { type InputTypes, inputTypes } from '../utils/inputTypes';

export type FormErrors = {
  [key: string]: string[] | undefined;
};

type Input = {
  label: string;
  hideLabel?: boolean;
  defaultValue?: string;
  type: keyof InputTypes;
  placeholder?: string;
  id: string;
  required?: boolean;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  classNames?: string;
  error?: FormErrors;
  disabled?: boolean;
};

function Input({
  label,
  hideLabel,
  defaultValue,
  type,
  required,
  classNames,
  id,
  error,
  disabled,
}: Input) {
  const inputStyles = inputTypes[type];
  return (
    <div>
      <label
        htmlFor={id}
        className={`block text-sm font-medium dark:text-gray-300 text-gray-700 ${hideLabel ? 'sr-only' : null}`}
      >
        {label}
      </label>
      <input
        required={required}
        type={type}
        id={id}
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
