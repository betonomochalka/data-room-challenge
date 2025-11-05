import { useDebounce as useDebouncePackage } from 'use-debounce';

/**
 * Hook to debounce a value
 * Wrapper around use-debounce that matches the original API
 * Returns just the debounced value (not the array)
 */
export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue] = useDebouncePackage(value, delay);
  return debouncedValue;
};

