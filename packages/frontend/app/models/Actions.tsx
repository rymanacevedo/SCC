import type { FormErrors } from '../components/Input';

export type ActionData = {
  errors?: FormErrors;
  type: 'DataWithResponseInit';
  init: Record<string, unknown>;
};
