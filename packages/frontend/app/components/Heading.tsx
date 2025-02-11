import { memo } from 'react';
import type { Sizes } from '../utils/sizes';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

type Heading = {
  text: string;
  level: HeadingLevel;
  size: keyof Sizes['fontSize'];
  bold?: boolean;
  color?: string;
  classNames?: string;
};
function Heading({ text, level, size, bold, color, classNames }: Heading) {
  const Component = level;
  return (
    <Component
      className={`
    ${size} 
    ${bold ? 'font-bold' : null} 
    ${color ? color : 'dark:text-white text-gray-900'}
    ${classNames}
    `}
    >
      {text}
    </Component>
  );
}

export default memo(Heading);
