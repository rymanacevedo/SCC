export const sharedFormControlClass =
  'mt-1 block w-full border shadow-sm px-3 py-3 text-lg';

export const inputTypes = {
  text: sharedFormControlClass,
  email: sharedFormControlClass,
  month: sharedFormControlClass,
  number: sharedFormControlClass,
  tel: sharedFormControlClass,
} as const;

export type InputTypes = typeof inputTypes;
export type InputTypeKeys = keyof InputTypes;
