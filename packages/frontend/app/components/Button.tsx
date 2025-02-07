import { buttonTypes } from '../utils/buttonTypes';
import type { ButtonTypes } from '../utils/buttonTypes';
import type { Sizes } from '../utils/sizes';
import { sizes } from '../utils/sizes';

const visuallyHidden =
  'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0';

type Button = {
  text: string;
  textSize?: keyof Sizes['fontSize'];
  type?: keyof ButtonTypes;
  size?: keyof Sizes['buttonPadding'];
  icon?: React.ReactNode;
  action: 'submit' | 'button';
  callback?: () => void;
  classNames?: string;
};

export default function Button({
  text,
  textSize = 'text-base',
  size,
  icon,
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
      {icon ? icon : null}
      <span
        className={
          type === 'icon' || type === 'iconCustom' ? visuallyHidden : undefined
        }
      >
        {text}
      </span>
    </button>
  );
}
