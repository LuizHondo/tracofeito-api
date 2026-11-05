-- CreateTable
CREATE TABLE "PageProgress" (
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageProgress_pkey" PRIMARY KEY ("userId","pageId")
);

-- AddForeignKey
ALTER TABLE "PageProgress" ADD CONSTRAINT "PageProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageProgress" ADD CONSTRAINT "PageProgress_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
