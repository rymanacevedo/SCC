import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  // possible layout route here
  route('info', 'routes/builder/personalinfo.tsx'),
  route('experience', 'routes/builder/experience.tsx'),
] satisfies RouteConfig;
