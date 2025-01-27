export const STEPS = [
  { id: 'personal', label: 'Personal Info' },
  { id: 'experience', label: 'Work Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'preview', label: 'Preview' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
