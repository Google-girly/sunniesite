-- CreateTable
CREATE TABLE "ChapterAssistantInteraction" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "sources" TEXT NOT NULL,
    "topScore" DOUBLE PRECISION,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterAssistantInteraction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ChapterAssistantInteraction" ADD CONSTRAINT "ChapterAssistantInteraction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
