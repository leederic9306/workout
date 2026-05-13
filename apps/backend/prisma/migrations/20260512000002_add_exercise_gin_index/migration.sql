-- CreateIndex (GIN for primaryMuscles array filtering)
CREATE INDEX IF NOT EXISTS "exercise_primary_muscles_gin_idx" ON "Exercise" USING GIN ("primaryMuscles");
