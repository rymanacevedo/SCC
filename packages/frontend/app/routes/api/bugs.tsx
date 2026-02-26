import { type ClientActionFunctionArgs, data } from 'react-router';
import { z } from 'zod';

const bugReportSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  url: z.string().url(),
});

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  const fields = Object.fromEntries(formData.entries());

  const result = bugReportSchema.safeParse(fields);
  if (!result.success) {
    return data(
      { error: 'Please provide a description of the issue.' },
      { status: 400 },
    );
  }

  try {
    const bckEndUrl = `${import.meta.env.VITE_HONO_BACKEND_URL}/api/bugs`;
    const res = await fetch(bckEndUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.data),
    });

    if (!res.ok) {
      return data(
        { error: 'Failed to submit report. Please try again.' },
        { status: 500 },
      );
    }

    return data({ success: true });
  } catch {
    return data(
      { error: 'Failed to submit report. Please try again.' },
      { status: 500 },
    );
  }
}
