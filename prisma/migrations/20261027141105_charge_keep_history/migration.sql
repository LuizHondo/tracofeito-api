-- DropForeignKey
ALTER TABLE "Charge" DROP CONSTRAINT "Charge_subscriptionId_fkey";

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
