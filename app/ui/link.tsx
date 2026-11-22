import type { Handle, Props } from 'remix/component';
import { classes } from './classes.ts';

export function textLinkClass(className?: string): string {
  return classes('text-sm text-blue-600 hover:text-blue-800', className);
}

export function TextLink(handle: Handle<Props<'a'>>) {
  return () => {
    const { className, ...rest } = handle.props;
    return <a {...rest} className={textLinkClass(className)} />;
  };
}
