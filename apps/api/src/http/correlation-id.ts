import { randomUUID } from 'node:crypto';

export function resolveCorrelationId(value?: string | string[]): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();

  return normalized || randomUUID();
}
