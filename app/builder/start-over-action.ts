import type { UserStorage } from '../user.ts';
import { SAVE_ERROR } from './controller.tsx';

/** Shared confirmation and storage failure rules for Start over. */
export function startOverAction(
  data: FormData,
  storage: UserStorage,
): { error: string; status: number } | undefined {
  if (data.get('confirm') !== 'yes')
    return {
      error: 'Confirm Start over before discarding your answers.',
      status: 400,
    };
  if (!storage.startOver().ok) return { error: SAVE_ERROR, status: 500 };
}
