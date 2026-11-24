export function buildGreeting(name: string): string {
  const tidied = name.trim().replace(/\s+/g, ' ');
  return `Hello, ${tidied || 'there'}!`;
}
