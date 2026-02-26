import { useCallback, useState } from 'react';

export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function usePhoneMask(initialRawValue?: string) {
  const [rawValue, setRawValue] = useState(() =>
    stripNonDigits(initialRawValue ?? ''),
  );

  const value = formatPhone(rawValue);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = stripNonDigits(e.target.value);
    setRawValue(digits);
  }, []);

  return { value, onChange, rawValue };
}
