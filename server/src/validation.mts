import type { ZodType } from 'zod';
import { toValidationIssues } from '@kiwi/contracts';
import { AppError } from './errors.mjs';

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError('Invalid request', 400, 'VALIDATION_ERROR', toValidationIssues(parsed.error));
  }
  return parsed.data;
}
