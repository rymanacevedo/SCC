import {
  type ClientActionFunction,
  type ClientActionFunctionArgs,
  data,
} from 'react-router';
import { z } from 'zod';
import {
  userIssueReportSchema as reportIssueSchema,
  type UserIssueReportPayload,
} from '../../../../shared/errorReporting';
import type { FormErrors } from '../../components/Input';
import { VITE_HONO_BACKEND_URL } from '../../lib/environment';

export { reportIssueSchema };

export const clientAction: ClientActionFunction = async ({
  request,
}: ClientActionFunctionArgs) => {
  let payload: UserIssueReportPayload;

  try {
    const formData = await request.formData();
    payload = reportIssueSchema.parse({
      description: formData.get('description'),
      timestamp: formData.get('timestamp'),
      url: formData.get('url'),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data(
        { errors: error.flatten().fieldErrors as FormErrors },
        { status: 400 },
      );
    }

    return data({ error: 'Invalid request payload.' }, { status: 400 });
  }

  let response: Response;

  try {
    response = await fetch(`${VITE_HONO_BACKEND_URL}/api/report-issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return data({ error: 'Failed to submit issue report.' }, { status: 502 });
  }

  if (!response.ok) {
    return data({ error: 'Failed to submit issue report.' }, { status: 502 });
  }

  return Response.json({ ok: true });
};
