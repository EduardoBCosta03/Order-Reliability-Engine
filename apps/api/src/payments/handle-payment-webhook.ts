import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

export type PaymentWebhookPayload = {
  eventId: string;
  orderId: string;
  attempt: number;
  status: 'SUCCEEDED' | 'FAILED';
  providerRef: string;
  errorCode?: string;
};

export type PaymentWebhookResult = {
  orderId: string;
  status: string;
};

export class PaymentWebhookStateError extends Error {
  constructor(
    public readonly orderId: string,
    public readonly status: OrderStatus,
    public readonly callbackStatus: PaymentWebhookPayload['status'],
  ) {
    super(
      `Cannot apply ${callbackStatus} payment callback to order ${orderId} in status ${status}`,
    );
    this.name = 'PaymentWebhookStateError';
  }
}

type Transaction = Prisma.TransactionClient;

type ReservedItem = {
  productId: string;
  quantity: number;
};

function aggregateItems(
  items: readonly ReservedItem[],
): ReservedItem[] {
  const quantities = new Map<string, number>();

  for (const item of items) {
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity,
    );
  }

  return [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) =>
      left.productId.localeCompare(right.productId),
    );
}

async function consumeReservations(
  transaction: Transaction,
  items: readonly ReservedItem[],
): Promise<void> {
  for (const item of aggregateItems(items)) {
    const affected = await transaction.$executeRaw`
      UPDATE "Inventory"
      SET
        "reserved" = "reserved" - ${item.quantity},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "productId" = ${item.productId}
        AND "reserved" >= ${item.quantity}
    `;

    if (affected !== 1) {
      throw new Error(
        `Unable to consume reserved inventory for product ${item.productId}`,
      );
    }
  }
}

async function releaseReservations(
  transaction: Transaction,
  items: readonly ReservedItem[],
): Promise<void> {
  for (const item of aggregateItems(items)) {
    const affected = await transaction.$executeRaw`
      UPDATE "Inventory"
      SET
        "available" = "available" + ${item.quantity},
        "reserved" = "reserved" - ${item.quantity},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "productId" = ${item.productId}
        AND "reserved" >= ${item.quantity}
    `;

    if (affected !== 1) {
      throw new Error(
        `Unable to release reserved inventory for product ${item.productId}`,
      );
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

async function currentResult(
  prisma: PrismaClient,
  orderId: string,
): Promise<PaymentWebhookResult> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
    },
  });

  return {
    orderId: order.id,
    status: order.status,
  };
}

async function applySucceeded(
  transaction: Transaction,
  payload: PaymentWebhookPayload,
): Promise<PaymentWebhookResult> {
  const transitioned = await transaction.order.updateMany({
    where: {
      id: payload.orderId,
      status: OrderStatus.PAYMENT_PENDING,
    },
    data: {
      status: OrderStatus.CONFIRMED,
    },
  });

  const order = await transaction.order.findUniqueOrThrow({
    where: { id: payload.orderId },
    include: {
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  });

  if (transitioned.count === 0) {
    if (order.status === OrderStatus.CONFIRMED) {
      return {
        orderId: order.id,
        status: order.status,
      };
    }

    throw new PaymentWebhookStateError(
      order.id,
      order.status,
      payload.status,
    );
  }

  await transaction.paymentAttempt.update({
    where: {
      orderId_attempt: {
        orderId: payload.orderId,
        attempt: payload.attempt,
      },
    },
    data: {
      status: PaymentStatus.SUCCEEDED,
      providerRef: payload.providerRef,
      errorCode: null,
    },
  });

  await consumeReservations(transaction, order.items);

  await transaction.processingEvent.create({
    data: {
      orderId: order.id,
      type: 'PAYMENT_CONFIRMED',
      payload: {
        providerRef: payload.providerRef,
        attempt: payload.attempt,
      },
    },
  });

  return {
    orderId: order.id,
    status: OrderStatus.CONFIRMED,
  };
}

async function applyFailed(
  transaction: Transaction,
  payload: PaymentWebhookPayload,
): Promise<PaymentWebhookResult> {
  const transitioned = await transaction.order.updateMany({
    where: {
      id: payload.orderId,
      status: OrderStatus.PAYMENT_PENDING,
    },
    data: {
      status: OrderStatus.PAYMENT_FAILED,
    },
  });

  const order = await transaction.order.findUniqueOrThrow({
    where: { id: payload.orderId },
    include: {
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  });

  if (transitioned.count === 0) {
    if (order.status === OrderStatus.CANCELLED) {
      return {
        orderId: order.id,
        status: order.status,
      };
    }

    throw new PaymentWebhookStateError(
      order.id,
      order.status,
      payload.status,
    );
  }

  await transaction.paymentAttempt.update({
    where: {
      orderId_attempt: {
        orderId: payload.orderId,
        attempt: payload.attempt,
      },
    },
    data: {
      status: PaymentStatus.FAILED,
      providerRef: payload.providerRef,
      errorCode: payload.errorCode ?? 'PAYMENT_FAILED',
    },
  });

  await transaction.processingEvent.create({
    data: {
      orderId: order.id,
      type: 'PAYMENT_FAILED',
      payload: {
        providerRef: payload.providerRef,
        attempt: payload.attempt,
        errorCode: payload.errorCode ?? 'PAYMENT_FAILED',
      },
    },
  });

  await releaseReservations(transaction, order.items);

  await transaction.order.update({
    where: {
      id: order.id,
    },
    data: {
      status: OrderStatus.CANCELLED,
    },
  });

  await transaction.processingEvent.create({
    data: {
      orderId: order.id,
      type: 'ORDER_CANCELLED',
      payload: {
        reason: 'PAYMENT_FAILED',
      },
    },
  });

  return {
    orderId: order.id,
    status: OrderStatus.CANCELLED,
  };
}

export async function handlePaymentWebhook(
  prisma: PrismaClient,
  payload: PaymentWebhookPayload,
): Promise<PaymentWebhookResult> {
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.paymentWebhookEvent.create({
        data: {
          eventId: payload.eventId,
          orderId: payload.orderId,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      if (payload.status === 'SUCCEEDED') {
        return applySucceeded(transaction, payload);
      }

      return applyFailed(transaction, payload);
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const duplicate = await prisma.paymentWebhookEvent.findUnique({
      where: {
        eventId: payload.eventId,
      },
      select: {
        orderId: true,
      },
    });

    if (!duplicate) {
      throw error;
    }

    return currentResult(prisma, duplicate.orderId);
  }
}
