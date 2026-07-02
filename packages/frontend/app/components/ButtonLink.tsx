import { memo } from 'react';
import { NavLink } from 'react-router';
import type { ButtonTypes } from '../utils/buttonTypes';
import { buttonTypes } from '../utils/buttonTypes';
import type { Sizes } from '../utils/sizes';
import { sizes } from '../utils/sizes';

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
  const buttonStyle = buttonTypes[type];
  const buttonPadding = size ? sizes.buttonPadding[size] : buttonStyle.size;
  const linkClasses = `${buttonStyle.base} ${buttonPadding} ${textSize} text-center block ${
    classNames || ''
  } ${buttonStyle.hover || ''}`;

  return (
    <NavLink to={to} className={linkClasses}>
      {text}
    </NavLink>
  );
}

export default memo(ButtonLink);
