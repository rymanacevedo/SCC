import { buttonTypes, type ButtonTypes } from '../utils/buttonTypes';
import type { Sizes } from '../utils/sizes';

type Button = {
  text: string;
  size?: keyof Sizes['fontSize'];
  type?: keyof ButtonTypes;
  action: 'submit' | 'button';
  callback?: () => void;
  classNames?: string;
};

export default function Button({
  text,
  size = 'text-base',
  type = 'primary',
  action,
  callback,
  classNames,
}: Button) {
  const buttonStyle = buttonTypes[type];
  return (
    <button
      type={action}
      onClick={callback}
      className={`${buttonStyle.base} ${buttonStyle.hover} py-2 px-4 font-medium ${size} ${classNames}`}
    >
      {text}
    </button>
  );
}
