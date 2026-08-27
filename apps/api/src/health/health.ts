export type ApiHealth = {
  status: 'ok';
  service: 'api';
};

export function buildApiHealth(): ApiHealth {
  return {
    status: 'ok',
    service: 'api',
  };
}
