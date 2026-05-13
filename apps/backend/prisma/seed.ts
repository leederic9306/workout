import { PrismaClient, ProgramType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// free-exercise-db 이미지 URL 베이스
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

interface ExerciseSeedItem {
  id: string;
  name: string;
  force?: string | null;
  level: string;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images?: string[];
}

// 운동 종목 시드 (free-exercise-db)
async function seedExercises() {
  const exercisesPath = path.join(__dirname, 'seed', 'exercises.json');
  if (!fs.existsSync(exercisesPath)) {
    console.warn(`Exercises seed file not found at ${exercisesPath}, skipping.`);
    return;
  }

  const exercises: ExerciseSeedItem[] = JSON.parse(
    fs.readFileSync(exercisesPath, 'utf-8'),
  );

  console.log(`Seeding ${exercises.length} exercises...`);

  await prisma.$transaction(async (tx) => {
    for (const ex of exercises) {
      const payload = {
        name: ex.name,
        force: ex.force ?? null,
        level: ex.level,
        mechanic: ex.mechanic ?? null,
        equipment: ex.equipment ?? null,
        primaryMuscles: ex.primaryMuscles,
        secondaryMuscles: ex.secondaryMuscles,
        instructions: ex.instructions,
        category: ex.category,
        images: (ex.images || []).map((p) => `${IMAGE_BASE}${p}`),
      };

      await tx.exercise.upsert({
        where: { externalId: ex.id },
        create: { externalId: ex.id, ...payload },
        update: payload,
      });
    }
  });

  const count = await prisma.exercise.count();
  console.log(`Seeded ${count} exercises.`);
}

// 관리자 계정 시드
async function seedAdmin() {
  const adminEmail = 'admin@workout.com';
  const adminPassword = 'Admin@1234';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      nickname: '데릭',
      role: UserRole.ADMIN,
      emailVerified: true,
    },
  });

  console.log(`Admin account seeded: ${adminEmail}`);
}

// SPEC-PROGRAM-001: 카탈로그 6종 프로그램 시드
interface CatalogExerciseSeed {
  exerciseName: string; // Exercise.name 또는 그 변형 (대소문자/공백 무시 매칭)
  sets: number;
  reps: string;
  weightNote?: string | null;
}

interface CatalogDaySeed {
  dayNumber: number;
  name: string;
  exercises: CatalogExerciseSeed[];
}

interface CatalogProgramSeed {
  title: string;
  description: string;
  level: string;
  frequency: number;
  days: CatalogDaySeed[];
}

// Exercise를 이름으로 찾되, 없으면 후보 이름들을 순차 시도
async function findExerciseIdByName(
  tx: any,
  name: string,
): Promise<string | null> {
  // 정확 일치 (대소문자 무시)
  const exact = await tx.exercise.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (exact) return exact.id;
  // 부분 일치 fallback
  const partial = await tx.exercise.findFirst({
    where: { name: { contains: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (partial) {
    console.log(`  Fallback: "${name}" → "${partial.name}"`);
    return partial.id;
  }
  return null;
}

const CATALOG_PROGRAMS: CatalogProgramSeed[] = [
  {
    title: 'StrongLifts 5x5',
    description:
      '초보자를 위한 전신 풀바디 근력 프로그램. 5×5 방식으로 점진적 과부하를 적용하여 기초 근력을 키웁니다.',
    level: 'beginner',
    frequency: 3,
    days: [
      {
        dayNumber: 1,
        name: 'Workout A',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 5, reps: '5' },
          { exerciseName: 'Barbell Bench Press', sets: 5, reps: '5' },
          { exerciseName: 'Bent Over Barbell Row', sets: 5, reps: '5' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Workout B',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 5, reps: '5' },
          { exerciseName: 'Standing Military Press', sets: 5, reps: '5' },
          { exerciseName: 'Deadlift', sets: 1, reps: '5' },
        ],
      },
    ],
  },
  {
    title: 'Starting Strength',
    description:
      '마크 리피토의 초급 바벨 근력 프로그램. 스쿼트·데드리프트·벤치프레스·오버헤드프레스·파워클린을 중심으로 전신 근력을 빠르게 향상시킵니다.',
    level: 'beginner',
    frequency: 3,
    days: [
      {
        dayNumber: 1,
        name: 'Session A',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 3, reps: '5' },
          { exerciseName: 'Barbell Bench Press', sets: 3, reps: '5' },
          { exerciseName: 'Deadlift', sets: 1, reps: '5' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Session B',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 3, reps: '5' },
          { exerciseName: 'Standing Military Press', sets: 3, reps: '5' },
          { exerciseName: 'Power Clean', sets: 5, reps: '3' },
        ],
      },
    ],
  },
  {
    title: 'Beginner PPL',
    description:
      '초중급자를 위한 Push-Pull-Legs 6일 분할 프로그램. 각 부위를 주 2회 자극하여 효율적인 근비대를 유도합니다.',
    level: 'intermediate',
    frequency: 6,
    days: [
      {
        dayNumber: 1,
        name: 'Push',
        exercises: [
          { exerciseName: 'Barbell Bench Press', sets: 4, reps: '8-12' },
          { exerciseName: 'Standing Military Press', sets: 3, reps: '8-12' },
          { exerciseName: 'Dumbbell Fly', sets: 3, reps: '12-15' },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '12-15' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Pull',
        exercises: [
          { exerciseName: 'Deadlift', sets: 3, reps: '5' },
          { exerciseName: 'Pull Up', sets: 4, reps: '8-12' },
          { exerciseName: 'Bent Over Barbell Row', sets: 3, reps: '8-12' },
          { exerciseName: 'Barbell Curl', sets: 3, reps: '12-15' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Legs',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 4, reps: '8-12' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-12' },
          { exerciseName: 'Leg Press', sets: 3, reps: '12-15' },
          { exerciseName: 'Calf Raise', sets: 4, reps: '15-20' },
        ],
      },
      {
        dayNumber: 4,
        name: 'Push',
        exercises: [
          { exerciseName: 'Barbell Bench Press', sets: 4, reps: '8-12' },
          { exerciseName: 'Standing Military Press', sets: 3, reps: '8-12' },
          { exerciseName: 'Dumbbell Fly', sets: 3, reps: '12-15' },
          { exerciseName: 'Triceps Pushdown', sets: 3, reps: '12-15' },
        ],
      },
      {
        dayNumber: 5,
        name: 'Pull',
        exercises: [
          { exerciseName: 'Deadlift', sets: 3, reps: '5' },
          { exerciseName: 'Pull Up', sets: 4, reps: '8-12' },
          { exerciseName: 'Bent Over Barbell Row', sets: 3, reps: '8-12' },
          { exerciseName: 'Barbell Curl', sets: 3, reps: '12-15' },
        ],
      },
      {
        dayNumber: 6,
        name: 'Legs',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 4, reps: '8-12' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8-12' },
          { exerciseName: 'Leg Press', sets: 3, reps: '12-15' },
          { exerciseName: 'Calf Raise', sets: 4, reps: '15-20' },
        ],
      },
    ],
  },
  {
    title: 'Intermediate PPL',
    description:
      '중급자를 위한 Push-Pull-Legs 6일 분할 프로그램. 더 높은 볼륨과 강도로 근비대와 근력을 동시에 추구합니다.',
    level: 'intermediate',
    frequency: 6,
    days: [
      {
        dayNumber: 1,
        name: 'Push',
        exercises: [
          { exerciseName: 'Barbell Bench Press', sets: 5, reps: '5' },
          { exerciseName: 'Standing Military Press', sets: 4, reps: '8-12' },
          { exerciseName: 'Barbell Incline Bench Press - Medium Grip', sets: 4, reps: '8-12' },
          { exerciseName: 'Triceps Pushdown', sets: 4, reps: '10-15' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Pull',
        exercises: [
          { exerciseName: 'Deadlift', sets: 5, reps: '5' },
          { exerciseName: 'Pull Up', sets: 4, reps: '8-12' },
          { exerciseName: 'Bent Over Barbell Row', sets: 4, reps: '8-12' },
          { exerciseName: 'Barbell Curl', sets: 4, reps: '10-15' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Legs',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 5, reps: '5' },
          { exerciseName: 'Romanian Deadlift', sets: 4, reps: '8-12' },
          { exerciseName: 'Leg Press', sets: 4, reps: '10-15' },
          { exerciseName: 'Calf Raise', sets: 4, reps: '15-20' },
        ],
      },
      {
        dayNumber: 4,
        name: 'Push',
        exercises: [
          { exerciseName: 'Barbell Bench Press', sets: 5, reps: '5' },
          { exerciseName: 'Standing Military Press', sets: 4, reps: '8-12' },
          { exerciseName: 'Barbell Incline Bench Press - Medium Grip', sets: 4, reps: '8-12' },
          { exerciseName: 'Triceps Pushdown', sets: 4, reps: '10-15' },
        ],
      },
      {
        dayNumber: 5,
        name: 'Pull',
        exercises: [
          { exerciseName: 'Deadlift', sets: 5, reps: '5' },
          { exerciseName: 'Pull Up', sets: 4, reps: '8-12' },
          { exerciseName: 'Bent Over Barbell Row', sets: 4, reps: '8-12' },
          { exerciseName: 'Barbell Curl', sets: 4, reps: '10-15' },
        ],
      },
      {
        dayNumber: 6,
        name: 'Legs',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 5, reps: '5' },
          { exerciseName: 'Romanian Deadlift', sets: 4, reps: '8-12' },
          { exerciseName: 'Leg Press', sets: 4, reps: '10-15' },
          { exerciseName: 'Calf Raise', sets: 4, reps: '15-20' },
        ],
      },
    ],
  },
  {
    title: 'Arnold Split',
    description:
      '아놀드 슈워제네거의 고강도 6일 분할 프로그램. 가슴+등, 어깨+팔, 하체의 3분할을 주 2회 반복합니다.',
    level: 'advanced',
    frequency: 6,
    days: [
      {
        dayNumber: 1,
        name: 'Chest + Back',
        exercises: [
          { exerciseName: 'Barbell Bench Press', sets: 4, reps: '10' },
          { exerciseName: 'Barbell Incline Bench Press - Medium Grip', sets: 3, reps: '10' },
          { exerciseName: 'Deadlift', sets: 4, reps: '8' },
          { exerciseName: 'Bent Over Barbell Row', sets: 4, reps: '10' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Shoulders + Arms',
        exercises: [
          { exerciseName: 'Standing Military Press', sets: 4, reps: '10' },
          { exerciseName: 'Lateral Raise - With Bands', sets: 3, reps: '12' },
          { exerciseName: 'Barbell Curl', sets: 3, reps: '10' },
          { exerciseName: 'Dip', sets: 3, reps: '10' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Legs',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 5, reps: '10' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '10' },
          { exerciseName: 'Leg Press', sets: 4, reps: '12' },
        ],
      },
      {
        dayNumber: 4,
        name: 'Chest + Back',
        exercises: [
          { exerciseName: 'Barbell Bench Press', sets: 4, reps: '10' },
          { exerciseName: 'Barbell Incline Bench Press - Medium Grip', sets: 3, reps: '10' },
          { exerciseName: 'Deadlift', sets: 4, reps: '8' },
          { exerciseName: 'Bent Over Barbell Row', sets: 4, reps: '10' },
        ],
      },
      {
        dayNumber: 5,
        name: 'Shoulders + Arms',
        exercises: [
          { exerciseName: 'Standing Military Press', sets: 4, reps: '10' },
          { exerciseName: 'Lateral Raise - With Bands', sets: 3, reps: '12' },
          { exerciseName: 'Barbell Curl', sets: 3, reps: '10' },
          { exerciseName: 'Dip', sets: 3, reps: '10' },
        ],
      },
      {
        dayNumber: 6,
        name: 'Legs',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 5, reps: '10' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '10' },
          { exerciseName: 'Leg Press', sets: 4, reps: '12' },
        ],
      },
    ],
  },
  {
    title: 'Upper/Lower Split',
    description:
      '중급자를 위한 상체-하체 4일 분할 프로그램. 근력과 근비대를 균형 있게 발달시킵니다.',
    level: 'intermediate',
    frequency: 4,
    days: [
      {
        dayNumber: 1,
        name: 'Upper A',
        exercises: [
          { exerciseName: 'Barbell Bench Press', sets: 4, reps: '5' },
          { exerciseName: 'Bent Over Barbell Row', sets: 4, reps: '5' },
          { exerciseName: 'Standing Military Press', sets: 3, reps: '8' },
        ],
      },
      {
        dayNumber: 2,
        name: 'Lower A',
        exercises: [
          { exerciseName: 'Barbell Squat', sets: 4, reps: '5' },
          { exerciseName: 'Romanian Deadlift', sets: 3, reps: '8' },
          { exerciseName: 'Leg Press', sets: 3, reps: '10' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Upper B',
        exercises: [
          { exerciseName: 'Barbell Incline Bench Press - Medium Grip', sets: 3, reps: '10' },
          { exerciseName: 'Pull Up', sets: 3, reps: '10' },
          { exerciseName: 'Dumbbell Bicep Curl', sets: 3, reps: '12' },
        ],
      },
      {
        dayNumber: 4,
        name: 'Lower B',
        exercises: [
          { exerciseName: 'Romanian Deadlift', sets: 4, reps: '8' },
          { exerciseName: 'Barbell Squat', sets: 3, reps: '10' },
          { exerciseName: 'Leg Press', sets: 3, reps: '12' },
        ],
      },
    ],
  },
];

async function seedCatalogPrograms() {
  console.log('Seeding catalog programs...');

  for (const seed of CATALOG_PROGRAMS) {
    // 멱등성: 동일 title + CATALOG가 이미 있으면 스킵
    const existing = await prisma.program.findFirst({
      where: { title: seed.title, type: ProgramType.CATALOG },
      select: { id: true },
    });
    if (existing) {
      console.log(`  Skip "${seed.title}" (already seeded)`);
      continue;
    }

    await prisma.$transaction(async (tx: any) => {
      const program = await tx.program.create({
        data: {
          title: seed.title,
          description: seed.description,
          type: ProgramType.CATALOG,
          level: seed.level,
          frequency: seed.frequency,
          createdBy: null,
          isPublic: false,
        },
      });

      for (const day of seed.days) {
        const dayRow = await tx.programDay.create({
          data: {
            programId: program.id,
            dayNumber: day.dayNumber,
            name: day.name,
          },
        });

        let orderIndex = 1;
        for (const ex of day.exercises) {
          const exerciseId = await findExerciseIdByName(tx, ex.exerciseName);
          if (!exerciseId) {
            console.warn(
              `  WARN: exercise "${ex.exerciseName}" not found, skipping`,
            );
            continue;
          }
          await tx.programExercise.create({
            data: {
              dayId: dayRow.id,
              exerciseId,
              orderIndex: orderIndex++,
              sets: ex.sets,
              reps: ex.reps,
              weightNote: ex.weightNote ?? null,
            },
          });
        }
      }
    });

    console.log(`  Seeded: ${seed.title}`);
  }

  const count = await prisma.program.count({
    where: { type: ProgramType.CATALOG },
  });
  console.log(`Catalog programs total: ${count}`);
}

async function main() {
  console.log('Seeding database...');
  await seedAdmin();
  await seedExercises();
  await seedCatalogPrograms();
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
