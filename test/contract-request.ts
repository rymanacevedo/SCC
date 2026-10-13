export function contractRequest(
  path: string,
  body: unknown = { prompt: '<job>Software Developer</job>' },
  { country = 'US', ...init }: RequestInit & { country?: string | null } = {},
) {
  const method = init.method ?? 'POST';
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  const request = new Request(`https://scc.example${path}`, {
    ...init,
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD'
      ? {}
      : { body: init.body ?? JSON.stringify(body) }),
  });
  if (country !== null)
    Object.defineProperty(request, 'cf', { value: { country } });
  return request;
}
