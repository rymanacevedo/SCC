import { type Handle, on, ref } from 'remix/component';
import { createSkills } from '../api.ts';
import type { FormValues } from '../builder/form.ts';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import { MAX_SKILLS } from '../builder/skills.ts';
import {
  loadSuggestions,
  SUGGESTIONS_UNAVAILABLE,
} from '../builder/suggestions.ts';

const categories = ['expertRecommended', 'other'] as const;
type Category = (typeof categories)[number];
function selectedValues(value: FormValues[string] | undefined): string[] {
  if (Array.isArray(value)) return [...value];
  if (value) return [value];
  return [];
}

export function SkillsPage(handle: Handle<BuilderPageProps>) {
  const selected: Record<Category, string[]> = {
    expertRecommended: selectedValues(handle.props.values.expertRecommended),
    other: selectedValues(handle.props.values.other),
  };
  let input: HTMLInputElement | undefined;
  const total = () => selected.expertRecommended.length + selected.other.length;
  const isSelected = (skill: string) =>
    categories.some((category) => selected[category].includes(skill));
  function add(text: string, category: Category) {
    const skill = text.trim();
    if (!skill || total() >= MAX_SKILLS || isSelected(skill)) return;
    selected[category].push(skill);
    void handle.update();
  }
  function addManual() {
    if (input) {
      add(input.value, 'other');
      input.value = '';
      input.focus();
    }
  }
  const suggestions = loadSuggestions(handle, (signal) =>
    createSkills({ prompt: handle.props.prompt ?? '' }, signal),
  );
  return () => (
    <BuilderLayout
      {...handle.props}
      step="skills"
      title="What skills would you like to highlight?"
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
          {categories.map((category) => (
            <div key={category}>
              <h3>
                {category === 'expertRecommended'
                  ? 'Expert Skills'
                  : 'Other Skills'}
              </h3>
              {Array.from(new Set(suggestions.value?.[category] ?? [])).map(
                (text) => (
                  <button
                    key={text}
                    type="button"
                    disabled={total() >= MAX_SKILLS || isSelected(text)}
                    mix={on('click', () => add(text, category))}
                  >
                    {text}
                  </button>
                ),
              )}
            </div>
          ))}
        </div>
      }
    >
      <h2>Your Skills</h2>
      <p>
        {MAX_SKILLS - total()} of {MAX_SKILLS} remaining
      </p>
      {categories.map((category) => (
        <div key={category}>
          {selected[category].map((text) => (
            <div key={text}>
              {text}
              <input type="hidden" name={category} value={text} />
              <button
                type="button"
                aria-label={`Remove ${text}`}
                mix={on('click', () => {
                  selected[category] = selected[category].filter(
                    (value) => value !== text,
                  );
                  void handle.update();
                })}
              >
                Remove
              </button>
            </div>
          ))}
          {handle.props.errors?.[category]?.map((message) => (
            <p id={`${category}-error`} role="alert">
              {message}
            </p>
          ))}
        </div>
      ))}
      <label htmlFor="manual-skill">Add your own skill</label>
      <input
        id="manual-skill"
        aria-invalid={
          categories.some((category) => handle.props.errors?.[category]?.length)
            ? 'true'
            : undefined
        }
        aria-describedby={
          categories
            .filter((category) => handle.props.errors?.[category]?.length)
            .map((category) => `${category}-error`)
            .join(' ') || undefined
        }
        type="text"
        className="block w-full rounded border p-3"
        mix={[
          ref((node) => {
            input = node;
          }),
          on('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addManual();
            }
          }),
        ]}
      />
      <button
        type="button"
        disabled={total() >= MAX_SKILLS}
        mix={on('click', addManual)}
      >
        Add skill
      </button>
    </BuilderLayout>
  );
}
