import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { OutOfStockError } from '../inventory/inventory-reservation.js';
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
  constructor(private readonly prisma: PrismaService) {}

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
      return await createOrder(this.prisma, {
        idempotencyKey: idempotencyKey ?? '',
        items: body.items,
        ...(request.correlationId
          ? { correlationId: request.correlationId }
          : {}),
      });
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        throw new ConflictException(error.message);
      }

      if (error instanceof OutOfStockError) {
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
