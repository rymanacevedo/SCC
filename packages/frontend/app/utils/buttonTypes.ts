const defaultShape = 'rounded-md border border-transparent cursor-pointer';
const defaultFocus =
  'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2';
export const buttonTypes = {
  primary: {
    base: `${defaultShape} bg-blue-600 text-white`,
    hover: 'hover:bg-blue-700',
    focus: `${defaultFocus}`,
  },
  secondary: {
    base: `${defaultShape} border-gray-300 bg-white text-gray-700 shadow-sm`,
    hover: 'hover:bg-gray-50',
    focus: `${defaultFocus}`,
  },
  // Can add more types as needed
} as const;

export type ButtonTypes = typeof buttonTypes;
