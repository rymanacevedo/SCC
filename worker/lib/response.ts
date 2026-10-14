/** Zod 4 `flattenError` shape carried by every 400 Error envelope. */
export type Issues = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

export function apiError(
  status: number,
  error: string,
  issues?: Issues,
  headers?: HeadersInit,
) {
  return Response.json(
    {
      error,
      ...(status === 400
        ? { issues: issues ?? { formErrors: [], fieldErrors: {} } }
        : {}),
    },
    { status, headers },
  );
}
