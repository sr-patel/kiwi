import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiRequest, HttpError, toUserMessage } from './apiClient';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('API client', () => {
  it('validates successful JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 4 }), { status: 200 })),
    );
    await expect(apiRequest('/api/count', { schema: z.object({ count: z.number() }) })).resolves.toEqual({
      count: 4,
    });
  });

  it('maps stable API errors to HttpError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid request', code: 'VALIDATION_ERROR' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const promise = apiRequest('/api/photos', { retries: 0 });
    await expect(promise).rejects.toMatchObject({ status: 400, message: 'Invalid request' });
    await promise.catch((error: unknown) => expect(toUserMessage(error)).toBe('Invalid request'));
  });

  it('does not retry unsafe writes', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/api/config', { method: 'PUT', body: '{}', retries: 2 })).rejects.toThrow(
      'network down',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries safe transient responses and supports binary parsers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'busy' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = apiRequest<ArrayBuffer>('/api/book', {
      retries: 1,
      parseResponse: (response) => response.arrayBuffer(),
    });
    await vi.runAllTimersAsync();
    await expect(request).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry invalid response contracts and handles empty responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ count: 'bad' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      apiRequest('/api/count', { schema: z.object({ count: z.number() }) }),
    ).rejects.toBeInstanceOf(z.ZodError);
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiRequest('/api/empty', { retries: 0 })).resolves.toBeUndefined();
  });

  it('returns fallbacks for unknown errors', () => {
    expect(toUserMessage(new HttpError('Not found', 404))).toBe('Not found');
    expect(toUserMessage(new DOMException('cancelled', 'AbortError'))).toBe('The request was cancelled.');
    expect(toUserMessage(new Error('Specific'))).toBe('Specific');
    expect(toUserMessage(null, 'Try again')).toBe('Try again');
  });
});
