import { expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { buttonClass } from '../ui/button.tsx';
import { HomePage } from './home.tsx';

test('home offers the first Step', async () => {
  const html = await renderToString(<HomePage />);
  expect(html).toContain('href="/info"');
  expect(html).toContain('Create Your Professional Resume');
  expect(html).toContain('Create My Resume');
  expect(html).toContain(buttonClass('primary', undefined, 'lg'));
});
