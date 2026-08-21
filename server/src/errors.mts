export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_CONFIGURED' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
