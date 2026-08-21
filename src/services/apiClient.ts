import { ApiErrorSchema, type ApiError } from '@kiwi/contracts';
import { ZodError, type ZodType } from 'zod';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_SAFE_RETRIES = 2;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: ApiError,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ApiRequestOptions<T> extends Omit<RequestInit, 'signal'> {
  schema?: ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  parseResponse?: (response: Response) => Promise<T>;
}

function abortableDelay(durationMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(resolve, durationMs);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function parseError(response: Response): Promise<ApiError | undefined> {
  try {
    const parsed = ApiErrorSchema.safeParse(await response.clone().json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function isSafeMethod(method?: string): boolean {
  return !method || ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions<T> = {}): Promise<T> {
  const {
    schema,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = MAX_SAFE_RETRIES,
    headers,
    parseResponse,
    ...requestInit
  } = options;
  const retryCount = isSafeMethod(requestInit.method) ? Math.max(0, Math.min(retries, MAX_SAFE_RETRIES)) : 0;

  for (let attempt = 0; ; attempt += 1) {
    const timeoutController = new AbortController();
    const timeout = window.setTimeout(
      () => timeoutController.abort(new DOMException('Request timed out', 'TimeoutError')),
      timeoutMs,
    );
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const response = await fetch(path, {
        ...requestInit,
        headers: {
          Accept: 'application/json',
          ...(requestInit.body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        signal: combinedSignal,
      });

      if (!response.ok) {
        const details = await parseError(response);
        const error = new HttpError(
          details?.message ?? details?.error ?? `${response.status} ${response.statusText}`,
          response.status,
          details,
        );
        if (attempt < retryCount && TRANSIENT_STATUSES.has(response.status)) {
          await abortableDelay(250 * 2 ** attempt, signal);
          continue;
        }
        throw error;
      }

      if (response.status === 204) return undefined as T;
      if (parseResponse) return await parseResponse(response);
      const payload: unknown = await response.json();
      return schema ? schema.parse(payload) : (payload as T);
    } catch (error) {
      if (signal?.aborted || error instanceof HttpError || error instanceof ZodError || attempt >= retryCount)
        throw error;
      await abortableDelay(250 * 2 ** attempt, signal);
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') return 'The request was cancelled.';
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
