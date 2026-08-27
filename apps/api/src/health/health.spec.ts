import { describe, expect, it } from 'vitest';

import * as healthModule from './health.js';

type HealthContract = {
  buildApiHealth(): { status: 'ok'; service: 'api' };
};

const health = healthModule as Partial<HealthContract>;

describe('API health', () => {
  it('returns the API health payload', () => {
    expect(typeof health.buildApiHealth).toBe('function');
    if (!health.buildApiHealth) return;

    expect(health.buildApiHealth()).toEqual({
      status: 'ok',
      service: 'api',
    });
  });
});
