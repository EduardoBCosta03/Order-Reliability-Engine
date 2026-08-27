import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import {
  handlePaymentWebhook,
  type PaymentWebhookPayload,
  type PaymentWebhookResult,
  PaymentWebhookStateError,
} from './handle-payment-webhook.js';

type PaymentWebhookBody = Partial<PaymentWebhookPayload>;

@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  @Post('fake-gateway')
  @HttpCode(200)
  async receiveFakeGatewayWebhook(
    @Body() body: PaymentWebhookBody,
  ): Promise<PaymentWebhookResult> {
    const eventId = body.eventId?.trim();
    const orderId = body.orderId?.trim();
    const providerRef = body.providerRef?.trim();

    if (!eventId) {
      throw new BadRequestException('eventId is required');
    }

    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }

    if (
      !Number.isInteger(body.attempt) ||
      (body.attempt ?? 0) <= 0
    ) {
      throw new BadRequestException(
        'attempt must be a positive integer',
      );
    }

    if (
      body.status !== 'SUCCEEDED' &&
      body.status !== 'FAILED'
    ) {
      throw new BadRequestException(
        'status must be SUCCEEDED or FAILED',
      );
    }

    if (!providerRef) {
      throw new BadRequestException('providerRef is required');
    }

    try {
      return await handlePaymentWebhook(this.prisma, {
        eventId,
        orderId,
        attempt: body.attempt as number,
        status: body.status,
        providerRef,
        ...(body.errorCode
          ? { errorCode: body.errorCode }
          : {}),
      });
    } catch (error) {
      if (error instanceof PaymentWebhookStateError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }
}
