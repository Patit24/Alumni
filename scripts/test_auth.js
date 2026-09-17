const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function main() {
  const dbPath = path.join(__dirname, "../dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log("1. Connecting to SQLite database...");
  await prisma.$connect();
  console.log("✓ Connected successfully!");

  console.log("2. Cleaning up test record if exists...");
  const testPhone = "+919876543210";
  await prisma.user.deleteMany({ where: { phone: testPhone } });
  await prisma.otpCode.deleteMany({ where: { phone: testPhone } });

  console.log("3. Creating OtpCode...");
  const otp = await prisma.otpCode.create({
    data: {
      phone: testPhone,
      code: "123456",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });
  console.log("✓ OTP created:", otp.code, "for", otp.phone);

  console.log("4. Creating Institution & Batch...");
  let inst = await prisma.institution.findFirst({ where: { name: "Kalyani Government Engineering College" } });
  if (!inst) {
    inst = await prisma.institution.create({
      data: {
        name: "Kalyani Government Engineering College",
        slug: "kgec-main",
        type: "COLLEGE",
        city: "Kalyani",
      }
    });
  }
  console.log("✓ Institution:", inst.name, `(${inst.id})`);

  let batch = await prisma.batch.findFirst({ where: { institutionId: inst.id, year: 2024 } });
  if (!batch) {
    batch = await prisma.batch.create({
      data: {
        institutionId: inst.id,
        year: 2024,
        estimatedSize: 60
      }
    });
  }
  console.log("✓ Batch: Class of", batch.year);

  let dept = await prisma.department.findFirst({ where: { institutionId: inst.id, name: "MCA" } });
  if (!dept) {
    dept = await prisma.department.create({
      data: {
        institutionId: inst.id,
        name: "MCA"
      }
    });
  }
  console.log("✓ Department:", dept.name);

  console.log("5. Creating User (Unverified)...");
  const user = await prisma.user.create({
    data: {
      phone: testPhone,
      name: "Patitpaban Roy",
      verificationStatus: "UNVERIFIED",
      institutionId: inst.id,
      batchId: batch.id,
      batchYear: 2024,
      departmentId: dept.id,
      currentRole: "Lead Engineer",
      currentCompany: "Google",
      city: "Kolkata"
    },
    include: {
      institution: true,
      batch: true,
      department: true
    }
  });
  console.log("✓ User created successfully!");
  console.log("  ID:", user.id);
  console.log("  Name:", user.name);
  console.log("  Status:", user.verificationStatus);
  console.log("  Institution:", user.institution.name);
  console.log("  Batch:", user.batchYear);

  console.log("6. Creating FeedItem for join event...");
  const feed = await prisma.feedItem.create({
    data: {
      institutionId: inst.id,
      actorId: user.id,
      type: "USER_JOINED",
      metadata: JSON.stringify({
        userName: user.name,
        batchYear: user.batchYear,
        department: user.department?.name,
      })
    }
  });
  console.log("✓ FeedItem logged:", feed.type);

  console.log("7. Querying returning user...");
  const returning = await prisma.user.findUnique({
    where: { phone: testPhone },
    include: { institution: true, batch: true, department: true }
  });
  console.log("✓ Returning user fetched:", returning.name, `(${returning.phone})`);

  console.log("\n===========================================");
  console.log("🎉 ALL PHASE 1 DATABASE & MODEL CHECKS PASSED!");
  console.log("===========================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
