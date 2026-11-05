/*
  Warnings:

  - Added the required column `courseId` to the `Block` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Block_pageId_position_idx";

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "courseId" TEXT NOT NULL,
ALTER COLUMN "pageId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Block_courseId_pageId_position_idx" ON "Block"("courseId", "pageId", "position");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
