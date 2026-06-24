const UUID_BYTE_LENGTH = 16;
const UUID_HEX: string[] = Array.from({ length: 256 }, (_, value) =>
  value.toString(16).padStart(2, '0'),
);

function fillRandomBytes(bytes: Uint8Array<ArrayBuffer>) {
  const crypto = globalThis.crypto;

  if (typeof crypto?.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
}

function formatUuidV4(bytes: Uint8Array<ArrayBuffer>) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    UUID_HEX[bytes[0]],
    UUID_HEX[bytes[1]],
    UUID_HEX[bytes[2]],
    UUID_HEX[bytes[3]],
    '-',
    UUID_HEX[bytes[4]],
    UUID_HEX[bytes[5]],
    '-',
    UUID_HEX[bytes[6]],
    UUID_HEX[bytes[7]],
    '-',
    UUID_HEX[bytes[8]],
    UUID_HEX[bytes[9]],
    '-',
    UUID_HEX[bytes[10]],
    UUID_HEX[bytes[11]],
    UUID_HEX[bytes[12]],
    UUID_HEX[bytes[13]],
    UUID_HEX[bytes[14]],
    UUID_HEX[bytes[15]],
  ].join('');
}

export function generateId(): string {
  const crypto = globalThis.crypto;

  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(UUID_BYTE_LENGTH);
  fillRandomBytes(bytes);
  return formatUuidV4(bytes);
}
