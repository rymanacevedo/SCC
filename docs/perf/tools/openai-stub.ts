// Minimal OpenAI Responses API stub for perf runs. POST <anything>/responses -> fixed completion.
const summaries = await Bun.file(
  new URL('./summaries-fixture.json', import.meta.url),
).json();
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
const port = Number(process.env.PORT ?? 8788);
Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname.endsWith('/responses'))
      return Response.json(body);
    return new Response('not found', { status: 404 });
  },
});
console.log(`openai stub listening on http://127.0.0.1:${port}`);
