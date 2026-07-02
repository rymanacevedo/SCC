import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

describe('ExperienceSummary', () => {
  test('renders a secondary-style add-another link and a Continue to Education action', async () => {
    process.env.VITE_HONO_BACKEND_URL = 'https://backend.example.com';
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          origin: 'https://example.com',
        },
      },
      configurable: true,
    });
    mock.module('react-router', () => ({
      data: (value: unknown) => value,
      Form: ({
        children,
        ...props
      }: React.PropsWithChildren<React.ComponentProps<'form'>>) => (
        <form {...props}>{children}</form>
      ),
      NavLink: ({
        children,
        to,
        ...props
      }: React.PropsWithChildren<
        Omit<React.ComponentProps<'a'>, 'href'> & { to: string }
      >) => (
        <a href={to} {...props}>
          {children}
        </a>
      ),
      useLoaderData: () => ({
        experiences: [
          {
            jobId: 'job-1',
            jobTitle: 'Developer',
            employer: 'Example Co',
            city: 'Denver',
            state: 'CO',
            startDate: new Date('2024-01-01T00:00:00.000Z'),
            endDate: new Date('2024-06-01T00:00:00.000Z'),
            details: ['Built features'],
          },
        ],
        returnUrl: null,
        jobId: null,
      }),
      useNavigate: () => mock(() => {}),
      redirect: (value: string) => value,
    }));
    mock.module('../../components/ErrorBoundaryContent', () => ({
      RouteErrorBoundary: () => null,
    }));
    mock.module('../../utils/user', () => ({
      clearQueuedExperience: () => {},
      getRequiredUserTrait: () => [],
    }));
    const { default: ExperienceSummary } = await import('./experienceSummary');
    const html = renderToStaticMarkup(<ExperienceSummary />);

    expect(html).toContain('Continue to Education');
    expect(html).toContain('+ Add another position');
    expect(html).toContain('href="/experience"');
    expect(html).toContain('bg-white');
    expect(html).toContain('text-gray-700');
  });
});
