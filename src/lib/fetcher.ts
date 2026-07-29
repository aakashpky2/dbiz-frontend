
const cache = new Map<string, { data: any; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchWithCache(url: string, options: RequestInit = {}) {
  const cacheKey = url;
  const now = Date.now();

  if (options.method === 'GET' || !options.method) {
    const cached = cache.get(cacheKey);
    if (cached && now - cached.timestamp < TTL) {
      return cached.data;
    }
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    let errorMsg = `Fetch failed: ${response.status} ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData && (errData.error || errData.message)) {
        errorMsg = errData.error || errData.message;
      }
    } catch (_) {
      try {
        const text = await response.text();
        if (text) {
          errorMsg = `${errorMsg} - ${text.substring(0, 100)}`;
        }
      } catch (__) {}
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();

  if (options.method === 'GET' || !options.method) {
    cache.set(cacheKey, { data, timestamp: now });
  }

  return data;
}

export function clearCache(url?: string) {
  if (url) {
    cache.delete(url);
  } else {
    cache.clear();
  }
}
