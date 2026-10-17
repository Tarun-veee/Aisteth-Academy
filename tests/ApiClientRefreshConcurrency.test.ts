import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, setAccessToken, getAccessToken } from '../src/api/client';

describe('API Client 401 Interceptor & Refresh Concurrency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it('serializes multiple simultaneous 401 requests into exactly ONE refresh call', async () => {
    let refreshCallCount = 0;
    let resourceCallCount = 0;

    // Mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);

      if (urlStr.includes('/auth/refresh')) {
        refreshCallCount++;
        // Small delay to simulate in-flight network roundtrip
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, token: 'fresh_rotated_access_token_777' }),
        } as Response;
      }

      if (urlStr.includes('/test-resource')) {
        resourceCallCount++;
        const headers = init?.headers as Headers | undefined;
        const authHeader = headers?.get ? headers.get('Authorization') : (headers as any)?.Authorization;

        if (authHeader === 'Bearer fresh_rotated_access_token_777') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: 'resource_payload' }),
          } as Response;
        }

        // Return 401 for initial calls with stale/missing token
        return {
          ok: false,
          status: 401,
          json: async () => ({ success: false, error: 'Unauthorized' }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response;
    });

    try {
      setAccessToken('stale_expired_token');

      // Launch 3 simultaneous requests that all hit 401
      const p1 = apiFetch<{ success: boolean; data: string }>('/test-resource');
      const p2 = apiFetch<{ success: boolean; data: string }>('/test-resource');
      const p3 = apiFetch<{ success: boolean; data: string }>('/test-resource');

      const [res1, res2, res3] = await Promise.all([p1, p2, p3]);

      // Exactly ONE refresh call occurred
      expect(refreshCallCount).toBe(1);

      // All 3 requests received successful data
      expect(res1.data).toBe('resource_payload');
      expect(res2.data).toBe('resource_payload');
      expect(res3.data).toBe('resource_payload');

      // The in-memory access token was updated
      expect(getAccessToken()).toBe('fresh_rotated_access_token_777');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects all waiting requests and clears access token when refresh fails', async () => {
    let refreshCallCount = 0;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = String(input);

      if (urlStr.includes('/auth/refresh')) {
        refreshCallCount++;
        return {
          ok: false,
          status: 401,
          json: async () => ({ success: false, error: 'NO_REFRESH_COOKIE' }),
        } as Response;
      }

      // Initial resource request returns 401
      return {
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: 'Token expired' }),
      } as Response;
    });

    try {
      setAccessToken('expired_token');

      const p1 = apiFetch('/test-resource');
      const p2 = apiFetch('/test-resource');

      await expect(Promise.all([p1, p2])).rejects.toThrow();

      // Only 1 refresh attempt made
      expect(refreshCallCount).toBe(1);

      // In-memory token cleared
      expect(getAccessToken()).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
