-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('subscription', 'one_time');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'subscription';
