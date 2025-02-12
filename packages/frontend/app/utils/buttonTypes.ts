const defaultShape = 'rounded-md cursor-pointer font-medium shadow-md';
const defaultSize = 'py-2 px-4';
const defaultFocus =
  'focus:outline-none focus:ring focus:ring-2 focus:ring-offset-2';
export const buttonTypes = {
  primary: {
    base: `${defaultShape} bg-blue-600 active:bg-blue-800 text-white`,
    hover: 'hover:bg-blue-700',
    focus: `${defaultFocus}`,
    size: `${defaultSize}`,
  },
  secondary: {
    base: `${defaultShape} bg-white active:bg-gray-300 text-gray-700`,
    hover: 'hover:bg-gray-200',
    focus: `${defaultFocus}`,
    size: `${defaultSize}`,
  },
  icon: {
    base: 'rounded-full text-center bg-blue-600 text-white inline-flex items-center me-2 cursor-pointer',
    hover: 'hover:bg-blue-700',
    focus: `${defaultFocus}`,
    size: 'p-2.5',
  },
  iconCustom: {
    base: 'rounded-full text-center inline-flex items-center cursor-pointer',
    hover: '',
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
