import { memo, useEffect, useState } from 'react';
import type { FormErrors } from './Input';

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  label: string;
  id: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  error?: FormErrors;
  disabled?: boolean;
  classNames?: string;
};

function Select({
  label,
  id,
  options,
  defaultValue,
  error,
  disabled,
  classNames,
}: SelectProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleChange = () => {
    if (!isDirty) setIsDirty(true);
    if (showError) setShowError(false);
  };

  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    if (!isDirty) setIsDirty(true);
    const isValid = e.target.value !== '';
    setShowError(!isValid);
  };

  useEffect(
    function handleFlow() {
      if (error?.[id]) {
        setIsDirty(true);
        setShowError(true);
      }
    },
    [error, id],
  );

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium dark:text-gray-300 text-gray-700"
      >
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={`mt-1 block w-full border shadow-sm ${classNames ?? ''} ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
            : ''
        } ${isDirty && showError ? 'border-red-500' : ''}`}
      >
        <option value="">Select a state</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {isDirty && showError && error?.[id] && (
        <p className="mt-1 text-sm text-red-600">{error[id]}</p>
      )}
    </div>
  );
}

export default memo(Select);
