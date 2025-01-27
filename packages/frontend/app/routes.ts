import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('info', 'routes/personalinfo.tsx'),
] satisfies RouteConfig;
