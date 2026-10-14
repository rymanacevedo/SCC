import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { get, post, route } from 'remix/routes';
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

const hub = '/experience-summary';
function find(envelope: Envelope, id: string | null) {
  const draft = envelope.drafts.experience;
  return id
    ? draft?.jobId === id
      ? draft
      : envelope.user.experience?.find((job) => job.jobId === id)
    : draft;
}
function values(entry: object): FormValues {
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
      const previous = find(stored.value, String(typed.jobId));
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
  const schema = BaseExperienceSchema.extend({
    currentlyEmployed: checkbox(),
  }).transform((job) => ({
    ...job,
    startDate: job.startDate.toISOString(),
    endDate: job.endDate?.toISOString(),
  }));
  const experience = createBuilderController({
    route: 'experience',
    schema,
    page: ExperiencePage,
    pageProps,
    read: () => storage.read(),
    prepare,
    guard,
    select: (envelope, url) => {
      const id = url.searchParams.get('jobId');
      const entry = find(envelope, id);
      if (id && !entry) return hub;
      return values(entry ?? { jobId: crypto.randomUUID() });
    },
    write: (job, url, envelope) => {
      const id = url.searchParams.get('jobId');
      if (id && (!find(envelope, id) || job.jobId !== id))
        return { ok: false, error: 'not-found' };
      return storage.writeDraft('experience', {
        ...job,
        details: find(envelope, job.jobId)?.details,
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
      details: z.preprocess(
        (value) =>
          value === undefined
            ? []
            : typeof value === 'string'
              ? [value]
              : value,
        z.array(z.string()),
      ),
    }),
    page: ExperienceEntryPage,
    read: () => storage.read(),
    prepare,
    guard: (envelope, url) =>
      guard(envelope) ??
      (!url.searchParams.get('jobId') ||
      !find(envelope, url.searchParams.get('jobId'))
        ? hub
        : undefined),
    select: (envelope, url) => {
      const job = find(envelope, url.searchParams.get('jobId'))!;
      return {
        ...values(job),
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
      const job = find(envelope, id);
      if (!job || typed.jobId !== id) return { ok: false, error: 'not-found' };
      const parsed = schema.safeParse({ ...job, details: typed.details });
      return parsed.success
        ? storage.writeEntry('experience', parsed.data)
        : { ok: false, error: 'validation' };
    },
    next: () => hub,
  });
  const routes = route({ index: get(hub), action: post(hub) });
  const controller = createController(routes, {
    actions: {
      index({ url, render }) {
        const stored = storage.clearDrafts('experience');
        if (!stored.ok)
          return render(
            <ExperienceSummaryPage
              url={url}
              values={{}}
              entries={[]}
              errors={{ _form: [SAVE_ERROR] }}
            />,
            { status: 500 },
          );
        const target = guardStep('experience-summary', stored.value.user);
        if (target) return redirect(target, 303);
        return render(
          <ExperienceSummaryPage
            url={url}
            values={{}}
            entries={stored.value.user.experience ?? []}
          />,
        );
      },
      async action({ url, request, render }) {
        const stored = storage.read();
        if (!stored.ok)
          return render(
            <ExperienceSummaryPage
              url={url}
              values={{}}
              entries={[]}
              errors={{ _form: [SAVE_ERROR] }}
            />,
            { status: 500 },
          );
        const target = guardStep('experience-summary', stored.value.user);
        if (target) return redirect(target, 303);
        const data = await request.formData();
        const id =
          data.get('deleteId') ??
          (data.get('intent') === 'delete' ? data.get('jobId') : null);
        if (typeof id === 'string') {
          if (!storage.deleteEntry('experience', id).ok)
            return render(
              <ExperienceSummaryPage
                url={url}
                values={{}}
                entries={stored.value.user.experience ?? []}
                errors={{ _form: [SAVE_ERROR] }}
              />,
              { status: 500 },
            );
          return redirect(hub, 303);
        }
        return redirect(validatedReturnUrl(url) ?? '/education-level', 303);
      },
    },
  });
  return [experience, entry, { routes, controller }];
}
