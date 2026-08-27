import { describe, expect, it } from 'vitest';

import * as healthModule from './health.js';

type GatewayHealthContract = {
  buildGatewayHealth(): { status: 'ok'; service: 'fake-gateway' };
};

const health = healthModule as Partial<GatewayHealthContract>;

describe('fake gateway health', () => {
  it('returns the gateway health payload', () => {
    expect(typeof health.buildGatewayHealth).toBe('function');
    if (!health.buildGatewayHealth) return;

    expect(health.buildGatewayHealth()).toEqual({
      status: 'ok',
      service: 'fake-gateway',
    });
  });
});
