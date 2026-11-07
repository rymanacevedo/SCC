import { expect } from 'bun:test';

/** A key-shaped URL path segment, assembled so no key sits in source. */
export const SENSITIVE_KEY_SEGMENT = [
  'sk',
  'live',
  'AbCdEfGhIjKlMnOpQrStUvWx',
].join('_');

/**
 * Every leak shape council review found in the report pipeline, as values
 * planted in the fixtures below. None of these strings may appear in any sink
 * output: a GitHub issue body, an issue title, a fingerprint or a Workers
 * Logs line.
 */
export const SENSITIVE_VALUES = [
  'jane.doe@example.com',
  '(555) 123-4567',
  '123-4567',
  'token=abc123',
  'abc123',
  '#fragment',
  'eyJhbGciOiJIUzI1NiJ9.secret',
  's3cr3t-api-key',
  'alice',
  'hunter2',
  'debug=true',
  'short-secret',
  'dXNlcjpwYXNz',
  'private-value',
  'private-fragment',
  'second-cookie',
  'Tr0ub4dor',
  'correcthorse',
  'quoted-secret-words',
  'correct-horse',
  '765-4321',
  '5557654321',
  'json-one',
  'json-two',
  'json-three',
  'ref=',
  '1111111111',
  '555-987-6543',
  '!@#$%^&*()',
  'correcthorsebattery',
  'tokenvalueabc',
  'XkfQpLmZr9Ab',
  'abc123def',
  'accesstokenvalue',
  'clientsecretvalue',
  'configpasswordvalue',
  '?!?!!',
  'headersecretvalue',
  'lowercompoundvalue',
  'uppercompoundvalue',
  'joinedschemevalue',
  'dashjoinedvalue',
  'underscorejoinedvalue',
  'dotjoinedvalue',
  'pluralvalue',
  '765 - 4321',
  SENSITIVE_KEY_SEGMENT,
] as const;

/** A page URL with userinfo, a query and a fragment. */
export const SENSITIVE_URL =
  'https://alice:hunter2@scc.example/summary?token=abc123#fragment';

/** A URL with parens in its path, a query and a fragment, in free text. */
export const SENSITIVE_PAREN_URL =
  'https://scc.example/a(b)?q=(private-value)#private-fragment';

/** A page URL whose path holds the key wrapped, behind a sigil and suffixed. */
export const SENSITIVE_KEY_URL = `https://scc.example/k/(${SENSITIVE_KEY_SEGMENT})/@${SENSITIVE_KEY_SEGMENT}/${SENSITIVE_KEY_SEGMENT}.js`;

/**
 * A stack whose header message ends like a Firefox frame location, so it
 * must be read as a header before it is tried as a frame.
 */
export const SENSITIVE_AT_HEADER_STACK =
  'Error: failed for jane.doe@example.com:1:2\n    at save (https://scc.example/a.js:1:2)';

/** A URL with userinfo and a query, embedded in free text. */
export const SENSITIVE_EMBEDDED_URL =
  'https://alice:hunter2@localhost/api?debug=true';

/** Compact JSON: three URLs in one whitespace-free run. */
export const SENSITIVE_COMPACT_JSON =
  '{"a":"https://x.example/a?q=json-one","b":"https://y.example/b?q=json-two","c":"https://z.example/c?q=json-three"}';

/** An ISO timestamp Zod accepts, with 70,000 fractional digits. */
export const SENSITIVE_TIMESTAMP = `2026-10-13T00:00:00.${'1'.repeat(70_000)}Z`;

export const SENSITIVE_MESSAGE =
  'Save failed for jane.doe@example.com, call (555) 123-4567';

export const SENSITIVE_STACK = [
  'TypeError: Save failed',
  '    at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
  `    at fetchWithAuth (https://scc.example/assets/api-1a2b3c4d.js:5:6) GET ${SENSITIVE_EMBEDDED_URL} Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret apiKey=s3cr3t-api-key`,
  '    request headers: authorization=bearer short-secret',
  '    proxy: Authorization: basic dXNlcjpwYXNz',
  '    Cookie: theme=dark; sid=private-value; b=second-cookie',
  '    at retry (https://scc.example/assets/api-1a2b3c4d.js:9:9)',
  '    at loadPage (https://scc.example/assets/page.js?q=(private-value)&other=(x):3:4)',
  `    GET ${SENSITIVE_PAREN_URL} for phone:555-765-4321 and tel:+15557654321`,
  `    body ${SENSITIVE_COMPACT_JSON}`,
  '    at fn (https://alice:hunter2@scc.example/a(b).js?token=abc123#fragment:7:8)',
  '    at dial (https://scc.example/call/555-987-6543/a.js:9:9)',
  '    at token abc123def 5551234567 (https://scc.example/reset/XkfQpLmZr9Ab/a.js:1:2)',
  `    at keyed (https://scc.example/k/${SENSITIVE_KEY_SEGMENT}/a.js:1:2)`,
  // A frame-shaped line holding the key as a function name, a dotted part
  // and an alias, with wrapped, sigil and suffixed path segments.
  `    at ${SENSITIVE_KEY_SEGMENT} (https://scc.example/k/(${SENSITIVE_KEY_SEGMENT})/a.js:1:2)`,
  `    at Object.${SENSITIVE_KEY_SEGMENT} (https://scc.example/k/@${SENSITIVE_KEY_SEGMENT}/a.js:3:4)`,
  `    at run [as ${SENSITIVE_KEY_SEGMENT}] (https://scc.example/k/${SENSITIVE_KEY_SEGMENT}.js:5:6)`,
].join('\n');

export const SENSITIVE_DESCRIPTION = [
  'I typed jane.doe@example.com and (555) 123-4567, then it broke.',
  `It called ${SENSITIVE_EMBEDDED_URL} with my apiKey=s3cr3t-api-key.`,
  'My Password Tr0ub4dor&3 stopped working, so I tried Password correcthorse',
  `and password="${'word '.repeat(150)}quoted-secret-words" and passphrase=correct-horse.`,
  `See ${SENSITIVE_PAREN_URL} or www.scc.example/x?ref=abc123 or call phone:5557654321.`,
  `The page sent ${SENSITIVE_COMPACT_JSON}`,
  'Authorization: bearer short-secret',
  'Cookie: theme=dark; sid=private-value; b=second-cookie',
  'Then password: !@#$%^&*() and https://scc.example/call/555-987-6543 failed too.',
  'Later password= correcthorsebattery and token:= tokenvalueabc and https://scc.example/reset/XkfQpLmZr9Ab broke.',
  'Also accessToken accesstokenvalue, clientSecret clientsecretvalue, config.password configpasswordvalue and GET https://scc.example/x?token=?!?!! next.',
  'Run-together accesstoken: lowercompoundvalue and ACCESSTOKEN uppercompoundvalue, Authorization=Bearer joinedschemevalue,',
  'joined password-dashjoinedvalue password_underscorejoinedvalue password.dotjoinedvalue, credentials: pluralvalue, call 555 - 765 - 4321.',
].join('\n');

export function expectNoSensitiveValues(output: string) {
  for (const value of SENSITIVE_VALUES) expect(output).not.toContain(value);
}
