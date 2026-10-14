import { expect, test } from 'bun:test';
import {
  builderRequest,
  info,
  summary,
  summaryUser,
} from '../test/builder-fixtures.ts';
import { createSessionStorageMock } from '../test/storage.ts';
import { createAppRouter } from './router.tsx';
import { createUserStorage, STORAGE_KEY } from './user.ts';

function setup() {
  const mock = createSessionStorageMock();
  const storage = createUserStorage(
    () => mock,
    () => {},
  );
  return { mock, storage, router: createAppRouter(storage) };
}
test('GET renders Info and stored Summary; missing prerequisites redirect to earliest incomplete Step', async () => {
  const { storage, router } = setup();
  expect((await router.fetch(builderRequest('/info'))).status).toBe(200);
  let result = await router.fetch(builderRequest('/summary'));
  expect(result.status).toBe(303);
  expect(result.headers.get('Location')).toBe('/info');
  storage.write('info', info);
  result = await router.fetch(builderRequest('/summary'));
  expect(result.headers.get('Location')).toBe('/experience');
  for (const section of ['experience', 'education', 'skills'] as const)
    storage.write(section, summaryUser[section]!);
  storage.write('summary', { summary });
  expect((await router.fetch(builderRequest('/summary'))).status).toBe(200);
  expect(storage.read()).toMatchObject({
    ok: true,
    value: { user: { summary: { summary } } },
  });
});
test('invalid POST returns 400 without creating or modifying the envelope; valid Info redirects and persists', async () => {
  const { mock, router } = setup();
  expect(
    (await router.fetch(builderRequest('/info', { firstName: 'typed' })))
      .status,
  ).toBe(400);
  expect(mock.getItem(STORAGE_KEY)).toBeNull();
  const result = await router.fetch(builderRequest('/info', info));
  expect(result.status).toBe(303);
  expect(result.headers.get('Location')).toBe('/experience');
  expect(JSON.parse(mock.getItem(STORAGE_KEY)!).user.info).toEqual(info);
});
test('Summary validates, saves, and continues through the shared controller', async () => {
  const { storage, mock, router } = setup();
  for (const section of ['info', 'experience', 'education', 'skills'] as const)
    storage.write(section, summaryUser[section]!);
  const before = mock.getItem(STORAGE_KEY);
  expect(
    (await router.fetch(builderRequest('/summary', { summary: 'too short' })))
      .status,
  ).toBe(400);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
  const result = await router.fetch(builderRequest('/summary', { summary }));
  expect(result.status).toBe(303);
  expect(result.headers.get('Location')).toBe('/finish-up');
  expect(storage.read()).toMatchObject({
    value: { user: { summary: { summary } } },
  });
});
for (const [returnUrl, target] of [
  ['/finish-up?edit=1', '/finish-up?edit=1'],
  ['//evil.example', '/experience'],
  ['https://scc.example/resume', '/experience'],
  ['/\\evil.example', '/experience'],
]) {
  test(`POST validates Revisit destination ${returnUrl}`, async () => {
    const { router } = setup();
    const response = await router.fetch(
      builderRequest(`/info?returnUrl=${encodeURIComponent(returnUrl)}`, info),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(target);
  });
}
test('quota failure returns 500 and preserves stored User', async () => {
  const { mock, storage, router } = setup();
  storage.write('info', info);
  const before = mock.getItem(STORAGE_KEY);
  mock.setItem = () => {
    throw new Error('quota');
  };
  const response = await router.fetch(
    builderRequest('/info', { ...info, firstName: 'Changed' }),
  );
  expect(response.status).toBe(500);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
});

test('invalid Info POST keeps Drafts; landing on Info clears them', async () => {
  const { mock, storage, router } = setup();
  storage.writeDraft('experience', { jobTitle: 'Typed job' });
  storage.writeDraft('education', { schoolName: 'Typed school' });
  const before = mock.getItem(STORAGE_KEY);
  expect(
    (await router.fetch(builderRequest('/info', { firstName: 'Typed' })))
      .status,
  ).toBe(400);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
  expect((await router.fetch(builderRequest('/info'))).status).toBe(200);
  expect(storage.read()).toMatchObject({ value: { drafts: {} } });
});

test('unknown paths and thrown 404 Responses return 404 without reporting', async () => {
  const { router } = setup();
  router.get('/missing-response', () => {
    throw new Response(null, { status: 404 });
  });
  const original = globalThis.fetch;
  let reports = 0;
  globalThis.fetch = (async () => {
    reports++;
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
  try {
    expect((await router.fetch(builderRequest('/unknown'))).status).toBe(404);
    expect(
      (await router.fetch(builderRequest('/missing-response'))).status,
    ).toBe(404);
    expect(reports).toBe(0);
  } finally {
    globalThis.fetch = original;
  }
});

test('router errors return 500 and auto-report once without waiting for reporting', async () => {
  const { router } = setup();
  const error = Object.assign(new Error('Controller failed'), { user: info });
  router.get('/throw', () => {
    throw error;
  });
  const original = globalThis.fetch;
  const reports: unknown[] = [];
  globalThis.fetch = (async (_path: RequestInfo | URL, init?: RequestInit) => {
    reports.push(JSON.parse(String(init?.body)));
    return new Promise<Response>(() => {});
  }) as unknown as typeof fetch;
  try {
    expect((await router.fetch(builderRequest('/throw'))).status).toBe(500);
    expect((await router.fetch(builderRequest('/throw'))).status).toBe(500);
    expect(reports).toEqual([
      {
        url: 'https://scc.example/throw',
        message: error.message,
        timestamp: expect.any(String),
        stackTrace: error.stack,
      },
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
