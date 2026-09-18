/* eslint-disable */
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function seedJobsAndMentors() {
  const dbPath = path.join(__dirname, "../dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding Jobs, Referrals & Mentorship data...");

  const bwu = await prisma.institution.findFirst({ where: { name: "Brainware University" } });
  if (!bwu) {
    console.error("Brainware University not found in DB");
    return;
  }

  const ananya = await prisma.user.findFirst({ where: { name: "Ananya Sen" } });
  const sourav = await prisma.user.findFirst({ where: { name: "Sourav Ganguly" } });
  const rohan = await prisma.user.findFirst({ where: { name: "Rohan Mukherjee" } });
  const pooja = await prisma.user.findFirst({ where: { name: "Pooja Banerjee" } });

  if (ananya) {
    await prisma.user.update({
      where: { id: ananya.id },
      data: {
        isOpenToMentor: true,
        mentorTopics: "Portfolio Review, UI/UX Design, Career Switch",
        mentorScope: "ALL",
      },
    });
  }

  if (rohan) {
    await prisma.user.update({
      where: { id: rohan.id },
      data: {
        isOpenToMentor: true,
        mentorTopics: "System Design, Mock Interviews, Microsoft Referrals",
        mentorScope: "ALL",
      },
    });
  }

  if (pooja) {
    await prisma.user.update({
      where: { id: pooja.id },
      data: {
        isOpenToMentor: true,
        mentorTopics: "React & Next.js, Frontend Architecture, Tech Leadership",
        mentorScope: "ALL",
      },
    });
  }

  if (sourav) {
    await prisma.user.update({
      where: { id: sourav.id },
      data: {
        isOpenToMentor: true,
        mentorTopics: "Fullstack Web, Java & Spring Boot, Campus Placements",
        mentorScope: "INSTITUTION_ONLY",
      },
    });
  }

  const jobsToCreate = [
    {
      posterId: rohan?.id,
      institutionId: bwu.id,
      title: "Software Engineer (Cloud & AI Services)",
      company: "Microsoft",
      location: "Hyderabad / Remote",
      roleType: "FULL_TIME",
      description:
        "Join our Azure Core team working on distributed systems and cloud orchestration. 0-2 years experience required. Direct employee referral available for verified alumni batchmates.",
      applyUrl: "https://careers.microsoft.com",
      visibility: "ALL",
    },
    {
      posterId: ananya?.id,
      institutionId: bwu.id,
      title: "Junior Product Designer (Design Systems)",
      company: "Swiggy",
      location: "Bengaluru (Hybrid)",
      roleType: "FULL_TIME",
      description:
        "Looking for fresh minds passionate about customer journeys, mobile micro-interactions, and Figma design tokens. Open to Class of 2025 & 2026 graduates.",
      applyUrl: "https://careers.swiggy.com",
      visibility: "ALL",
    },
    {
      posterId: sourav?.id,
      institutionId: bwu.id,
      title: "Graduate Engineer Trainee (GET)",
      company: "Tata Consultancy Services (TCS)",
      location: "Kolkata",
      roleType: "FULL_TIME",
      description:
        "Mass hiring drive for MCA & B.Tech graduates. Internal employee referral gives priority screening for technical assessment.",
      applyUrl: "https://nextstep.tcs.com",
      visibility: "INSTITUTION_ONLY",
    },
    {
      posterId: pooja?.id,
      institutionId: bwu.id,
      title: "Frontend Engineering Intern (React / Next.js)",
      company: "Zomato",
      location: "Gurugram / Remote",
      roleType: "INTERNSHIP",
      description:
        "3-month paid internship with PPO opportunity. Work with our dining out frontend squad using Next.js App Router and Tailwind CSS.",
      applyUrl: "https://zomato.com/careers",
      visibility: "ALL",
    },
  ];

  for (const job of jobsToCreate) {
    if (job.posterId) {
      const existing = await prisma.job.findFirst({
        where: {
          title: job.title,
          company: job.company,
        },
      });
      if (!existing) {
        await prisma.job.create({ data: job });
        console.log(`✅ Created job: ${job.title} at ${job.company}`);
      }
    }
  }

  console.log("✨ Seeding complete!");
  await prisma.$disconnect();
}

seedJobsAndMentors().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
