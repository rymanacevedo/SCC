import type { Handle, Props } from 'remix/component';
import { classes } from './classes.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'dark';
/** `lg` is the old home page's call to action. */
export type ButtonSize = 'md' | 'lg';

const shared =
  'inline-flex cursor-pointer items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:opacity-50 disabled:hover:bg-gray-300',
  secondary:
    'bg-white text-gray-700 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-300 disabled:opacity-50 disabled:hover:bg-gray-300',
  outline:
    'border border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-950 disabled:opacity-60 disabled:hover:border-slate-300',
  dark: 'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60 disabled:hover:bg-slate-900',
};

const mediumSizes: Record<ButtonVariant, string> = {
  primary: 'rounded-md px-4 py-2 text-base font-medium shadow-md',
  secondary: 'rounded-md px-4 py-2 text-base font-medium shadow-md',
  outline: 'rounded-md px-4 py-2 text-sm font-medium',
  dark: 'rounded-md px-4 py-2 text-sm font-medium',
};
const large =
  'rounded-lg px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl';

export function buttonClass(
  variant: ButtonVariant = 'primary',
  className?: string,
  size: ButtonSize = 'md',
): string {
  return classes(
    shared,
    variants[variant],
    size === 'lg' ? large : mediumSizes[variant],
    className,
  );
}

interface ButtonProps extends Props<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button(handle: Handle<ButtonProps>) {
  return () => {
    const { variant, size, className, type = 'button', ...rest } = handle.props;
    return (
      <button
        {...rest}
        type={type}
        className={buttonClass(variant, className, size)}
      />
    );
  };
}

// Props<'a'> is a union, so it can't be extended by an interface.
type ButtonLinkProps = Props<'a'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink(handle: Handle<ButtonLinkProps>) {
  return () => {
    const { variant, size, className, ...rest } = handle.props;
    return <a {...rest} className={buttonClass(variant, className, size)} />;
  };
}
