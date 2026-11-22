export type FailureCode =
  | 'storage'
  | 'validation'
  | 'aborted'
  | 'network'
  | 'forbidden'
  | 'not-found'
  | 'method'
  | 'media-type'
  | 'server';
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: FailureCode; status?: number };
