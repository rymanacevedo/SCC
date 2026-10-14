import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { get, post, route } from 'remix/routes';
import { FinishUpPage } from '../pages/finish-up.tsx';
import { guardStep, steps, validatedReturnUrl } from '../steps.ts';
import type { User, UserStorage } from '../user.ts';
import { SAVE_ERROR } from './controller.tsx';

export function completedSections(user: User) {
  return steps.flatMap((step) => {
    if (!step.section || user[step.section] === undefined) return [];
    // Entry Sections are edited through their Hub page.
    if (step.section === 'experience' && step.id !== 'experience-summary')
      return [];
    if (step.section === 'education' && step.id !== 'education-summary')
      return [];
    return [
      {
        section: step.section,
        label:
          step.section === 'experience'
            ? 'Experience'
            : step.section === 'education'
              ? 'Education'
              : step.label,
        path: step.path,
      },
    ];
  });
}
export function createFinishUpController(storage: UserStorage) {
  const routes = route({
    index: get('/finish-up'),
    action: post('/finish-up'),
  });
  const controller = createController(routes, {
    actions: {
      async index({ url, render }) {
        const stored = storage.read();
        if (!stored.ok)
          return render(
            <FinishUpPage
              url={url}
              values={{}}
              completed={[]}
              errors={{ _form: [SAVE_ERROR] }}
            />,
            { status: 500 },
          );
        const target = guardStep('finish-up', stored.value.user);
        if (target) return redirect(target, 303);
        return render(
          <FinishUpPage
            url={url}
            values={{}}
            completed={completedSections(stored.value.user)}
          />,
        );
      },
      async action({ request, url, render }) {
        const data = await request.formData();
        const stored = storage.read();
        const failed = (message: string, status: number) =>
          render(
            <FinishUpPage
              url={url}
              values={{}}
              completed={stored.ok ? completedSections(stored.value.user) : []}
              errors={{ _form: [message] }}
            />,
            { status },
          );
        if (data.get('intent') === 'start-over') {
          if (data.get('confirm') !== 'yes')
            return failed(
              'Confirm Start over before discarding your answers.',
              400,
            );
          if (!storage.startOver().ok) return failed(SAVE_ERROR, 500);
          return redirect('/', 303);
        }
        if (!stored.ok) return failed(SAVE_ERROR, 500);
        const target = guardStep('finish-up', stored.value.user);
        return redirect(target ?? validatedReturnUrl(url) ?? '/resume', 303);
      },
    },
  });
  return { routes, controller };
}
