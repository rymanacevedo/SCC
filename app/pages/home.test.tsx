import { expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { HomePage } from './home.tsx';

test('home offers the first Step', async () => {
  const html = await renderToString(<HomePage />);
  expect(html).toContain('href="/info"');
  expect(html).toContain('Start your resume');
});
