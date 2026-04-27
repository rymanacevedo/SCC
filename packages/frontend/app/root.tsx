import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import type { Route } from '../.react-router/types/app/+types/root.ts';
import { AppShell } from './components/AppShell';
import { ErrorBoundaryContent } from './components/ErrorBoundaryContent';
import { getUser, setUser, type User } from './utils/user';
import './app.css';

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export function HydrateFallback() {
  return (
    <div id="loading-splash">
      <p>Loading, please wait...</p>
    </div>
  );
}

export function shouldRevalidate() {
  return false;
}

export async function clientLoader() {
  const user = getUser();

  if (!user) {
    const user: User = {
      userId: crypto.randomUUID(),
    };

    setUser(user);
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <AppShell footerMessage="An error occurred, but the footer is still available. Use the Report an issue button below if you need help.">
      <ErrorBoundaryContent error={error} />
    </AppShell>
  );
}
