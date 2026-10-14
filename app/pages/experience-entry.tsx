import { type Handle, on } from 'remix/component';
import { createExperience } from '../api.ts';
import { MAX_DETAILS } from '../builder/details.ts';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import {
  LimitNotice,
  ManualEntry,
  PickedBox,
  SuggestionGroups,
  SuggestionPanel,
} from '../builder/suggestion-list.tsx';
import { loadSuggestions } from '../builder/suggestions.ts';
import { Alert } from '../ui/alert.tsx';
import { FieldError } from '../ui/field.tsx';

function roleQuestion(jobTitle: unknown): string {
  if (typeof jobTitle !== 'string' || !jobTitle.trim())
    return 'What did you do in this role?';
  const article = /^[aeiou]/i.test(jobTitle.trim()) ? 'an' : 'a';
  return `What did you do as ${article} ${jobTitle.trim()}?`;
}

export function ExperienceEntryPage(handle: Handle<BuilderPageProps>) {
  const initial = handle.props.values.details;
  let rows = (Array.isArray(initial) ? initial : initial ? [initial] : [])
    .filter((text) => text.trim())
    .map((text) => ({ id: crypto.randomUUID(), text }));
  let saveError: string | undefined;
  function persist() {
    saveError = handle.props.saveDraft?.({
      ...handle.props.values,
      details: rows.map((row) => row.text),
    });
    void handle.update();
  }
  const has = (text: string) => rows.some((row) => row.text === text);
  function add(text: string) {
    if (rows.length >= MAX_DETAILS || has(text)) return false;
    rows.push({ id: crypto.randomUUID(), text });
    persist();
    return true;
  }
  const suggestions = loadSuggestions(handle, (signal) =>
    createExperience(
      {
        prompt: String(handle.props.values.prompt ?? handle.props.prompt ?? ''),
      },
      signal,
    ),
  );
  return () => {
    const errors = handle.props.errors?.details;
    const full = rows.length >= MAX_DETAILS;
    return (
      <BuilderLayout
        {...handle.props}
        errors={
          saveError
            ? { ...handle.props.errors, _form: [saveError] }
            : handle.props.errors
        }
        step="experience-entry"
        title={roleQuestion(handle.props.values.jobTitle)}
        subtitle="Choose from our pre-written examples below or write your own."
        suggestionsFirst
        suggestions={
          <SuggestionPanel
            title="Suggested Experience"
            suggestions={suggestions}
          >
            <SuggestionGroups
              groups={[
                {
                  title: 'Recommended Experience',
                  items: suggestions.value?.expertRecommended ?? [],
                  pick: add,
                },
                {
                  title: 'Other Examples',
                  items: suggestions.value?.other ?? [],
                  pick: add,
                },
              ]}
              disabled={(text) => full || has(text)}
            />
          </SuggestionPanel>
        }
      >
        <Alert tone="tips" title="Writing Tips">
          <ul className="space-y-2">
            <li>Highlight 2-3 key achievements.</li>
            <li>Mention your career goals or what you're looking for.</li>
            <li>Keep it concise and focused.</li>
          </ul>
        </Alert>
        <input
          type="hidden"
          name="jobId"
          value={String(handle.props.values.jobId ?? '')}
        />
        <PickedBox
          title="Job Experience"
          empty={rows.length === 0}
          emptyText="Click on suggested experiences or write your own to get started."
          className="space-y-2"
        >
          {rows.map((row, index) => (
            <div
              key={row.id}
              data-row-id={row.id}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                aria-label={`Remove detail ${index + 1}`}
                className="cursor-pointer p-2 text-gray-900 hover:text-gray-600"
                mix={on('click', () => {
                  rows = rows.filter((value) => value.id !== row.id);
                  persist();
                })}
              >
                <svg
                  aria-hidden="true"
                  className="h-2.5 w-2.5 fill-current"
                  viewBox="0 0 460.775 460.775"
                >
                  <path d="M285.08,230.397L456.218,59.27c6.076-6.077,6.076-15.911,0-21.986L423.511,4.565c-2.913-2.911-6.866-4.55-10.992-4.55c-4.127,0-8.08,1.639-10.993,4.55l-171.138,171.14L59.25,4.565c-2.913-2.911-6.866-4.55-10.993-4.55c-4.126,0-8.08,1.639-10.992,4.55L4.558,37.284c-6.077,6.075-6.077,15.909,0,21.986l171.138,171.128L4.575,401.505c-6.074,6.077-6.074,15.911,0,21.986l32.709,32.719c2.911,2.911,6.865,4.55,10.992,4.55c4.127,0,8.08-1.639,10.994-4.55l171.117-171.12l171.118,171.12c2.913,2.911,6.866,4.55,10.993,4.55c4.128,0,8.081-1.639,10.992-4.55l32.709-32.719c6.074-6.075,6.074-15.909,0-21.986L285.08,230.397z" />
                </svg>
              </button>
              <textarea
                id={row.id}
                name="details"
                aria-label={`Experience detail ${index + 1}`}
                defaultValue={row.text}
                className="field-sizing-content w-full resize-none border-0"
                mix={on('input', (event) => {
                  row.text = (event.target as HTMLTextAreaElement).value;
                  persist();
                })}
              />
            </div>
          ))}
        </PickedBox>
        {errors?.length ? (
          <FieldError id="details-error" errors={errors} />
        ) : null}
        {full ? (
          <LimitNotice max={MAX_DETAILS} noun="details" />
        ) : (
          <ManualEntry
            id="manual-detail"
            name="details"
            label="Write your own experience"
            placeholder="Type your experience and press Enter"
            invalid={Boolean(errors?.length)}
            describedBy={errors?.length ? 'details-error' : undefined}
            onAdd={add}
          />
        )}
        <p className="text-sm text-gray-600">
          Aim for 3-6 bullets that capture your experience at the role.
        </p>
      </BuilderLayout>
    );
  };
}
