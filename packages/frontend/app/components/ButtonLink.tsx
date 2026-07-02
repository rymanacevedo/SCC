import { memo } from 'react';
import { NavLink } from 'react-router';
import { getButtonClasses } from '../utils/buttonClasses';
import type { ButtonTypes } from '../utils/buttonTypes';
import type { Sizes } from '../utils/sizes';

type ButtonLinkProps = {
  to: string;
  text: string;
  textSize?: keyof Sizes['fontSize'];
  type?: keyof ButtonTypes;
  size?: keyof Sizes['buttonPadding'];
  classNames?: string;
};

function ButtonLink({
  to,
  text,
  textSize = 'text-base',
  type = 'primary',
  size,
  classNames,
}: ButtonLinkProps) {
  return (
    <NavLink
      to={to}
      className={getButtonClasses({
        type,
        textSize,
        size,
        classNames,
        extraClasses: 'text-center block',
      })}
    >
      {text}
    </NavLink>
  );
}

export default memo(ButtonLink);
