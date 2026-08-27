import { Injectable } from '@nestjs/common';

import { resolveCorrelationId } from './correlation-id.js';

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
};

@Injectable()
export class CorrelationIdMiddleware {
  use(request: RequestLike, response: ResponseLike, next: () => void): void {
    const correlationId = resolveCorrelationId(
      request.headers['x-correlation-id'],
    );

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    next();
  }
}
