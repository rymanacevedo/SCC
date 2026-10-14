import { afterEach, expect, test } from 'bun:test';
import { on } from 'remix/component';
import { renderToString } from 'remix/component/server';
import { render } from 'remix/component/test';
import { Alert } from './alert.tsx';
import { Button, ButtonLink, buttonClass } from './button.tsx';
import { Card } from './card.tsx';
import { Chip } from './chip.tsx';
import { Field } from './field.tsx';
import { PageHeading } from './heading.tsx';
import { Spinner } from './spinner.tsx';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
function mount(node: JSX.Element) {
  const view = render(node);
  cleanups.push(view.cleanup);
  return view;
}

test('each button variant keeps the old design classes', () => {
  expect(buttonClass('primary')).toContain('bg-blue-600');
  expect(buttonClass('secondary')).toContain('bg-white');
  expect(buttonClass('outline')).toContain('border-slate-300');
  expect(buttonClass('dark')).toContain('bg-slate-900');
  expect(buttonClass('primary')).toContain('disabled:bg-gray-300');
  expect(buttonClass('primary', 'ml-auto')).toEndWith(' ml-auto');
});

test('Button defaults to a non-submitting primary button and forwards mix and disabled', async () => {
  let clicks = 0;
  const view = mount(
    <Button
      disabled={false}
      mix={on('click', () => {
        clicks++;
      })}
    >
      Add
    </Button>,
  );
  const button = view.$('button') as HTMLButtonElement;
  expect(button.type).toBe('button');
  expect(button.className).toBe(buttonClass('primary'));
  await view.act(() => button.click());
  expect(clicks).toBe(1);
  const disabled = await renderToString(
    <Button type="submit" variant="dark" disabled>
      Save
    </Button>,
  );
  expect(disabled).toContain('type="submit"');
  expect(disabled).toContain('disabled');
  expect(disabled).toContain('bg-slate-900');
});

test('ButtonLink is a link styled as a button', async () => {
  const html = await renderToString(
    <ButtonLink href="/info" variant="secondary">
      Previous
    </ButtonLink>,
  );
  expect(html).toContain('<a');
  expect(html).toContain('href="/info"');
  expect(html).toContain(buttonClass('secondary'));
});

test('an invalid Field shows red Field error text wired to the control', async () => {
  const html = await renderToString(
    <Field name="email" label="Email" value="x" errors={['Invalid email']} />,
  );
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('aria-describedby="email-error"');
  expect(html).toContain('border-red-500');
  expect(html).toMatch(
    /id="email-error" role="alert" class="[^"]*text-red-600/,
  );
  expect(html).toContain('Invalid email');
  const valid = await renderToString(
    <Field name="email" label="Email" value="a@b.co" />,
  );
  expect(valid).not.toContain('aria-invalid');
  expect(valid).not.toContain('border-red-500');
  expect(valid).not.toContain('role="alert"');
});

test('a select Field marks the current value and offers a placeholder', async () => {
  // happy-dom mis-resolves option.selected on detached options; assert markup.
  const html = await renderToString(
    <Field
      name="state"
      label="State"
      value="TX"
      placeholder="Select a state"
      options={[
        { value: 'CA', label: 'California' },
        { value: 'TX', label: 'Texas' },
      ]}
    />,
  );
  expect(html).toContain('<option value="">Select a state</option>');
  expect(html).toContain('<option value="CA">California</option>');
  expect(html).toMatch(/<option value="TX" selected[^>]*>Texas<\/option>/);
  expect(html).toContain('for="state"');
});

test('a textarea Field hands its element to capture', () => {
  let captured: HTMLTextAreaElement | undefined;
  mount(
    <Field
      name="summary"
      label="Summary"
      value="Hello"
      textarea
      capture={(node) => {
        captured = node;
      }}
    />,
  );
  expect(captured?.value).toBe('Hello');
});

test('PageHeading renders the title and an optional subtitle', async () => {
  const html = await renderToString(
    <PageHeading title="Tell us" subtitle="Basics first." />,
  );
  expect(html).toContain('<h1');
  expect(html).toContain('Basics first.');
  expect(await renderToString(<PageHeading title="Only" />)).not.toContain(
    '<p',
  );
});

test('a Chip offers a labelled remove button only when removable', async () => {
  let removed = 0;
  const view = mount(
    <Chip
      onRemove={() => {
        removed++;
      }}
      removeLabel="Remove Leadership"
    >
      Leadership
    </Chip>,
  );
  const remove = view.$('button[aria-label="Remove Leadership"]');
  await view.act(() => (remove as HTMLButtonElement).click());
  expect(removed).toBe(1);
  expect(await renderToString(<Chip>Static</Chip>)).not.toContain('<button');
});

test('Card, Alert and Spinner render their variants', async () => {
  expect(await renderToString(<Card>Entry</Card>)).toContain('border');
  expect(await renderToString(<Card variant="raised">Panel</Card>)).toContain(
    'shadow',
  );
  const error = await renderToString(<Alert tone="error">Form error</Alert>);
  expect(error).toContain('role="alert"');
  expect(error).toContain('bg-rose-50');
  const tips = await renderToString(
    <Alert tone="tips" title="Writing Tips">
      Keep it short
    </Alert>,
  );
  expect(tips).not.toContain('role="alert"');
  expect(tips).toContain('Writing Tips');
  const spinner = await renderToString(
    <Spinner label="Loading Suggestions…" />,
  );
  expect(spinner).toContain('role="status"');
  expect(spinner).toContain('Loading Suggestions…');
  expect(spinner).toContain('animate-spin');
});
