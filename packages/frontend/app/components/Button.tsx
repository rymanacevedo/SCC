import { buttonTypes, type ButtonTypes } from '../utils/buttonTypes';
import { sizes, type Sizes } from '../utils/sizes';

type Button = {
  text: string;
  textSize?: keyof Sizes['fontSize'];
  type?: keyof ButtonTypes;
  size?: keyof Sizes['buttonPadding'];
  action: 'submit' | 'button';
  callback?: () => void;
  classNames?: string;
};

export default function Button({
  text,
  textSize = 'text-base',
  size,
  type = 'primary',
  action,
  callback,
  classNames,
}: Button) {
  const buttonStyle = buttonTypes[type];
  const buttonPadding = size ? sizes.buttonPadding[size] : buttonStyle.size;
  return (
    <button
      type={action}
      onClick={callback}
      className={`${buttonStyle.base} ${buttonStyle.hover} ${buttonPadding} ${textSize} ${classNames}`}
    >
      {text}
    </button>
  );
}
