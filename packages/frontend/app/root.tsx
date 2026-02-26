import { useEffect, useState } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from 'react-router';

import type { Route } from '../.react-router/types/app/+types/root.ts';
import Footer from './components/Footer';
import Modal from './components/Modal';
import { reportError } from './utils/reportError';
import { type User, getUser, setUser } from './utils/user';
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
      <body className="min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);

  useEffect(() => {
    reportError(error);
  }, [error]);

  let message = 'Oops!';
  let details = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={message}
      >
        <p className="text-gray-700 mb-4">{details}</p>
        <p className="text-sm text-gray-500 mb-4">
          This error has been automatically reported. You can also use the
          &quot;Report an issue&quot; button in the footer to provide additional
          details.
        </p>
        {import.meta.env.DEV && error instanceof Error && error.stack && (
          <pre className="w-full p-4 overflow-x-auto text-xs bg-gray-100 rounded mb-4">
            <code>{error.stack}</code>
          </pre>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Close
          </button>
        </div>
      </Modal>
    </main>
  );
}
