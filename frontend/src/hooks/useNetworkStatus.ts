/**
 * Network Status Hook
 *
 * Detects online/offline status and provides reconnection utilities.
 * Useful for showing offline indicators and handling network errors gracefully.
 */

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  lastOnline: Date | null;
  lastOffline: Date | null;
}

interface UseNetworkStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
}

export function useNetworkStatus(options?: UseNetworkStatusOptions): NetworkStatus & {
  retry: <T>(fn: () => Promise<T>, maxRetries?: number) => Promise<T>;
} {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    lastOnline: null,
    lastOffline: null,
  }));

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: true,
        isOffline: false,
        lastOnline: new Date(),
      }));
      options?.onOnline?.();
    };

    const handleOffline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isOffline: true,
        lastOffline: new Date(),
      }));
      options?.onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [options]);

  /**
   * Retry a function with exponential backoff
   */
  const retry = useCallback(async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (!navigator.onLine) {
        throw new Error('Network is offline. Please check your connection.');
      }

      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (isNonRetryableError(error)) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed after maximum retries');
  }, []);

  return {
    ...status,
    retry,
  };
}

/**
 * Determine if an error should not be retried
 */
function isNonRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Don't retry on 4xx client errors (except 429 rate limiting)
    const message = error.message.toLowerCase();
    if (message.includes('401') || message.includes('403') || message.includes('404')) {
      return true;
    }
  }
  return false;
}

export default useNetworkStatus;
