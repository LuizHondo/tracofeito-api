-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "url" TEXT NOT NULL DEFAULT '';

-- At most one pending charge per subscription (renewal cycle).
CREATE UNIQUE INDEX "Charge_one_pending_per_subscription" ON "Charge"("subscriptionId") WHERE "status" = 'pending';
