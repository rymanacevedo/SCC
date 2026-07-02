import { describe, expect, test } from 'bun:test';
import { getButtonClasses } from './buttonClasses';
import { buttonTypes } from './buttonTypes';
import { sizes } from './sizes';

describe('getButtonClasses', () => {
  test('composes base, default padding, text size, and hover classes', () => {
    const classes = getButtonClasses({
      type: 'primary',
      textSize: 'text-base',
    });

    expect(classes).toBe(
      `${buttonTypes.primary.base} ${buttonTypes.primary.size} text-base ${buttonTypes.primary.hover}`,
    );
  });

  test('uses explicit size over the type default padding', () => {
    const classes = getButtonClasses({
      type: 'primary',
      textSize: 'text-base',
      size: 'large',
    });

    expect(classes).toContain(sizes.buttonPadding.large);
    expect(classes.split(' ')).not.toContain('px-4');
  });

  test('appends extraClasses and classNames additively', () => {
    const classes = getButtonClasses({
      type: 'secondary',
      textSize: 'text-base',
      extraClasses: 'text-center block',
      classNames: 'mb-4 w-full',
    });

    expect(classes).toContain('text-center block');
    expect(classes).toContain('mb-4 w-full');
  });

  test('replaces hover styling with disabled styling when disabled', () => {
    const classes = getButtonClasses({
      type: 'primary',
      textSize: 'text-base',
      disabled: true,
    });

    expect(classes).toContain('opacity-50');
    expect(classes).not.toContain(buttonTypes.primary.hover);
  });

  test('omits undefined hover and size for the custom type without gaps', () => {
    const classes = getButtonClasses({
      type: 'custom',
      textSize: 'text-base',
    });

    expect(classes).toBe(`${buttonTypes.custom.base} text-base`);
    expect(classes).not.toContain('undefined');
  });
});
