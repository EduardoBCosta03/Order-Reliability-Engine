import { describe, expect, it } from 'vitest';

import * as correlationModule from './correlation-id.js';

type CorrelationContract = {
  resolveCorrelationId(value?: string | string[]): string;
};

const correlation = correlationModule as Partial<CorrelationContract>;

describe('correlation ids', () => {
  it('preserves an incoming correlation id', () => {
    expect(typeof correlation.resolveCorrelationId).toBe('function');
    if (!correlation.resolveCorrelationId) return;

    expect(correlation.resolveCorrelationId('request-123')).toBe('request-123');
  });

  it('generates a correlation id when the header is absent', () => {
    expect(typeof correlation.resolveCorrelationId).toBe('function');
    if (!correlation.resolveCorrelationId) return;

    expect(correlation.resolveCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
