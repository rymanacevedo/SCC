import { afterEach, describe, expect, mock, test } from 'bun:test';
import { generateId } from './id';

const originalCrypto = globalThis.crypto;
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setCrypto(value: Crypto | undefined) {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
  });
}

afterEach(() => {
  setCrypto(originalCrypto);
});

describe('generateId', () => {
  test('uses native randomUUID when it is available', () => {
    const randomUUID = mock(() => 'native-uuid');
    setCrypto({ randomUUID } as unknown as Crypto);

    expect(generateId()).toBe('native-uuid');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  test('returns a UUID v4-shaped id using getRandomValues fallback', () => {
    setCrypto({
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set([
          0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa,
          0xbb, 0xcc, 0xdd, 0xee, 0xff,
        ]);
        return bytes;
      },
    } as unknown as Crypto);

    expect(generateId()).toBe('00112233-4455-4677-8899-aabbccddeeff');
    expect(generateId()).toMatch(uuidV4Pattern);
  });

  test('returns a UUID v4-shaped id when crypto is unavailable', () => {
    setCrypto(undefined);

    expect(generateId()).toMatch(uuidV4Pattern);
  });
});
