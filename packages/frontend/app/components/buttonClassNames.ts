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

export function getButtonClassNames({
  classNames,
  disabled,
  size,
  textSize = 'text-base',
  type = 'primary',
}: GetButtonClassNamesOptions) {
  const buttonStyle = buttonTypes[type];
  const buttonPadding = size ? sizes.buttonPadding[size] : buttonStyle.size;
  const baseClasses = `${buttonStyle.base} ${buttonPadding} ${textSize} ${
    classNames || ''
  }`;

  if (disabled) {
    return `${baseClasses} opacity-50 bg-gray-300 hover:bg-gray-300`;
  }

  return `${baseClasses} ${buttonStyle.hover || ''}`;
}
