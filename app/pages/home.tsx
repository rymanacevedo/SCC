import { ButtonLink } from '../ui/button.tsx';

export function HomePage() {
  return () => (
    <section className="py-24 text-center">
      <h1 className="mb-6 text-5xl font-bold text-gray-900">
        Create Your Professional Resume
      </h1>
      <p className="mb-8 text-lg text-gray-600">
        Get started with our easy-to-use resume builder.
      </p>
      <ButtonLink href="/info" size="lg">
        Create My Resume
      </ButtonLink>
    </section>
  );
}
