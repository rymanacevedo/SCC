const defaultShape = 'mt-1 block w-full border shadow-sm';

export const inputTypes = {
  text: `${defaultShape}`,
  email: `${defaultShape}`,
  month: `${defaultShape}`,
} as const;

export type InputTypes = typeof inputTypes;
