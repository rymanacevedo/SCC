import { memo } from 'react';
import { NavLink } from 'react-router';
import type { ButtonTypes } from '../utils/buttonTypes';
import { getButtonClassNames } from './buttonClassNames';

type ButtonLinkProps = {
  classNames?: string;
  text: string;
  to: string;
  type?: keyof ButtonTypes;
};

const DEFAULT_BUTTON_LINK_CLASS_NAMES = 'block text-center';

function ButtonLink({
  classNames = DEFAULT_BUTTON_LINK_CLASS_NAMES,
  text,
  to,
  type = 'secondary',
}: ButtonLinkProps) {
  return (
    <NavLink
      className={getButtonClassNames({
        classNames,
        type,
      })}
      to={to}
    >
      {text}
    </NavLink>
  );
}

export default memo(ButtonLink);
