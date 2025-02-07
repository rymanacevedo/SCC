import { type InputTypes, inputTypes } from '../utils/inputTypes';

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
};

export default function Input({
  label,
  hideLabel,
  defaultValue,
  type,
  required,
  classNames,
  id,
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
      {/* TODO: disable when user selects I currently work here */}
      <input
        required={required}
        type={type}
        id={id}
        name={id}
        defaultValue={defaultValue}
        className={`${inputStyles} ${classNames}`}
      />
      {/* {actionData?.errors?.firstName && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.firstName[0]}
              </p>
            )} */}
    </div>
  );
}
