// Local OpenAI Responses API stub shared by Flow tests and perf runs. POST <anything>/responses -> fixed completion.
import { summaries, summaryResponse } from './fixtures.ts';

export { summaryResponse };

const body = {
  id: 'resp_perf',
  object: 'response',
  created_at: 0,
  model: 'perf-stub',
  status: 'completed',
  output: [
    {
      type: 'message',
      role: 'assistant',
      id: 'msg_perf',
      status: 'completed',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({ summaries }),
          annotations: [],
        },
      ],
    },
  ],
  usage: { input_tokens: 1, output_tokens: 1 },
};
if (import.meta.main) {
  const port = Number(process.env.PORT ?? 8788);
  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/health') return new Response('ready');
      if (req.method === 'POST' && url.pathname.endsWith('/responses')) {
        const request = (await req.json()) as {
          text?: {
            format?: { schema?: { properties?: Record<string, unknown> } };
          };
        };
        const properties = request.text?.format?.schema?.properties ?? {};
        const value =
          'summaries' in properties
            ? { summaries }
            : { expertRecommended: ['TypeScript'], other: [] };
        const response = structuredClone(body);
        response.output[0]!.content[0]!.text = JSON.stringify(value);
        return Response.json(response);
      }
      return new Response('not found', { status: 404 });
    },
  });
  console.log(`openai stub listening on http://127.0.0.1:${port}`);
}
