import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const originalCrypto = globalThis.crypto;

function createSessionStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function setCrypto(value: Crypto | undefined) {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
  });
}

afterEach(() => {
  mock.restore();
  setCrypto(originalCrypto);
});

beforeEach(() => {
  const sessionStorage = createSessionStorageMock();
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorage,
    configurable: true,
  });

  mock.module('./components/AppShell', () => ({
    AppShell: ({ children }: { children: unknown }) => children,
  }));
  mock.module('./components/ErrorBoundaryContent', () => ({
    ErrorBoundaryContent: () => null,
    ErrorBoundary: () => null,
    RouteErrorBoundary: () => null,
  }));
  mock.module('../../components/ErrorBoundaryContent', () => ({
    ErrorBoundaryContent: () => null,
    ErrorBoundary: () => null,
    RouteErrorBoundary: () => null,
  }));
  mock.module('../components/ErrorBoundaryContent', () => ({
    ErrorBoundaryContent: () => null,
    ErrorBoundary: () => null,
    RouteErrorBoundary: () => null,
  }));
});

describe('root clientLoader', () => {
  test('bootstraps a user when randomUUID is unavailable', async () => {
    setCrypto(undefined);

    const { clientLoader } = await import('./root');

    await expect(clientLoader()).resolves.toBeUndefined();

    const user = JSON.parse(String(window.sessionStorage.getItem('user')));
    expect(user.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
