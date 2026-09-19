/* eslint-disable */
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function runSeed() {
  const dbPath = process.env.DATABASE_URL
    ? (process.env.DATABASE_URL.startsWith("file:") ? process.env.DATABASE_URL.slice(5) : process.env.DATABASE_URL)
    : path.join(__dirname, "../dev.db");
  const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

  console.log("🌱 Running database auto-seed at:", resolvedPath);
  const adapter = new PrismaBetterSqlite3({ url: resolvedPath });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Brainware University
    let bwu = await prisma.institution.findFirst({ where: { name: "Brainware University" } });
    if (!bwu) {
      bwu = await prisma.institution.create({
        data: {
          name: "Brainware University",
          slug: "brainware-university",
          type: "UNIVERSITY",
          city: "Kolkata",
          state: "West Bengal",
        },
      });
    }

    // 2. Department MCA
    let mcaDept = await prisma.department.findFirst({
      where: { institutionId: bwu.id, name: "MCA" },
    });
    if (!mcaDept) {
      mcaDept = await prisma.department.create({
        data: {
          name: "MCA",
          institutionId: bwu.id,
        },
      });
    }

    // 3. Batches
    let b2026 = await prisma.batch.findFirst({
      where: { institutionId: bwu.id, year: 2026 },
    });
    if (!b2026) {
      b2026 = await prisma.batch.create({
        data: {
          year: 2026,
          estimatedSize: 60,
          institutionId: bwu.id,
        },
      });
    }

    console.log("✅ Core institutions & batches seeded successfully!");
  } catch (err) {
    console.error("Auto-seed error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
