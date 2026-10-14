import { ERROR_MODAL_MESSAGE } from '../error-reporting.ts';

export function ErrorPage() {
  return () => (
    <section>
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p role="alert" className="mt-4">
        {ERROR_MODAL_MESSAGE}
      </p>
      <a href="/" className="mt-6 inline-block underline">
        Return home
      </a>
    </section>
  );
}

export function NotFoundPage() {
  return () => (
    <section>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4">The page you are looking for could not be found.</p>
      <a href="/" className="mt-6 inline-block underline">
        Return home
      </a>
    </section>
  );
}
