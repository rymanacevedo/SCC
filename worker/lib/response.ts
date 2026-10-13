export function apiError(
  status: number,
  error: string,
  issues?: unknown,
  headers?: HeadersInit,
) {
  return Response.json(
    { error, ...(status === 400 ? { issues: issues ?? [] } : {}) },
    { status, headers },
  );
}
