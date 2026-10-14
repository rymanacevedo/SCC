/** Joins class lists, dropping empty parts. */
export function classes(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
