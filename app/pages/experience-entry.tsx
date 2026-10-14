import { type Handle, on } from 'remix/component';
import { createExperience } from '../api.ts';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import {
  loadSuggestions,
  SUGGESTIONS_UNAVAILABLE,
} from '../builder/suggestions.ts';

export function ExperienceEntryPage(handle: Handle<BuilderPageProps>) {
  const initial = handle.props.values.details;
  let rows = (
    Array.isArray(initial) ? initial : initial ? [initial] : ['']
  ).map((text) => ({ id: crypto.randomUUID(), text }));
  let saveError: string | undefined;
  function persist() {
    saveError = handle.props.saveDraft?.({
      ...handle.props.values,
      details: rows.map((row) => row.text),
    });
    void handle.update();
  }
  const suggestions = loadSuggestions(handle, (signal) =>
    createExperience(
      {
        prompt: String(handle.props.values.prompt ?? handle.props.prompt ?? ''),
      },
      signal,
    ),
  );
  return () => (
    <BuilderLayout
      {...handle.props}
      errors={
        saveError
          ? { ...handle.props.errors, _form: [saveError] }
          : handle.props.errors
      }
      step="experience-entry"
      title="Describe your experience"
      suggestions={
        <div>
          <h2>Suggestions</h2>
          {suggestions.state === 'idle' || suggestions.state === 'loading' ? (
            <div role="status" style={{ height: '20rem' }}>
              Loading Suggestions…
            </div>
          ) : null}
          {suggestions.state === 'error' ? (
            <p role="status">{SUGGESTIONS_UNAVAILABLE}</p>
          ) : null}
          {Array.from(
            new Set([
              ...(suggestions.value?.expertRecommended ?? []),
              ...(suggestions.value?.other ?? []),
            ]),
          ).map((text) => (
            <button
              key={text}
              type="button"
              mix={on('click', () => {
                rows.push({ id: crypto.randomUUID(), text });
                persist();
              })}
            >
              {text}
            </button>
          ))}
        </div>
      }
    >
      <input
        type="hidden"
        name="jobId"
        value={String(handle.props.values.jobId ?? '')}
      />
      {rows.map((row) => (
        <div key={row.id} data-row-id={row.id}>
          <label htmlFor={row.id}>Experience detail</label>
          <textarea
            id={row.id}
            name="details"
            defaultValue={row.text}
            mix={on('input', (event) => {
              row.text = (event.target as HTMLTextAreaElement).value;
              persist();
            })}
          />
          <button
            type="button"
            mix={on('click', () => {
              rows = rows.filter((value) => value.id !== row.id);
              persist();
            })}
          >
            Remove detail
          </button>
        </div>
      ))}
      {handle.props.errors?.details?.map((message) => (
        <p role="alert">{message}</p>
      ))}
      <button
        type="button"
        mix={on('click', () => {
          rows.push({ id: crypto.randomUUID(), text: '' });
          persist();
        })}
      >
        Add detail
      </button>
    </BuilderLayout>
  );
}
