import { useState } from 'react';

export function useSessionStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      window.sessionStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    } catch (error) {
      console.error(
        `Error reading session storage key "${key}":${error}`,
        error,
      );
      return defaultValue;
    }
  });

  const setValue = (value: T) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      setStoredValue(value);
    } catch (error) {
      console.error(
        `Error writing session storage key "${key}":${error}`,
        error,
      );
    }
  };

  return [storedValue, setValue];
}
