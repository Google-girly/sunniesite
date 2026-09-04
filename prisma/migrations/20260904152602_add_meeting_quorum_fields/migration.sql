-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "membersInAttendance" INTEGER,
ADD COLUMN     "quorumEligible" INTEGER,
ADD COLUMN     "quorumRequired" INTEGER,
ADD COLUMN     "totalMembers" INTEGER;
