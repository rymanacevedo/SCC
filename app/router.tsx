import {
  createController,
  createRouter,
  type RouterContext,
} from 'remix/router';
import { get, route } from 'remix/routes';
import { render } from 'remix/spa';
import { HomePage } from './pages/home.tsx';
import { ComingSoon, Shell } from './pages/shell.tsx';

// Importing this module constructs routes only; browser startup lives in main.
export const router = createRouter({
  middleware: [render((content) => <Shell>{content}</Shell>)],
  defaultHandler({ render }) {
    return render(<ComingSoon />);
  },
});
type AppContext = RouterContext<typeof router>;
declare module 'remix' {
  interface RouterTypes {
    context: AppContext;
  }
}

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
