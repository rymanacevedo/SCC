import type { Handle } from 'remix/component';
import type { Result } from '../../shared/result.ts';
export const SUGGESTIONS_UNAVAILABLE =
  'Suggestions are unavailable right now. You can still write your own answer.';
export function loadSuggestions<T, P>(
  handle: Handle<P>,
  load: (signal: AbortSignal) => Promise<Result<T>>,
) {
  let state: 'idle' | 'loading' | 'done' | 'error' = 'idle';
  let value: T | undefined;
  handle.queueTask(async () => {
    if (state !== 'idle' || handle.signal.aborted) return;
    state = 'loading';
    void handle.update();
    const result = await load(handle.signal);
    if (handle.signal.aborted) return;
    if (result.ok) {
      state = 'done';
      value = result.value;
    } else state = 'error';
    void handle.update();
  });
  return {
    get state() {
      return state;
    },
    get value() {
      return value;
    },
  };
}
