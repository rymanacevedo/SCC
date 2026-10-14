import type { Handle } from 'remix/component';
import type { FailureCode, Result } from '../../shared/result.ts';

/** Why a Builder page could not offer Suggestions; see the Suggestion failure glossary entry. */
export type SuggestionFailure = 'region' | 'offline' | 'generator';

const WRITE_YOUR_OWN = 'You can still write your own answer.';
export const SUGGESTION_FAILURE_MESSAGES: Record<SuggestionFailure, string> = {
  region: `Suggestions aren't available in your region. ${WRITE_YOUR_OWN}`,
  offline: `Suggestions couldn't load. Check your internet connection and try again. ${WRITE_YOUR_OWN}`,
  generator: `Suggestions couldn't be generated right now. Please try again. ${WRITE_YOUR_OWN}`,
};

export function suggestionFailure(code: FailureCode): SuggestionFailure {
  if (code === 'forbidden') return 'region';
  if (code === 'network') return 'offline';
  return 'generator';
}

/** Only the region rules out retrying. */
export const canRetrySuggestions = (failure: SuggestionFailure) =>
  failure !== 'region';

export function loadSuggestions<T, P>(
  handle: Handle<P>,
  load: (signal: AbortSignal) => Promise<Result<T>>,
) {
  let state: 'idle' | 'loading' | 'done' | 'error' = 'idle';
  let value: T | undefined;
  let failure: SuggestionFailure | undefined;
  async function start() {
    state = 'loading';
    failure = undefined;
    void handle.update();
    const result = await load(handle.signal);
    if (handle.signal.aborted) return;
    if (result.ok) {
      state = 'done';
      value = result.value;
    } else {
      state = 'error';
      failure = suggestionFailure(result.error);
    }
    void handle.update();
  }
  handle.queueTask(async () => {
    if (state !== 'idle' || handle.signal.aborted) return;
    await start();
  });
  return {
    get state() {
      return state;
    },
    get value() {
      return value;
    },
    get failure() {
      return failure;
    },
    /** Loads again after a retryable Suggestion failure; otherwise does nothing. */
    retry() {
      if (state !== 'error' || !failure || !canRetrySuggestions(failure))
        return;
      if (handle.signal.aborted) return;
      void start();
    },
  };
}

export type Suggestions<T> = ReturnType<typeof loadSuggestions<T, unknown>>;
