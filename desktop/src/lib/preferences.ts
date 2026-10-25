import { useState, useEffect } from "react";
export function usePreference<T>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      const parsed = saved === null ? initial : JSON.parse(saved);
      return typeof parsed === typeof initial && parsed !== null
        ? parsed
        : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}
export function dateRange(value: string | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  return (
    (!from || value.slice(0, 10) >= from) && (!to || value.slice(0, 10) <= to)
  );
}
