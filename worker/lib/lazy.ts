/**
 * Defers `init` until first use and reuses its result afterwards. A throw is
 * not cached, so a failing init surfaces on every call, scoped to the route
 * that needed it, instead of failing Worker startup.
 */
export function lazy<T>(init: () => T): () => T {
  let state: { value: T } | undefined;
  return () => {
    state ??= { value: init() };
    return state.value;
  };
}
