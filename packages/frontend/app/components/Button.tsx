import { memo, useCallback } from 'react';
import { getButtonClasses } from '../utils/buttonClasses';
import type { ButtonTypes } from '../utils/buttonTypes';
import type { Sizes } from '../utils/sizes';

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
  name?: string;
  value?: string;
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
  name,
  value,
}: Button) {
  const handleCallback = useCallback(() => {
    if (callback) {
      callback();
    }
  }, [callback]);

  return (
    <button
      type={action}
      onClick={handleCallback}
      className={getButtonClasses({
        type,
        textSize,
        size,
        classNames,
        disabled,
      })}
      disabled={disabled}
      name={name}
      value={value}
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
