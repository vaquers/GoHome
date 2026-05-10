function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return '';
}

const DEFAULT_TIMEOUT_MS = 10_000;

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export async function requestJson<T = Json>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = baseUrl ? `${baseUrl}${path}` : path;

  const headers = new Headers(init?.headers ?? undefined);
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json');
  }

  if (init?.body != null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const externalSignal = init?.signal;

  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const text = await res.text();
    let data: T = null as T;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }
    }

    if (!res.ok) {
      const err = new Error(
        typeof data === 'object' && data && 'detail' in (data as any)
          ? String((data as any).detail)
          : `HTTP ${res.status}`,
      );
      (err as any).status = res.status;
      (err as any).data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function requestJsonWithApiFallback<T = Json>(
  endpoint: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const withApi = endpoint.startsWith('/api/') ? endpoint : `/api${endpoint}`;
  const withoutApi = endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint;

  try {
    return await requestJson<T>(withApi, init);
  } catch (e) {
    if ((e as any)?.name === 'AbortError') throw e;
    const status = (e as any)?.status;
    if (status !== 404) throw e;
    return await requestJson<T>(withoutApi, init);
  }
}

const responseCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000;

export async function cachedGet<T = Json>(
  endpoint: string,
  init?: RequestInit & { timeoutMs?: number; cacheTtl?: number },
): Promise<T> {
  const key = endpoint;
  const ttl = init?.cacheTtl ?? CACHE_TTL_MS;
  const cached = responseCache.get(key);

  if (cached && Date.now() - cached.ts < ttl) {
    return cached.data as T;
  }

  const data = await requestJsonWithApiFallback<T>(endpoint, init);
  responseCache.set(key, { data, ts: Date.now() });
  return data;
}
