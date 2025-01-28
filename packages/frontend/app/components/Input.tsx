import { type InputTypes, inputTypes } from '../utils/inputTypes';

type Input = {
  label: string;
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
  type,
  required,
  classNames,
  id,
}: Input) {
  const inputStyles = inputTypes[type];
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        required={required}
        type={type}
        id={id}
        name={id}
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
