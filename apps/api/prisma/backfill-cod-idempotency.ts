/**
 * One-off: fixes payments left with a missing idempotencyKey by the courier
 * COD collection path (courier-admin.service.ts settleCourierCollection),
 * which created payments without setting the column before this fix. Since
 * MongoDB's unique index is not sparse, the first such row blocks every COD
 * collection system-wide from that point on — see the note beside the fixed
 * payment.create call. Safe to run more than once.
 *
 *   npx tsx prisma/backfill-cod-idempotency.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orphaned = (
    await prisma.payment.findMany({
      select: { id: true, idempotencyKey: true, providerPayload: true }
    })
  ).filter((payment) => !payment.idempotencyKey);

  if (!orphaned.length) {
    console.log("Nothing to backfill.");
    return;
  }

  console.log(`Backfilling ${orphaned.length} payment(s)...`);
  for (const payment of orphaned) {
    const payload = payment.providerPayload as { shipmentId?: string } | null;
    const key = payload?.shipmentId ? `cod:${payload.shipmentId}` : `legacy:${payment.id}`;
    await prisma.payment.update({ where: { id: payment.id }, data: { idempotencyKey: key } });
    console.log(`  ${payment.id} -> ${key}`);
  }
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
