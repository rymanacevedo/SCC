import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  // api resource routes
  route('/api/errors', 'routes/api/errors.tsx'),
  route('/api/report-issue', 'routes/api/report-issue.tsx'),
  route('/api/skills', 'routes/api/skills.tsx'),
  route('/api/experience', 'routes/api/experience.tsx'),
  route('/api/experienceEntry', 'routes/api/experienceEntry.tsx'),
  route('/api/summary', 'routes/api/summary.tsx'),
  // possible layout route here
  route('info', 'routes/builder/info.tsx'),
  route('experience', 'routes/builder/experience.tsx'),
  route('experience-entry', 'routes/builder/experienceEntry.tsx'),
  route('experience-summary', 'routes/builder/experienceSummary.tsx'),
  route('education-level', 'routes/builder/educationLevel.tsx'),
  route('education', 'routes/builder/education.tsx'),
  route('education-entry', 'routes/builder/educationEntry.tsx'),
  route('education-summary', 'routes/builder/educationSummary.tsx'),
  route('skills', 'routes/builder/skills.tsx'),
  route('summary', 'routes/builder/summary.tsx'),
  route('finish-up', 'routes/builder/finishup.tsx'),
  route('resume', 'routes/builder/resume.tsx'),
] satisfies RouteConfig;
