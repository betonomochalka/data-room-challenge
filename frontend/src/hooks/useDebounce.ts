import { useState, useEffect } from 'react';

/**
 * Hook to debounce a value
 * Delays updating the value until after the specified delay
 * Useful for search inputs to avoid excessive API calls
 */
export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

