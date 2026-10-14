import { type Handle, on } from 'remix/component';

interface CheckboxProps {
  name: string;
  label: string;
  /** Initial state only: the box stays uncontrolled so re-renders never reset it. */
  defaultChecked: boolean;
  /** Called with the new checked state whenever the user toggles the box. */
  onToggle?: (checked: boolean) => void;
}

/** A labelled checkbox in the old app's style; it submits "on" when checked. */
export function Checkbox(handle: Handle<CheckboxProps>) {
  return () => {
    const { name, label, defaultChecked, onToggle } = handle.props;
    return (
      <div className="flex items-center">
        <input
          type="checkbox"
          id={name}
          name={name}
          defaultChecked={defaultChecked}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          mix={on('change', (event) => {
            onToggle?.((event.currentTarget as HTMLInputElement).checked);
          })}
        />
        <label htmlFor={name} className="ml-2 block text-sm text-gray-700">
          {label}
        </label>
      </div>
    );
  };
}
