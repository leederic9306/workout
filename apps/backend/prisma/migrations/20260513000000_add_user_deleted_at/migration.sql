-- SPEC-USER-001: 사용자 소프트 삭제를 위한 deletedAt 컬럼 추가
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 소프트 삭제 조회/필터 성능을 위한 인덱스
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
