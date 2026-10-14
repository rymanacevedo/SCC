import type { Handle } from 'remix/component';
import { createSkills } from '../api.ts';
import type { FormValues } from '../builder/form.ts';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import { MAX_SKILLS } from '../builder/skills.ts';
import {
  LimitNotice,
  ManualEntry,
  PickedBox,
  SuggestionGroups,
  SuggestionPanel,
} from '../builder/suggestion-list.tsx';
import { loadSuggestions } from '../builder/suggestions.ts';
import { Chip } from '../ui/chip.tsx';
import { FieldError } from '../ui/field.tsx';

const categories = ['expertRecommended', 'other'] as const;
type Category = (typeof categories)[number];
function selectedValues(value: FormValues[string] | undefined): string[] {
  if (Array.isArray(value)) return value.filter((skill) => skill.trim());
  if (value?.trim()) return [value];
  return [];
}

export function SkillsPage(handle: Handle<BuilderPageProps>) {
  const selected: Record<Category, string[]> = {
    expertRecommended: selectedValues(handle.props.values.expertRecommended),
    other: selectedValues(handle.props.values.other),
  };
  const total = () => selected.expertRecommended.length + selected.other.length;
  const isSelected = (skill: string) =>
    categories.some((category) => selected[category].includes(skill));
  function add(text: string, category: Category) {
    const skill = text.trim();
    if (!skill || total() >= MAX_SKILLS || isSelected(skill)) return false;
    selected[category].push(skill);
    void handle.update();
    return true;
  }
  function remove(skill: string) {
    for (const category of categories)
      selected[category] = selected[category].filter(
        (value) => value !== skill,
      );
    void handle.update();
  }
  const suggestions = loadSuggestions(handle, (signal) =>
    createSkills({ prompt: handle.props.prompt ?? '' }, signal),
  );
  return () => {
    const errored = categories.filter(
      (category) => handle.props.errors?.[category]?.length,
    );
    const full = total() >= MAX_SKILLS;
    return (
      <BuilderLayout
        {...handle.props}
        step="skills"
        title="What skills would you like to highlight?"
        subtitle="Add skills that are relevant to your experience and the job you want."
        suggestionsFirst
        suggestions={
          <SuggestionPanel title="Suggested Skills" suggestions={suggestions}>
            <SuggestionGroups
              groups={categories.map((category) => ({
                title:
                  category === 'expertRecommended'
                    ? 'Expert Skills'
                    : 'Other Skills',
                items: suggestions.value?.[category] ?? [],
                pick: (text) => add(text, category),
              }))}
              disabled={(text) => full || isSelected(text)}
            />
          </SuggestionPanel>
        }
      >
        <PickedBox
          title="Your Skills"
          note={`${MAX_SKILLS - total()} of ${MAX_SKILLS} remaining`}
          empty={total() === 0}
          emptyText="No skills added yet. Pick skills from the suggestions, or add your own below."
          className="min-h-50"
        >
          {total() > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.flatMap((category) =>
                selected[category].map((text) => (
                  <Chip
                    key={text}
                    removeLabel={`Remove ${text}`}
                    onRemove={() => remove(text)}
                  >
                    {text}
                    <input type="hidden" name={category} value={text} />
                  </Chip>
                )),
              )}
            </div>
          ) : null}
        </PickedBox>
        {errored.map((category) => (
          <FieldError
            id={`${category}-error`}
            errors={handle.props.errors?.[category]}
          />
        ))}
        {full ? (
          <LimitNotice max={MAX_SKILLS} noun="skills" />
        ) : (
          <ManualEntry
            id="manual-skill"
            name="other"
            label="Add your own skill"
            placeholder="Type a skill and press Enter"
            invalid={errored.length > 0}
            describedBy={
              errored.map((category) => `${category}-error`).join(' ') ||
              undefined
            }
            onAdd={(text) => add(text, 'other')}
          />
        )}
      </BuilderLayout>
    );
  };
}
