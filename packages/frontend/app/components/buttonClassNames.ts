import type { ButtonTypes } from '../utils/buttonTypes';
import { buttonTypes } from '../utils/buttonTypes';
import type { Sizes } from '../utils/sizes';
import { sizes } from '../utils/sizes';

type GetButtonClassNamesOptions = {
  classNames?: string;
  disabled?: boolean;
  size?: keyof Sizes['buttonPadding'];
  textSize?: keyof Sizes['fontSize'];
  type?: keyof ButtonTypes;
};

const DISABLED_BUTTON_CLASSES = 'opacity-50 bg-gray-300 hover:bg-gray-300';

export function getButtonClassNames({
  classNames,
  disabled,
  size,
  textSize = 'text-base',
  type = 'primary',
}: GetButtonClassNamesOptions) {
  const buttonStyle = buttonTypes[type];
  const buttonPadding = size ? sizes.buttonPadding[size] : buttonStyle.size;
  const baseClasses = [buttonStyle.base, buttonPadding, textSize, classNames]
    .filter(Boolean)
    .join(' ');

  if (disabled) {
    return `${baseClasses} ${DISABLED_BUTTON_CLASSES}`;
  }

  return [baseClasses, buttonStyle.hover].filter(Boolean).join(' ');
}
