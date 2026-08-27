import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const product = await prisma.product.upsert({
    where: {
      sku: 'DEMO-001',
    },
    update: {
      name: 'Demo Reliability Item',
      unitPriceCents: 4900,
    },
    create: {
      sku: 'DEMO-001',
      name: 'Demo Reliability Item',
      unitPriceCents: 4900,
    },
  });

  await prisma.inventory.upsert({
    where: {
      productId: product.id,
    },
    update: {
      available: 10,
      reserved: 0,
    },
    create: {
      productId: product.id,
      available: 10,
      reserved: 0,
    },
  });

  console.log(
    JSON.stringify(
      {
        productId: product.id,
        sku: product.sku,
        available: 10,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
