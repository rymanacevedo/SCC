import type { z } from 'zod';

// Reusable sandboxes return stdout; structured output is exposed only by run().
export function readTaggedOutput<T>(
  stdout: string,
  tag: 'plan' | 'pull-request',
  schema: z.ZodType<T>,
): T {
  const matches = [
    ...stdout.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g')),
  ];
  const last = matches.at(-1);
  if (!last) throw new Error(`Agent did not emit <${tag}> output.`);
  return schema.parse(JSON.parse(last[1]));
}
