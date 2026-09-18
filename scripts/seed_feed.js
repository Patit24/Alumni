/* eslint-disable */
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function seedFeed() {
  const dbPath = path.join(__dirname, "../dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding rich LinkedIn-style Alumni Feed...");

  const bwu = await prisma.institution.findFirst({ where: { name: "Brainware University" } });
  if (!bwu) {
    console.error("Brainware University not found");
    return;
  }

  const ananya = await prisma.user.findFirst({ where: { name: "Ananya Sen" } });
  const sourav = await prisma.user.findFirst({ where: { name: "Sourav Ganguly" } });
  const rohan = await prisma.user.findFirst({ where: { name: "Rohan Mukherjee" } });
  const pooja = await prisma.user.findFirst({ where: { name: "Pooja Banerjee" } });
  const vikram = await prisma.user.findFirst({ where: { name: "Vikram Das" } });

  const feedItems = [
    {
      institutionId: bwu.id,
      actorId: rohan?.id,
      type: "JOB_POSTED",
      metadata: JSON.stringify({
        text: "Excited to announce that Microsoft Azure is actively hiring Software Engineers (Cloud & Distributed Systems)! Verified alumni batchmates from Brainware can reach out directly for priority referrals.",
        jobTitle: "Software Engineer (Cloud & AI)",
        company: "Microsoft",
        location: "Hyderabad / Remote",
        likes: 24,
        commentsCount: 6,
        badge: "Hiring / Referral",
      }),
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    },
    {
      institutionId: bwu.id,
      actorId: ananya?.id,
      type: "MENTORSHIP_AVAILABLE",
      metadata: JSON.stringify({
        text: "I've just opened up 3 mentorship slots this weekend for juniors interested in Product Design & UX portfolio critiques. Feel free to request guidance on the Mentorship tab!",
        topics: ["Portfolio Review", "UI/UX Design", "Figma Design Systems"],
        likes: 18,
        commentsCount: 4,
        badge: "Mentorship",
      }),
      createdAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hrs ago
    },
    {
      institutionId: bwu.id,
      actorId: pooja?.id,
      type: "POST",
      metadata: JSON.stringify({
        text: "Proud moment! Our squad at Zomato just rolled out a major Next.js App Router performance overhaul reducing LCP by 40%. Huge shoutout to everyone experimenting with React 19 server components!",
        tags: ["#FrontendEngineering", "#NextJS", "#WebPerformance", "#TechLeadership"],
        likes: 42,
        commentsCount: 9,
        badge: "Industry Update",
      }),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hrs ago
    },
    {
      institutionId: bwu.id,
      actorId: sourav?.id,
      type: "USER_JOINED",
      metadata: JSON.stringify({
        text: "Just joined the Brainware University Alumni Network! Looking forward to connecting with batchmates from the Class of 2026 and our seniors.",
        likes: 15,
        commentsCount: 3,
        badge: "New Member",
      }),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hrs ago
    },
    {
      institutionId: bwu.id,
      actorId: vikram?.id,
      type: "WORK_ANNIVERSARY",
      metadata: JSON.stringify({
        text: "Celebrating 1 year at Infosys AI Labs working on LLM fine-tuning and agentic systems! Grateful for the strong computer science foundation built during our college days.",
        likes: 31,
        commentsCount: 5,
        badge: "Work Anniversary 🎯",
      }),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
  ];

  for (const item of feedItems) {
    if (item.actorId) {
      await prisma.feedItem.create({
        data: item,
      });
      console.log(`✓ Created feed post by actor: ${item.actorId} [${item.type}]`);
    }
  }

  console.log("✨ Feed seeding complete!");
  await prisma.$disconnect();
}

seedFeed().catch((err) => {
  console.error("Seed feed error:", err);
  process.exit(1);
});
