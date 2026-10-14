import type { Handle, Props } from 'remix/component';
import { classes } from './classes.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'dark';

const shared =
  'inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 px-4 py-2 text-base text-white shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:opacity-50 disabled:hover:bg-gray-300',
  secondary:
    'bg-white px-4 py-2 text-base text-gray-700 shadow-md hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-300 disabled:opacity-50 disabled:hover:bg-gray-300',
  outline:
    'border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400 hover:text-slate-950 disabled:opacity-60 disabled:hover:border-slate-300',
  dark: 'bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-60 disabled:hover:bg-slate-900',
};

export function buttonClass(
  variant: ButtonVariant = 'primary',
  className?: string,
): string {
  return classes(shared, variants[variant], className);
}

interface ButtonProps extends Props<'button'> {
  variant?: ButtonVariant;
}

export function Button(handle: Handle<ButtonProps>) {
  return () => {
    const { variant, className, type = 'button', ...rest } = handle.props;
    return (
      <button
        {...rest}
        type={type}
        className={buttonClass(variant, className)}
      />
    );
  };
}

// Props<'a'> is a union, so it can't be extended by an interface.
type ButtonLinkProps = Props<'a'> & { variant?: ButtonVariant };

export function ButtonLink(handle: Handle<ButtonLinkProps>) {
  return () => {
    const { variant, className, ...rest } = handle.props;
    return <a {...rest} className={buttonClass(variant, className)} />;
  };
}
