import axios from 'axios';

interface RetryOptions {
  retries?: number;
  delayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;

  if (!error.response) {
    return true;
  }

  const status = error.response.status;
  return status >= 500 || status === 429;
};

export const requestWithRetry = async <T>(
  requestFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 400;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) {
        throw error;
      }

      await sleep(delayMs * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError;
};
