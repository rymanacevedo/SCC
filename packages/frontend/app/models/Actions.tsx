import type { FormErrors } from '../components/Input';

export type ActionData = {
  data: {
    success?: boolean;
    errors: FormErrors;
  };
  type: 'DataWithResponseInit';
  init: Record<string, unknown>;
};
