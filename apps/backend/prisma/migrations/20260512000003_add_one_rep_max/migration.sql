-- CreateEnum
CREATE TYPE "CompoundType" AS ENUM ('SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'BARBELL_ROW', 'OVERHEAD_PRESS');

-- CreateEnum
CREATE TYPE "OrmSource" AS ENUM ('DIRECT_INPUT', 'ESTIMATED');

-- CreateTable
CREATE TABLE "OneRepMax" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseType" "CompoundType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" "OrmSource" NOT NULL DEFAULT 'DIRECT_INPUT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneRepMax_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneRepMax_userId_idx" ON "OneRepMax"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OneRepMax_userId_exerciseType_key" ON "OneRepMax"("userId", "exerciseType");

-- AddForeignKey
ALTER TABLE "OneRepMax" ADD CONSTRAINT "OneRepMax_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
