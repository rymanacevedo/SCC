import { TAB_DISCLOSURE } from '../builder/disclosure.ts';
export function HomePage() {
  return () => (
    <section className="space-y-6">
      <h1 className="text-4xl font-bold">Build your resume</h1>
      <p>
        Answer simple questions and write your resume one section at a time.
      </p>
      <a
        href="/info"
        className="inline-block rounded bg-blue-700 px-6 py-3 text-white"
      >
        Start your resume
      </a>
      <p>{TAB_DISCLOSURE}</p>
    </section>
  );
}
