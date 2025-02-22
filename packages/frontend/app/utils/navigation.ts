export const addQueryParams = (
  baseUrl: string,
  params: Record<string, string | null>,
) => {
  const url = new URL(baseUrl, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.append(key, value);
  }
  return url.pathname + url.search;
};
