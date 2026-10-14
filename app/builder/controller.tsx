import type { Handle } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { route as defineRoute, get, post } from 'remix/routes';
import type { z } from 'zod';
import { fieldErrors } from '../../shared/fieldErrors.ts';
import type { Result } from '../../shared/result.ts';
import { builderNav, guardStep, type StepId, steps } from '../steps.ts';
import { type Envelope, serializePrompt } from '../user.ts';
import { type FormValues, formValues } from './form.ts';
import type { BuilderPageProps } from './layout.tsx';
export const SAVE_ERROR =
  'Your answers could not be saved. Please try again. You can copy your text before leaving this page.';
export function createBuilderController<T>({
  route,
  schema,
  page: Page,
  read,
  write,
  next,
  prepare,
  select,
  guard,
  pageProps,
}: {
  route: StepId;
  schema: z.ZodType<T>;
  page: (handle: Handle<BuilderPageProps>) => () => RemixNode;
  read: () => Result<Envelope>;
  write: (value: T, url: URL, envelope: Envelope) => Result<unknown>;
  next: string | ((url: URL, value: T) => string);
  prepare?: (url: URL) => Result<Envelope>;
  select?: (envelope: Envelope, url: URL) => FormValues | string;
  guard?: (envelope: Envelope, url: URL) => string | undefined;
  pageProps?: Partial<BuilderPageProps>;
}) {
  const step = steps.find((step) => step.id === route)!;
  const routes = defineRoute({
    index: get(step.path),
    action: post(step.path),
  });
  function guardEnvelope(envelope: Envelope, url: URL) {
    if (guard) return guard(envelope, url);
    return guardStep(route, envelope.user, envelope.drafts);
  }
  function selectValues(envelope: Envelope, url: URL) {
    if (select) return select(envelope, url);
    if (step.section) return envelope.user[step.section];
    return undefined;
  }
  const controller = createController(routes, {
    actions: {
      index({ render, url }) {
        const stored = prepare ? prepare(url) : read();
        if (!stored.ok)
          return render(
            <Page
              {...pageProps}
              url={url}
              values={{}}
              errors={{ _form: [SAVE_ERROR] }}
            />,
            { status: 500 },
          );
        const target = guardEnvelope(stored.value, url);
        if (target) return redirect(target, 303);
        const values = selectValues(stored.value, url);
        if (typeof values === 'string') return redirect(values, 303);
        return render(
          <Page
            {...pageProps}
            url={url}
            values={(values ?? {}) as FormValues}
            prompt={serializePrompt(stored.value.user)}
          />,
        );
      },
      async action({ request, render, url }) {
        const stored = read();
        const values = formValues(await request.formData());
        if (!stored.ok)
          return render(
            <Page
              {...pageProps}
              url={url}
              values={values}
              errors={{ _form: [SAVE_ERROR] }}
            />,
            { status: 500 },
          );
        const target = guardEnvelope(stored.value, url);
        if (target) return redirect(target, 303);
        const prompt = serializePrompt(stored.value.user);
        const parsed = schema.safeParse(values);
        if (!parsed.success)
          return render(
            <Page
              {...pageProps}
              url={url}
              values={values}
              errors={fieldErrors(parsed.error)}
              prompt={prompt}
            />,
            { status: 400 },
          );
        const saved = write(parsed.data, url, stored.value);
        if (!saved.ok)
          return render(
            <Page
              {...pageProps}
              url={url}
              values={values}
              errors={{ _form: [SAVE_ERROR] }}
              prompt={prompt}
            />,
            { status: 500 },
          );
        return redirect(
          typeof next === 'function'
            ? next(url, parsed.data)
            : (builderNav(route, url).returnUrl ?? next),
          303,
        );
      },
    },
  });
  return { routes, controller };
}
