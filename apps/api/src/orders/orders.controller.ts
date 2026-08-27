import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { OutOfStockError } from '../inventory/inventory-reservation.js';
import {
  dispatchPayment,
  PaymentDispatchStateError,
} from '../payments/dispatch-payment.js';
import { PaymentQueueService } from '../payments/payment-queue.service.js';
import {
  createOrder,
  type CreateOrderItem,
  type CreatedOrder,
  IdempotencyConflictError,
  UnknownProductError,
} from './create-order.js';

type CreateOrderBody = {
  items?: CreateOrderItem[];
};

type CorrelatedRequest = {
  correlationId?: string;
};

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PaymentQueueService)
    private readonly paymentQueue: PaymentQueueService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateOrderBody,
    @Req() request: CorrelatedRequest,
  ): Promise<CreatedOrder> {
    if (!Array.isArray(body?.items)) {
      throw new BadRequestException('items must be an array');
    }

    try {
      const order = await createOrder(this.prisma, {
        idempotencyKey: idempotencyKey ?? '',
        items: body.items,
        ...(request.correlationId
          ? { correlationId: request.correlationId }
          : {}),
      });

      if (
        order.status === 'INVENTORY_RESERVED' ||
        order.status === 'PAYMENT_PENDING'
      ) {
        await dispatchPayment(
          this.prisma,
          this.paymentQueue.queue,
          order.id,
          request.correlationId,
        );

        return await this.prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          select: {
            id: true,
            status: true,
            totalCents: true,
          },
        });
      }

      return order;
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        throw new ConflictException(error.message);
      }

      if (error instanceof OutOfStockError) {
        throw new ConflictException(error.message);
      }

      if (error instanceof PaymentDispatchStateError) {
        throw new ConflictException(error.message);
      }

      if (error instanceof UnknownProductError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof TypeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
