const defaultShape =
  'rounded-md border border-transparent cursor-pointer font-medium';
const defaultSize = 'py-2 px-4';
const defaultFocus =
  'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2';
export const buttonTypes = {
  primary: {
    base: `${defaultShape} bg-blue-600 text-white`,
    hover: 'hover:bg-blue-700',
    focus: `${defaultFocus}`,
    size: `${defaultSize}`,
  },
  secondary: {
    base: `${defaultShape} border-gray-300 bg-white text-gray-700 shadow-sm`,
    hover: 'hover:bg-gray-50',
    focus: `${defaultFocus}`,
    size: `${defaultSize}`,
  },
  icon: {
    base: 'rounded-full text-center bg-blue-600 text-white inline-flex items-center me-2 cursor-pointer',
    hover: 'hover:bg-blue-700',
    focus: `${defaultFocus}`,
    size: 'p-2.5',
  },
  custom: {
    base: 'cursor-pointer',
    hover: undefined,
    focus: undefined,
    size: undefined,
  },
  // Can add more types as needed
} as const;

export type ButtonTypes = typeof buttonTypes;
