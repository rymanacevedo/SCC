import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { get, post, route } from 'remix/routes';
import { FinishUpPage } from '../pages/finish-up.tsx';
import { guardStep, steps, validatedReturnUrl } from '../steps.ts';
import type { User, UserStorage } from '../user.ts';
import { SAVE_ERROR } from './controller.tsx';
import { startOverAction } from './start-over-action.ts';

export function completedSections(user: User) {
  return steps.flatMap((step) => {
    if (!step.section || user[step.section] === undefined) return [];
    let label: string = step.label;
    // Entry Sections are edited through their Hub page.
    switch (step.section) {
      case 'experience':
        if (step.id !== 'experience-summary') return [];
        label = 'Experience';
        break;
      case 'education':
        if (step.id !== 'education-summary') return [];
        label = 'Education';
        break;
    }
    return [
      {
        section: step.section,
        label,
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
              user={{}}
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
            user={stored.value.user}
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
              user={stored.ok ? stored.value.user : {}}
              errors={{ _form: [message] }}
            />,
            { status },
          );
        if (data.get('intent') === 'start-over') {
          const failure = startOverAction(data, storage);
          if (failure) return failed(failure.error, failure.status);
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
