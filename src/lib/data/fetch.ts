type TimedFetchInit = RequestInit & {
  next?: {
    revalidate?: number | false;
  };
};

export async function fetchWithTimeout(
  input: string | URL,
  init: TimedFetchInit = {},
  timeoutMs = 8000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
