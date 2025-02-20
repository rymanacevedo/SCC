const defaultShape =
  'mt-1 block w-full border shadow-sm [&:user-invalid]:border-red-500 [&:user-invalid]:text-red-500';

export const inputTypes = {
  text: `${defaultShape}`,
  email: `${defaultShape}`,
  month: `${defaultShape}`,
  number: `${defaultShape}`,
  tel: `${defaultShape}`,
} as const;

export type InputTypes = typeof inputTypes;
export type InputTypeKeys = keyof InputTypes;
