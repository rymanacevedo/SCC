import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('/api/skills', 'routes/api/skills.tsx'),
  // possible layout route here
  route('info', 'routes/builder/personalinfo.tsx'),
  route('experience', 'routes/builder/experience.tsx'),
  route('education', 'routes/builder/education.tsx'),
  route('skills', 'routes/builder/skills.tsx'),
  route('summary', 'routes/builder/summary.tsx'),
  route('finish-up', 'routes/builder/finishup.tsx'),
] satisfies RouteConfig;
