import { z } from 'zod';
import {
  BaseEducationSchema,
  EducationLevelSchema,
} from '../../shared/schemas/education.ts';
import { normalizeEducationEntry } from '../education.ts';
import {
  EducationEntryPage,
  EducationLevelPage,
  EducationPage,
} from '../pages/education.tsx';
import { EducationSummaryPage } from '../pages/education-summary.tsx';
import { guardStep, validatedReturnUrl } from '../steps.ts';
import type { Envelope, UserStorage } from '../user.ts';
import { createBuilderController, SAVE_ERROR } from './controller.tsx';
import { checkbox, type FormValues } from './form.ts';
import { createEntryHub } from './hub.tsx';

export const EDUCATION_CAP_ERROR = 'You can add up to three schools.';
function findEducation(envelope: Envelope, url: URL) {
  const id = url.searchParams.get('educationId');
  if (!id || envelope.drafts.education?.educationId === id)
    return envelope.drafts.education;
  return envelope.user.education?.find((entry) => entry.educationId === id);
}
const valuesFor = (entry: object): FormValues =>
  Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [
      key,
      typeof value === 'boolean' ? String(value) : value,
    ]),
  ) as FormValues;
export function educationControllers(storage: UserStorage) {
  const guard = (envelope: Envelope, url: URL) => {
    const target = guardStep('education-level', envelope.user);
    if (target) return target;
    if (url.searchParams.has('educationId') && !findEducation(envelope, url))
      return '/education-summary';
  };
  const prepare = (url: URL) => {
    const stored = storage.read();
    const id = url.searchParams.get('educationId');
    if (
      !stored.ok ||
      !id ||
      guard(stored.value, url) ||
      stored.value.drafts.education?.educationId === id
    )
      return stored;
    return storage.seedDraft('education', id);
  };
  const pageProps = {
    saveDraft: (typed: FormValues) => {
      const stored = storage.read();
      if (!stored.ok) return SAVE_ERROR;
      const previous = stored.value.drafts.education;
      if (!previous?.educationId || typed.educationId !== previous.educationId)
        return SAVE_ERROR;
      const saved = storage.writeDraft('education', {
        ...previous,
        ...typed,
        currentlyEnrolled:
          'graduationDate' in typed
            ? typed.currentlyEnrolled === 'on' ||
              typed.currentlyEnrolled === 'true'
            : previous.currentlyEnrolled,
      });
      return saved.ok ? undefined : SAVE_ERROR;
    },
  };
  const next = (path: string, url: URL, id: string) => {
    const returnUrl = validatedReturnUrl(url);
    return `${path}?${new URLSearchParams({ educationId: id, ...(returnUrl ? { returnUrl } : {}) })}`;
  };
  const level = createBuilderController({
    route: 'education-level',
    schema: (envelope, url) =>
      z.object({ educationLevel: EducationLevelSchema }).transform((typed) => ({
        ...findEducation(envelope, url),
        ...typed,
        educationId:
          findEducation(envelope, url)?.educationId ?? crypto.randomUUID(),
      })),
    page: EducationLevelPage,
    read: storage.read,
    prepare,
    guard,
    select: (envelope, url) => valuesFor(findEducation(envelope, url) ?? {}),
    write: (typed) => storage.writeDraft('education', typed),
    next: (url, typed) => next('/education', url, typed.educationId),
  });
  const draftGuard = (envelope: Envelope, url: URL) =>
    guard(envelope, url) ??
    (!findEducation(envelope, url)?.educationLevel ||
    !findEducation(envelope, url)?.educationId
      ? '/education-level'
      : undefined);
  function capped<T extends z.ZodType>(
    schema: T,
    envelope: Envelope,
    url: URL,
  ) {
    const id = findEducation(envelope, url)?.educationId;
    return schema.superRefine((_value, ctx) => {
      if (
        (envelope.user.education?.length ?? 0) >= 3 &&
        !envelope.user.education?.some((entry) => entry.educationId === id)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['schoolName'],
          message: EDUCATION_CAP_ERROR,
        });
    });
  }
  const education = createBuilderController({
    route: 'education',
    schema: (envelope, url) =>
      capped(
        z
          .object({ schoolName: BaseEducationSchema.shape.schoolName })
          .transform((typed) => ({
            ...findEducation(envelope, url),
            ...typed,
            educationId: findEducation(envelope, url)!.educationId!,
          })),
        envelope,
        url,
      ),
    page: EducationPage,
    read: storage.read,
    prepare,
    guard: draftGuard,
    pageProps,
    select: (envelope, url) => valuesFor(findEducation(envelope, url)!),
    write: (typed) => storage.writeDraft('education', typed),
    next: (url, typed) => next('/education-entry', url, typed.educationId),
  });
  const entry = createBuilderController({
    route: 'education-entry',
    schema: (envelope, url) =>
      capped(
        z.preprocess(
          (typed) =>
            normalizeEducationEntry({
              ...findEducation(envelope, url),
              ...(typed as object),
              currentlyEnrolled:
                (typed as FormValues).currentlyEnrolled === 'on' ||
                (typed as FormValues).currentlyEnrolled === 'true',
            }),
          BaseEducationSchema.extend({
            currentlyEnrolled: checkbox(),
          }).superRefine((value, ctx) => {
            if (!value.degree.trim())
              ctx.addIssue({
                code: 'custom',
                path: ['degree'],
                message: 'Degree is required.',
              });
            if (
              value.educationLevel !== 'Certificate' &&
              !value.location.trim()
            )
              ctx.addIssue({
                code: 'custom',
                path: ['location'],
                message: 'Location is required.',
              });
          }),
        ),
        envelope,
        url,
      ),
    page: EducationEntryPage,
    read: storage.read,
    prepare,
    guard: (envelope, url) =>
      draftGuard(envelope, url) ??
      (!findEducation(envelope, url)?.schoolName
        ? next('/education', url, findEducation(envelope, url)!.educationId!)
        : undefined),
    pageProps,
    select: (envelope, url) => valuesFor(findEducation(envelope, url)!),
    write: (typed, url, envelope) =>
      storage.writeEntry('education', {
        ...typed,
        educationId: findEducation(envelope, url)!.educationId!,
      }),
    next: () => '/education-summary',
  });
  return [
    level,
    education,
    entry,
    createEntryHub(
      storage,
      'education',
      'education-summary',
      'educationId',
      EducationSummaryPage,
    ),
  ];
}
