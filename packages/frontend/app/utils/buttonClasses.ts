import type { ButtonTypes } from './buttonTypes';
import { buttonTypes } from './buttonTypes';
import type { Sizes } from './sizes';
import { sizes } from './sizes';

type GetButtonClassesOptions = {
  type: keyof ButtonTypes;
  textSize: keyof Sizes['fontSize'];
  size?: keyof Sizes['buttonPadding'];
  classNames?: string;
  extraClasses?: string;
  disabled?: boolean;
};

const disabledButtonClasses = 'opacity-50 bg-gray-300 hover:bg-gray-300';

export function getButtonClasses({
  type,
  textSize,
  size,
  classNames,
  extraClasses,
  disabled = false,
}: GetButtonClassesOptions) {
  const buttonStyle = buttonTypes[type];
  const buttonPadding = size ? sizes.buttonPadding[size] : buttonStyle.size;
  const baseClasses = [
    buttonStyle.base,
    buttonPadding,
    textSize,
    extraClasses,
    classNames,
  ]
    .filter(Boolean)
    .join(' ');

  if (disabled) {
    return `${baseClasses} ${disabledButtonClasses}`;
  }

  return [baseClasses, buttonStyle.hover].filter(Boolean).join(' ');
}
