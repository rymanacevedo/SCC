import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { get, post, route } from 'remix/routes';
import { SAVE_ERROR } from '../builder/controller.tsx';
import { startOverAction } from '../builder/start-over-action.ts';
import { ResumePage } from '../pages/resume.tsx';
import type { UserStorage } from '../user.ts';
import { createOutline } from './outline.ts';

export function createResumeController(storage: UserStorage) {
  const routes = route({ index: get('/resume'), action: post('/resume') });
  const controller = createController(routes, {
    actions: {
      index({ render }) {
        const stored = storage.read();
        if (!stored.ok)
          return render(<ResumePage outline={[]} error={SAVE_ERROR} />, {
            status: 500,
          });
        if (!Object.keys(stored.value.user).length) return redirect('/', 303);
        return render(
          <ResumePage outline={createOutline(stored.value.user)} />,
        );
      },
      async action({ request, render }) {
        const data = await request.formData();
        const failure =
          data.get('intent') === 'start-over'
            ? startOverAction(data, storage)
            : { error: 'Choose an action on the Preview.', status: 400 };
        if (!failure) return redirect('/', 303);
        const stored = storage.read();
        return render(
          <ResumePage
            outline={stored.ok ? createOutline(stored.value.user) : []}
            error={failure.error}
          />,
          { status: failure.status },
        );
      },
    },
  });
  return { routes, controller };
}
