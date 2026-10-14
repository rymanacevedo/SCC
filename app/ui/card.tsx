import type { Handle, Props } from 'remix/component';
import { classes } from './classes.ts';

/** outlined: bordered box (entries, suggestion lists); raised: shadowed panel split into sections. */
export type CardVariant = 'outlined' | 'raised';

const variants: Record<CardVariant, string> = {
  outlined: 'rounded-md border p-4',
  raised: 'overflow-hidden rounded-lg shadow',
};

export function cardClass(
  variant: CardVariant = 'outlined',
  className?: string,
): string {
  return classes(variants[variant], className);
}

interface CardProps extends Props<'div'> {
  variant?: CardVariant;
}

export function Card(handle: Handle<CardProps>) {
  return () => {
    const { variant, className, ...rest } = handle.props;
    return <div {...rest} className={cardClass(variant, className)} />;
  };
}
