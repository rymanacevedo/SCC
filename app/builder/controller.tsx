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
}: {
  route: StepId;
  schema: z.ZodType<T>;
  page: (handle: Handle<BuilderPageProps>) => () => RemixNode;
  read: () => Result<Envelope>;
  write: (value: T) => Result<unknown>;
  next: string;
  prepare?: () => Result<Envelope>;
}) {
  const step = steps.find((step) => step.id === route)!;
  const routes = defineRoute({
    index: get(step.path),
    action: post(step.path),
  });
  const controller = createController(routes, {
    actions: {
      index({ render, url }) {
        const stored = prepare ? prepare() : read();
        if (!stored.ok)
          return render(
            <Page url={url} values={{}} errors={{ _form: [SAVE_ERROR] }} />,
            { status: 500 },
          );
        const target = guardStep(route, stored.value.user, stored.value.drafts);
        if (target) return redirect(target, 303);
        const values = step.section
          ? stored.value.user[step.section]
          : undefined;
        return render(
          <Page
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
            <Page url={url} values={values} errors={{ _form: [SAVE_ERROR] }} />,
            { status: 500 },
          );
        const target = guardStep(route, stored.value.user, stored.value.drafts);
        if (target) return redirect(target, 303);
        const prompt = serializePrompt(stored.value.user);
        const parsed = schema.safeParse(values);
        if (!parsed.success)
          return render(
            <Page
              url={url}
              values={values}
              errors={fieldErrors(parsed.error)}
              prompt={prompt}
            />,
            { status: 400 },
          );
        const saved = write(parsed.data);
        if (!saved.ok)
          return render(
            <Page
              url={url}
              values={values}
              errors={{ _form: [SAVE_ERROR] }}
              prompt={prompt}
            />,
            { status: 500 },
          );
        return redirect(builderNav(route, url).returnUrl ?? next, 303);
      },
    },
  });
  return { routes, controller };
}
