import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';

type PaymentScenario =
  | 'success'
  | 'transient_failure'
  | 'permanent_failure';

type SubmitPaymentBody = {
  orderId?: string;
  attempt?: number;
  amountCents?: number;
  scenario?: PaymentScenario;
  callbackUrl?: string;
  callbackDelayMs?: number;
};

type PaymentCallback = {
  eventId: string;
  orderId: string;
  attempt: number;
  status: 'SUCCEEDED' | 'FAILED';
  providerRef: string;
  errorCode?: string;
};

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  @Post()
  @HttpCode(202)
  submit(@Body() body: SubmitPaymentBody) {
    const orderId = body.orderId?.trim();
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }

    if (!Number.isInteger(body.attempt) || (body.attempt ?? 0) <= 0) {
      throw new BadRequestException('attempt must be a positive integer');
    }

    if (
      !Number.isInteger(body.amountCents) ||
      (body.amountCents ?? 0) <= 0
    ) {
      throw new BadRequestException(
        'amountCents must be a positive integer',
      );
    }

    if (!body.callbackUrl) {
      throw new BadRequestException('callbackUrl is required');
    }

    let callbackUrl: URL;
    try {
      callbackUrl = new URL(body.callbackUrl);
    } catch {
      throw new BadRequestException('callbackUrl must be a valid URL');
    }

    if (!['http:', 'https:'].includes(callbackUrl.protocol)) {
      throw new BadRequestException(
        'callbackUrl must use http or https',
      );
    }

    const scenario = body.scenario ?? 'success';

    if (
      !['success', 'transient_failure', 'permanent_failure'].includes(
        scenario,
      )
    ) {
      throw new BadRequestException('unsupported payment scenario');
    }

    if (scenario === 'transient_failure') {
      throw new ServiceUnavailableException(
        'Simulated transient gateway failure',
      );
    }

    const attempt = body.attempt as number;
    const providerRef = `pay-${orderId}-${attempt}`;
    const callbackStatus =
      scenario === 'permanent_failure' ? 'FAILED' : 'SUCCEEDED';

    const callback: PaymentCallback = {
      eventId: `evt-${orderId}-${attempt}-${callbackStatus.toLowerCase()}`,
      orderId,
      attempt,
      status: callbackStatus,
      providerRef,
      ...(callbackStatus === 'FAILED'
        ? { errorCode: 'PAYMENT_DECLINED' }
        : {}),
    };

    const delay = Math.max(0, body.callbackDelayMs ?? 50);

    setTimeout(() => {
      void this.deliverCallback(callbackUrl.toString(), callback);
    }, delay);

    return {
      accepted: true,
      providerRef,
    };
  }

  private async deliverCallback(
    callbackUrl: string,
    payload: PaymentCallback,
  ): Promise<void> {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(
          `Callback ${payload.eventId} returned HTTP ${response.status}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Callback ${payload.eventId} delivery failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
