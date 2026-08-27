export type GatewayHealth = {
  status: 'ok';
  service: 'fake-gateway';
};

export function buildGatewayHealth(): GatewayHealth {
  return {
    status: 'ok',
    service: 'fake-gateway',
  };
}
