import {
  createController,
  createRouter,
  type RouterContext,
} from 'remix/router';
import { get, route } from 'remix/routes';
import { render } from 'remix/spa';
import { PersonalInfoSchema } from '../shared/schemas/info.ts';
import { SummarySchema } from '../shared/schemas/summary.ts';
import { createBuilderController } from './builder/controller.tsx';
import { experienceControllers } from './builder/experience.tsx';
import { ComingSoon } from './pages/coming-soon.tsx';
import { HomePage } from './pages/home.tsx';
import { InfoPage } from './pages/info.tsx';
import { Shell } from './pages/shell.tsx';
import { SummaryPage } from './pages/summary.tsx';
import { type UserStorage, userStorage } from './user.ts';

export const builderPageIds = {
  info: 'info',
  summary: 'summary',
  experience: 'experience',
  entry: 'experience-entry',
  hub: 'experience-summary',
} as const;

// Importing this module constructs routes only; browser startup lives in main.
export function createAppRouter(storage: UserStorage = userStorage) {
  const router = createRouter({
    middleware: [render((content) => <Shell>{content}</Shell>)],
    defaultHandler({ render }) {
      return render(<ComingSoon />, { status: 404 });
    },
  });

  const routes = route({ home: get('/') });
  router.map(
    routes,
    createController(routes, {
      actions: {
        home({ render }) {
          return render(<HomePage />);
        },
      },
    }),
  );

  const info = createBuilderController({
    route: builderPageIds.info,
    schema: PersonalInfoSchema,
    page: InfoPage,
    read: () => storage.read(),
    prepare: () => storage.clearDrafts(),
    write: (value) => storage.write('info', value),
    next: '/experience',
  });
  const summary = createBuilderController({
    route: builderPageIds.summary,
    schema: SummarySchema,
    page: SummaryPage,
    read: () => storage.read(),
    write: (value) => storage.write('summary', value),
    next: '/finish-up',
  });
  for (const item of experienceControllers(storage))
    router.map(item.routes, item.controller);
  router.map(info.routes, info.controller);
  router.map(summary.routes, summary.controller);
  return router;
}
export const router = createAppRouter();
type AppContext = RouterContext<typeof router>;
declare module 'remix' {
  interface RouterTypes {
    context: AppContext;
  }
}
