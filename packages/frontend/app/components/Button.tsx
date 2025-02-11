import { memo, useCallback } from 'react';
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
  disabled?: boolean;
};

function Button({
  text,
  textSize = 'text-base',
  size,
  icon,
  type = 'primary',
  action,
  callback,
  classNames,
  disabled,
}: Button) {
  const buttonStyle = buttonTypes[type];
  const buttonPadding = size ? sizes.buttonPadding[size] : buttonStyle.size;

  const handleCallback = useCallback(() => {
    if (callback) {
      callback();
    }
  }, [callback]);

  const getButtonClasses = () => {
    const baseClasses = `${buttonStyle.base} ${buttonPadding} ${textSize} ${
      classNames || ''
    }`;

    if (disabled) {
      return `${baseClasses} opacity-50 bg-gray-300 hover:bg-gray-300`;
    }

    return `${baseClasses} ${buttonStyle.hover}`;
  };

  return (
    <button
      type={action}
      onClick={handleCallback}
      className={getButtonClasses()}
      disabled={disabled}
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

export default memo(Button);
