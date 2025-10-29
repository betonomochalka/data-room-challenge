import { useState, useCallback } from 'react';

export const useDisclosure = <T = any>(initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);
  const [data, setData] = useState<T | undefined>(undefined);

  const open = useCallback((payload?: T) => {
    if (payload !== undefined) {
      setData(payload);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(undefined);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return { isOpen, open, close, toggle, data };
};
