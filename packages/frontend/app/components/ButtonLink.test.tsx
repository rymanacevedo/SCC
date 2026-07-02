import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import ButtonLink from './ButtonLink';

describe('ButtonLink', () => {
  test('renders a secondary-styled link as an anchor', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ButtonLink
          to="/education-level"
          text="+ Add another education entry"
          type="secondary"
          classNames="w-full"
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('href="/education-level"');
    expect(markup).toContain('+ Add another education entry');
    expect(markup).toContain('w-full');
    expect(markup).toContain('bg-white');
    expect(markup).toContain('text-center');
  });
});
