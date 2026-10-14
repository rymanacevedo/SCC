import { z } from 'zod';
import { BaseExperienceSchema } from '../../shared/schemas/experience.ts';
import { draftSchemas } from '../../shared/schemas/user.ts';
import { ExperiencePage } from '../pages/experience.tsx';
import { ExperienceEntryPage } from '../pages/experience-entry.tsx';
import { ExperienceSummaryPage } from '../pages/experience-summary.tsx';
import { guardStep, validatedReturnUrl } from '../steps.ts';
import { type Envelope, serializePrompt, type UserStorage } from '../user.ts';
import { createBuilderController, SAVE_ERROR } from './controller.tsx';
import { checkbox, type FormValues } from './form.ts';
import { createEntryHub } from './hub.tsx';

const experienceHubPath = '/experience-summary';
function findExperience(envelope: Envelope, id: string | null) {
  const draft = envelope.drafts.experience;
  if (!id || draft?.jobId === id) return draft;
  return envelope.user.experience?.find((job) => job.jobId === id);
}
function experienceFormValues(entry: object): FormValues {
  return Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [
      key,
      typeof value === 'boolean' ? String(value) : value,
    ]),
  ) as FormValues;
}
export function experienceControllers(storage: UserStorage) {
  const guard = (envelope: Envelope) => guardStep('experience', envelope.user);
  function prepare(url: URL) {
    const stored = storage.read();
    const id = url.searchParams.get('jobId');
    if (
      !stored.ok ||
      !id ||
      guard(stored.value) ||
      stored.value.drafts.experience?.jobId === id
    )
      return stored;
    return stored.value.user.experience?.some((job) => job.jobId === id)
      ? storage.seedDraft('experience', id)
      : stored;
  }
  const pageProps = {
    saveDraft: (typed: FormValues) => {
      const stored = storage.read();
      if (!stored.ok) return SAVE_ERROR;
      const previous = findExperience(stored.value, String(typed.jobId));
      const draft = draftSchemas.experience.safeParse({
        ...previous,
        ...typed,
        currentlyEmployed:
          typed.currentlyEmployed === 'true' ||
          typed.currentlyEmployed === 'on',
        details:
          typeof typed.details === 'string'
            ? [typed.details]
            : (typed.details ?? previous?.details),
      });
      return draft.success && storage.writeDraft('experience', draft.data).ok
        ? undefined
        : SAVE_ERROR;
    },
  };
  const experienceSchema = BaseExperienceSchema.extend({
    currentlyEmployed: checkbox(),
  }).transform((job) => ({
    ...job,
    startDate: job.startDate.toISOString(),
    endDate: job.endDate?.toISOString(),
  }));
  const experience = createBuilderController({
    route: 'experience',
    schema: experienceSchema,
    page: ExperiencePage,
    pageProps,
    read: () => storage.read(),
    prepare,
    guard,
    select: (envelope, url) => {
      const id = url.searchParams.get('jobId');
      const entry = findExperience(envelope, id);
      if (id && !entry) return experienceHubPath;
      return experienceFormValues(entry ?? { jobId: crypto.randomUUID() });
    },
    write: (job, url, envelope) => {
      const id = url.searchParams.get('jobId');
      if (id && (!findExperience(envelope, id) || job.jobId !== id))
        return { ok: false, error: 'not-found' };
      return storage.writeDraft('experience', {
        ...job,
        details: findExperience(envelope, job.jobId)?.details,
      });
    },
    next: (url, job) => {
      const returnUrl = validatedReturnUrl(url);
      return `/experience-entry?${new URLSearchParams({ jobId: job.jobId, ...(returnUrl ? { returnUrl } : {}) })}`;
    },
  });
  const entry = createBuilderController({
    route: 'experience-entry',
    schema: z.object({
      jobId: z.string().min(1),
      details: z.preprocess((value) => {
        if (value === undefined) return [];
        if (typeof value === 'string') return [value];
        return value;
      }, z.array(z.string())),
    }),
    page: ExperienceEntryPage,
    read: () => storage.read(),
    prepare,
    guard: (envelope, url) => {
      const target = guard(envelope);
      if (target !== undefined) return target;
      const id = url.searchParams.get('jobId');
      if (!id || !findExperience(envelope, id)) return experienceHubPath;
      return undefined;
    },
    select: (envelope, url) => {
      const job = findExperience(envelope, url.searchParams.get('jobId'))!;
      return {
        ...experienceFormValues(job),
        jobId: job.jobId!,
        prompt:
          serializePrompt({
            experience: [
              job as NonNullable<typeof envelope.user.experience>[number],
            ],
          }) ?? '',
      };
    },
    pageProps,
    write: (typed, url, envelope) => {
      const id = url.searchParams.get('jobId');
      const job = findExperience(envelope, id);
      if (!job || typed.jobId !== id) return { ok: false, error: 'not-found' };
      const parsed = experienceSchema.safeParse({
        ...job,
        details: typed.details,
      });
      return parsed.success
        ? storage.writeEntry('experience', parsed.data)
        : { ok: false, error: 'validation' };
    },
    next: () => experienceHubPath,
  });
  const hub = createEntryHub(
    storage,
    'experience',
    'experience-summary',
    'jobId',
    ExperienceSummaryPage,
  );
  return [experience, entry, hub];
}
