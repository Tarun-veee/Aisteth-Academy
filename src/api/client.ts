/**
 * AiSteth Academy — API Client Transport
 * Specification: Layered Architecture with In-Memory Access Token & HttpOnly Refresh Cookie
 */

const isBrowser = typeof window !== 'undefined';
const DEFAULT_BASE = isBrowser ? '/api/v1' : 'http://localhost:3000/api/v1';
const BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || DEFAULT_BASE;

let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

function onTokenRefreshed(token: string | null): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function subscribeTokenRefresh(cb: (token: string | null) => void): void {
  refreshSubscribers.push(cb);
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  if (inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Automatically sends HttpOnly cookies (e.g. refreshToken)
  });

  if (response.status === 401 && retryOn401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setAccessToken(refreshData.token);
          isRefreshing = false;
          onTokenRefreshed(refreshData.token);

          // Retry original request with new token
          headers.set('Authorization', `Bearer ${refreshData.token}`);
          const retryRes = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          });
          const retryData = await retryRes.json();
          if (!retryRes.ok) {
            throw new Error(retryData?.error || 'Request failed after refresh');
          }
          return retryData as T;
        } else {
          setAccessToken(null);
          isRefreshing = false;
          onTokenRefreshed(null);
        }
      } catch (e) {
        setAccessToken(null);
        isRefreshing = false;
        onTokenRefreshed(null);
      }
    } else {
      // Queue request until active refresh completes
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh(async (newToken) => {
          if (!newToken) {
            reject(new Error('Session expired. Please log in again.'));
            return;
          }
          headers.set('Authorization', `Bearer ${newToken}`);
          try {
            const retryRes = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
            });
            const retryData = await retryRes.json();
            if (!retryRes.ok) {
              reject(new Error(retryData?.error || 'Request failed'));
              return;
            }
            resolve(retryData as T);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg) as any;
    err.status = response.status;
    err.code = data?.code;
    throw err;
  }

  return data as T;
}
