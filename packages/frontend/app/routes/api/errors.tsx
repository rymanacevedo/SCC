import { type ClientActionFunctionArgs, data } from 'react-router';
import { z } from 'zod';

const errorTelemetrySchema = z.object({
  timestamp: z.string().min(1),
  url: z.string().min(1),
  message: z.string().min(1),
  stackTrace: z.string(),
});

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const body = await request.json();

  const result = errorTelemetrySchema.safeParse(body);
  if (!result.success) {
    return data({ error: 'Invalid error telemetry payload.' }, { status: 400 });
  }

  try {
    const bckEndUrl = `${import.meta.env.VITE_HONO_BACKEND_URL}/api/errors`;
    const res = await fetch(bckEndUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.data),
    });

    if (!res.ok) {
      return data(
        { error: 'Failed to report error. Please try again.' },
        { status: 500 },
      );
    }

    return data({ success: true });
  } catch {
    return data(
      { error: 'Failed to report error. Please try again.' },
      { status: 500 },
    );
  }
}
