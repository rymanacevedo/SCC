export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const lastKept = value.charCodeAt(maxLength - 1);
  const end =
    lastKept >= 0xd800 && lastKept <= 0xdbff ? maxLength - 1 : maxLength;
  return value.slice(0, Math.max(end, 0));
}
