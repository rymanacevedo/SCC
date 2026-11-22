export function lazy<T>(init: () => T): () => T {
  let state: { value: T } | undefined;
  return () => {
    state ??= { value: init() };
    return state.value;
  };
}
