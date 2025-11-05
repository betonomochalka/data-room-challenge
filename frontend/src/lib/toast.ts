/**
 * Toast notification utility using react-hot-toast
 */
import toastLibrary from 'react-hot-toast';

// Create a wrapper that matches the original API
export const toast = {
  success: (message: string, options?: { duration?: number; id?: string }) => {
    return toastLibrary.success(message, {
      duration: options?.duration ?? 3000,
      id: options?.id,
    });
  },

  error: (message: string, options?: { duration?: number; id?: string }) => {
    return toastLibrary.error(message, {
      duration: options?.duration ?? 3000,
      id: options?.id,
    });
  },

  info: (message: string, options?: { duration?: number; id?: string }) => {
    return toastLibrary(message, {
      duration: options?.duration ?? 3000,
      id: options?.id,
    });
  },

  warning: (message: string, options?: { duration?: number; id?: string }) => {
    return toastLibrary(message, {
      duration: options?.duration ?? 3000,
      id: options?.id,
      icon: '⚠️',
    });
  },

  loading: (message: string, options?: { duration?: number; id?: string }) => {
    return toastLibrary.loading(message, {
      duration: options?.duration ?? Infinity,
      id: options?.id,
    });
  },

  dismiss: (id: string) => {
    toastLibrary.dismiss(id);
  },

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ): Promise<T> => {
    return toastLibrary.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  },
};

// Export the default toast library for advanced usage
export { default as toastLibrary } from 'react-hot-toast';

