import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { z } from 'zod';
import {
  type ErrorTelemetryPayload,
  errorTelemetrySchema,
} from '../../../../shared/errorReporting';
import { VITE_HONO_BACKEND_URL } from '../../lib/environment';

export { errorTelemetrySchema };

export async function action({ request }: ActionFunctionArgs) {
  let payload: ErrorTelemetryPayload;

  try {
    payload = errorTelemetrySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data({ errors: error.flatten() }, { status: 400 });
    }

    return data({ error: 'Invalid request payload.' }, { status: 400 });
  }

  let response: Response;

  try {
    response = await fetch(`${VITE_HONO_BACKEND_URL}/api/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return data(
      { error: 'Failed to forward error telemetry.' },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return data(
      { error: 'Failed to forward error telemetry.' },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
