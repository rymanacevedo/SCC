import { type Handle, on } from 'remix/component';
import { createSummaries } from '../api.ts';
import {
  BuilderField,
  BuilderLayout,
  type BuilderPageProps,
} from '../builder/layout.tsx';
import {
  loadSuggestions,
  SUGGESTIONS_UNAVAILABLE,
} from '../builder/suggestions.ts';
export function SummaryPage(handle: Handle<BuilderPageProps>) {
  let textarea: HTMLTextAreaElement | undefined;
  const suggestions = loadSuggestions(handle, (signal) =>
    handle.props.prompt
      ? createSummaries({ prompt: handle.props.prompt }, signal)
      : Promise.resolve({ ok: false, error: 'validation' }),
  );
  return () => (
    <BuilderLayout
      {...handle.props}
      step="summary"
      title="Create Your Professional Summary"
      suggestions={
        <div>
          <h2 className="mb-4 text-xl font-bold">Suggestions</h2>
          {suggestions.state === 'idle' || suggestions.state === 'loading' ? (
            <div
              role="status"
              className="animate-pulse rounded bg-gray-100"
              style={{ height: '20rem' }}
            >
              Loading Suggestions…
            </div>
          ) : null}
          {suggestions.state === 'error' ? (
            <p role="status">{SUGGESTIONS_UNAVAILABLE}</p>
          ) : null}
          {suggestions.value?.map((suggestion) => (
            <button
              key={`${suggestion.title}:${suggestion.text}`}
              type="button"
              className="mb-4 block w-full rounded border p-4 text-left"
              mix={on('click', () => {
                if (textarea) {
                  textarea.value = suggestion.text;
                  textarea.focus();
                }
              })}
            >
              <h3 className="font-bold">{suggestion.title}</h3>
              <p>{suggestion.text}</p>
            </button>
          ))}
        </div>
      }
    >
      <BuilderField
        name="summary"
        label="Professional Summary"
        textarea
        capture={(node) => {
          textarea = node;
        }}
        values={handle.props.values}
        errors={handle.props.errors}
      />
      <p>Aim for 3–5 sentences that capture your strongest qualifications.</p>
    </BuilderLayout>
  );
}
