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

function ButtonLink({
  classNames = 'block text-center',
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
