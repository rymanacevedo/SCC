export function classes(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
