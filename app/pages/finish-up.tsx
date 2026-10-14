import type { Handle } from 'remix/component';
import { TAB_DISCLOSURE } from '../builder/disclosure.ts';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import { StartOver } from '../builder/start-over.tsx';
import type { Section } from '../user.ts';
export interface FinishUpProps extends BuilderPageProps {
  completed: { section: Section; label: string; path: string }[];
}
export function FinishUpPage(handle: Handle<FinishUpProps>) {
  return () => (
    <div>
      <BuilderLayout {...handle.props} step="finish-up" title="Finish up">
        <p>Your completed Sections:</p>
        <ul>
          {handle.props.completed.map(({ section, label, path }) => (
            <li key={section}>
              {label} — Completed{' '}
              <a
                href={`${path}?${new URLSearchParams({ returnUrl: '/finish-up' })}`}
              >
                Edit {label}
              </a>
            </li>
          ))}
        </ul>
        <p>{TAB_DISCLOSURE}</p>
      </BuilderLayout>
      <StartOver action="/finish-up" />
    </div>
  );
}
