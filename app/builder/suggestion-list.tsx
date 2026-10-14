import { type Handle, on, ref } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import { Button } from '../ui/button.tsx';
import { classes } from '../ui/classes.ts';
import { controlClass } from '../ui/field.tsx';
import { Spinner } from '../ui/spinner.tsx';
import {
  canRetrySuggestions,
  SUGGESTION_FAILURE_MESSAGES,
  type Suggestions,
} from './suggestions.ts';

/**
 * Shared UI for the Suggestion pages (experience details, skills, summary):
 * the Suggestions panel with its loading and failure states, the "+" Suggestion
 * rows, the bordered box of picked items, the typed-entry input and the cap notice.
 */

interface SuggestionPanelProps {
  title: string;
  suggestions: Pick<Suggestions<unknown>, 'state' | 'failure' | 'retry'>;
  /** The Suggestions; rendered only once they have loaded. */
  children?: RemixNode;
}

/** Heading plus the Suggestions, or the loading or failure state in their place. */
export function SuggestionPanel(handle: Handle<SuggestionPanelProps>) {
  return () => {
    const { title, suggestions, children } = handle.props;
    const { state, failure } = suggestions;
    let body: RemixNode = children;
    if (state === 'idle' || state === 'loading') {
      // Reserves the panel's height so the page doesn't shift once Suggestions load.
      body = (
        <Spinner label="Loading Suggestions…" className="h-80 items-start" />
      );
    } else if (state === 'error' && failure) {
      body = (
        <div className="space-y-3 rounded-md border p-4">
          <p role="status" className="text-sm text-gray-600">
            {SUGGESTION_FAILURE_MESSAGES[failure]}
          </p>
          {canRetrySuggestions(failure) ? (
            <Button
              variant="outline"
              mix={on('click', () => suggestions.retry())}
            >
              Retry
            </Button>
          ) : null}
        </div>
      );
    }
    return (
      <div>
        <h2 className="mb-3 text-base text-gray-900">{title}</h2>
        {body}
      </div>
    );
  };
}

export interface SuggestionGroup {
  title: string;
  items: readonly string[];
  /** Adds the picked Suggestion to this group's answers. */
  pick: (text: string) => void;
}

interface SuggestionGroupsProps {
  groups: readonly SuggestionGroup[];
  /** True once the user can't pick this Suggestion (already picked, or at the cap). */
  disabled: (text: string) => boolean;
}

/** Bordered box of Suggestion groups, each a heading and a list of "+" rows. */
export function SuggestionGroups(handle: Handle<SuggestionGroupsProps>) {
  return () => {
    const { groups, disabled } = handle.props;
    return (
      <div className="space-y-2 rounded-md border p-4">
        {groups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="mb-3 text-sm text-gray-900">{group.title}</h3>
            {Array.from(new Set(group.items)).map((text) => (
              <button
                key={text}
                type="button"
                disabled={disabled(text)}
                className="block w-full cursor-pointer rounded-md border px-4 py-2 text-left text-sm text-gray-800 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                mix={on('click', () => group.pick(text))}
              >
                + {text}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };
}

interface PickedBoxProps {
  title: string;
  /** Short line under the title, such as how many picks remain. */
  note?: string;
  /** Shown inside the box while nothing is picked. */
  emptyText: string;
  empty: boolean;
  className?: string;
  children?: RemixNode;
}

/** Titled, bordered box holding the items the user picked or wrote. */
export function PickedBox(handle: Handle<PickedBoxProps>) {
  return () => {
    const { title, note, emptyText, empty, className, children } = handle.props;
    return (
      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-900">{title}</h2>
        {note ? <p className="mb-3 text-sm text-gray-600">{note}</p> : null}
        <div className={classes('rounded-md border p-4 shadow-sm', className)}>
          {empty ? <p className="text-sm text-gray-500">{emptyText}</p> : null}
          {children}
        </div>
      </div>
    );
  };
}

interface ManualEntryProps {
  id: string;
  /** Submits a typed entry the user didn't press Enter on; the schema drops blanks. */
  name: string;
  label: string;
  placeholder: string;
  /** Returns false to keep the text in the input, such as for a duplicate. */
  onAdd: (text: string) => boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** Text input that adds the typed entry when the user presses Enter. */
export function ManualEntry(handle: Handle<ManualEntryProps>) {
  let input: HTMLInputElement | undefined;
  return () => {
    const { id, name, label, placeholder, invalid, describedBy } = handle.props;
    return (
      <div>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          name={name}
          type="text"
          placeholder={placeholder}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={describedBy}
          className={controlClass('input', Boolean(invalid))}
          mix={[
            ref((node) => {
              input = node;
            }),
            on('keydown', (event) => {
              if (event.key !== 'Enter' || !input) return;
              event.preventDefault();
              const text = input.value.trim();
              if (text && handle.props.onAdd(text)) input.value = '';
            }),
          ]}
        />
      </div>
    );
  };
}

/** Visible notice that the list is full; replaces the typed-entry input. */
export function LimitNotice(handle: Handle<{ max: number; noun: string }>) {
  return () => (
    <p role="status" className="text-sm text-yellow-700">
      You've added the maximum of {handle.props.max} {handle.props.noun}. Remove
      one to add another.
    </p>
  );
}
