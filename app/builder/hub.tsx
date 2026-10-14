import type { Handle } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { get, post, route } from 'remix/routes';
import { guardStep, type StepId, steps, validatedReturnUrl } from '../steps.ts';
import type { Drafts, User, UserStorage } from '../user.ts';
import { SAVE_ERROR } from './controller.tsx';
import type { BuilderPageProps } from './layout.tsx';
export function createEntryHub<K extends keyof Drafts>(
  storage: UserStorage,
  section: K,
  step: StepId,
  idField: string,
  Page: (
    handle: Handle<BuilderPageProps & { entries: NonNullable<User[K]> }>,
  ) => () => RemixNode,
) {
  const index = steps.findIndex((value) => value.id === step);
  const path = steps[index]!.path;
  const routes = route({ index: get(path), action: post(path) });
  const controller = createController(routes, {
    actions: {
      index({ url, render }) {
        const stored = storage.clearDrafts(section);
        if (!stored.ok)
          return render(
            <Page
              url={url}
              values={{}}
              entries={[] as NonNullable<User[K]>}
              errors={{ _form: [SAVE_ERROR] }}
            />,
            { status: 500 },
          );
        const target = guardStep(step, stored.value.user);
        if (target) return redirect(target, 303);
        return render(
          <Page
            url={url}
            values={{}}
            entries={(stored.value.user[section] ?? []) as NonNullable<User[K]>}
          />,
        );
      },
      async action({ url, request, render }) {
        const stored = storage.read();
        const entries = (
          stored.ok ? (stored.value.user[section] ?? []) : []
        ) as NonNullable<User[K]>;
        const failed = () =>
          render(
            <Page
              url={url}
              values={{}}
              entries={entries}
              errors={{ _form: [SAVE_ERROR] }}
            />,
            { status: 500 },
          );
        if (!stored.ok) return failed();
        const target = guardStep(step, stored.value.user);
        if (target) return redirect(target, 303);
        const data = await request.formData();
        const id =
          data.get('deleteId') ??
          (data.get('intent') === 'delete' ? data.get(idField) : null);
        if (typeof id === 'string') {
          if (!storage.deleteEntry(section, id).ok) return failed();
          return redirect(path, 303);
        }
        return redirect(validatedReturnUrl(url) ?? steps[index + 1]!.path, 303);
      },
    },
  });
  return { routes, controller };
}
