import type { Handle } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import type { StepId } from '../steps.ts';
import { ButtonLink } from '../ui/button.tsx';
import { cardClass } from '../ui/card.tsx';
import { BuilderLayout, type BuilderPageProps } from './layout.tsx';

export interface HubEntry {
  id: string;
  title: string;
  editHref: string;
  details?: RemixNode;
}
interface HubLayoutProps extends BuilderPageProps {
  step: StepId;
  title: string;
  /** Form field that names the entry to delete, read by createEntryHub. */
  idField: string;
  entries: HubEntry[];
  addHref: string;
  addLabel: string;
}

const actionClass = 'cursor-pointer underline hover:text-blue-700';

/** A Hub page: numbered entry cards with Edit and Delete, then "add another". */
export function HubLayout(handle: Handle<HubLayoutProps>) {
  return () => {
    const { idField, entries, addHref, addLabel, ...layout } = handle.props;
    const { url } = layout;
    return (
      <BuilderLayout
        {...layout}
        beforeForm={entries.map((entry, index) => (
          <article
            key={entry.id}
            className={cardClass('outlined', 'relative mb-4 py-3 pr-10 pl-14')}
          >
            <span className="absolute top-0 left-0 rounded border border-t-0 border-l-0 px-4 py-2">
              {index + 1}
            </span>
            <h2 className="text-2xl text-gray-900">{entry.title}</h2>
            {entry.details}
            <div className="mt-4 flex gap-3">
              <a
                href={entry.editHref}
                aria-label={`Edit ${entry.title}`}
                className={actionClass}
              >
                Edit
              </a>
              <form method="post" action={`${url.pathname}${url.search}`}>
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name={idField} value={entry.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${entry.title}`}
                  className={actionClass}
                >
                  Delete
                </button>
              </form>
            </div>
          </article>
        ))}
      >
        <ButtonLink href={addHref} variant="secondary" className="w-full">
          {addLabel}
        </ButtonLink>
      </BuilderLayout>
    );
  };
}
