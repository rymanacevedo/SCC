import { memo, useEffect, useState } from 'react';
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
  placeholder?: string;
  disabled?: boolean;
  pattern?: string;
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
    });

function Input(props: InputProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [wasInvalid, setWasInvalid] = useState(false);
  const [showError, setShowError] = useState(false);
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
    placeholder,
    pattern,
  } = props;

  const isNumberInput = (
    p: unknown,
  ): p is BaseInputProps & { type: 'number' } & NumberRequiredProps => {
    return (
      typeof p === 'object' && p !== null && 'type' in p && p.type === 'number'
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDirty) setIsDirty(true);
    if (wasInvalid) {
      setShowError(!e.target.validity.valid);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isDirty) setIsDirty(true);

    const isValid = e.target.validity.valid;
    setShowError(!isValid);
    setWasInvalid(!isValid);
  };

  useEffect(
    function handleFlow() {
      if (error?.[id]) {
        setIsDirty(true);
        setShowError(true);
        setWasInvalid(true);
      }
    },
    [error, id],
  );

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
        autoComplete="off"
        min={isNumberInput(props) ? props.min : undefined}
        max={isNumberInput(props) ? props.max : undefined}
        step={isNumberInput(props) ? props.step : undefined}
        name={id}
        pattern={pattern}
        placeholder={placeholder}
        defaultValue={defaultValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={`${inputStyles} ${classNames} ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
            : ''
        }
        ${isDirty && showError ? 'border-red-500' : ''}
        `}
      />
      {isDirty && showError && error?.[id] && (
        <p className="mt-1 text-sm text-red-600">{error[id]}</p>
      )}
    </div>
  );
}

export default memo(Input);
