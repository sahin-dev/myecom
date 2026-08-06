/**
 * Gives every existing Payment a non-null idempotencyKey.
 *
 * MongoDB's unique index is not sparse: documents missing the field, or holding
 * null, all collide with each other, so `Payment_idempotencyKey_key` could never
 * be built on a collection that already had more than one key-less payment.
 * Backfilling a unique synthetic key per row lets the index build and makes the
 * double-charge guard real. Safe to run more than once.
 *
 *   npx tsx prisma/backfill-payment-idempotency.ts
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Filtering on `null` here would miss most rows: in MongoDB, Prisma treats a
  // null filter as "explicitly null" and these documents are missing the field
  // entirely. Reading everything and filtering in memory catches both shapes.
  const payments = (
    await prisma.payment.findMany({ select: { id: true, idempotencyKey: true } })
  ).filter((payment) => !payment.idempotencyKey);

  if (!payments.length) {
    console.log("Nothing to backfill — every payment already has a key.");
    return;
  }

  console.log(`Backfilling ${payments.length} payment(s)...`);
  let done = 0;
  for (const payment of payments) {
    await prisma.payment.update({
      where: { id: payment.id },
      // Prefixed so a backfilled key is never mistaken for a real client key.
      data: { idempotencyKey: `legacy:${payment.id}:${randomUUID()}` }
    });
    done += 1;
  }
  console.log(`Backfilled ${done} payment(s). Run \`prisma db push\` next.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
