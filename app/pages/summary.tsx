import { type Handle, on } from 'remix/component';
import { createSummaries } from '../api.ts';
import {
  BuilderField,
  BuilderLayout,
  type BuilderPageProps,
} from '../builder/layout.tsx';
import { SuggestionPanel } from '../builder/suggestion-list.tsx';
import { loadSuggestions } from '../builder/suggestions.ts';
import { Alert } from '../ui/alert.tsx';
import { cardClass } from '../ui/card.tsx';

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
      subtitle="Write a compelling summary that highlights your key achievements and career goals. This is often the first thing employers read."
      suggestions={
        <SuggestionPanel title="Example Summaries" suggestions={suggestions}>
          <div className="space-y-4">
            {suggestions.value?.map((suggestion) => (
              <button
                key={`${suggestion.title}:${suggestion.text}`}
                type="button"
                className={cardClass(
                  'outlined',
                  'block w-full cursor-pointer text-left transition-colors hover:bg-gray-100',
                )}
                mix={on('click', () => {
                  if (textarea) {
                    textarea.value = suggestion.text;
                    textarea.focus();
                  }
                })}
              >
                <h3 className="mb-2 text-base text-gray-900">
                  {suggestion.title}
                </h3>
                <p className="text-sm text-gray-600">{suggestion.text}</p>
              </button>
            ))}
          </div>
        </SuggestionPanel>
      }
    >
      <div>
        <BuilderField
          name="summary"
          label="Professional Summary"
          textarea
          placeholder="Write a professional summary that highlights your key skills and experience..."
          capture={(node) => {
            textarea = node;
          }}
          values={handle.props.values}
          errors={handle.props.errors}
        />
        <p className="mt-2 text-sm text-gray-600">
          Aim for 3-5 sentences that capture your strongest qualifications.
        </p>
      </div>
      <Alert tone="tips" title="Writing Tips">
        <ul className="space-y-2">
          <li>Start with your professional title and years of experience</li>
          <li>Highlight 2-3 key achievements or skills</li>
          <li>Mention your career goals or what you're looking for</li>
          <li>Keep it concise and focused</li>
        </ul>
      </Alert>
    </BuilderLayout>
  );
}
