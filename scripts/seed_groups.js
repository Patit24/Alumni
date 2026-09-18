/* eslint-disable */
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function seedGroups() {
  const dbPath = path.join(__dirname, "../dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding Groups & Music Rooms...");

  const bwu = await prisma.institution.findFirst({ where: { name: "Brainware University" } });
  if (!bwu) {
    console.error("Brainware University not found");
    return;
  }

  const ppr = await prisma.user.findFirst({ where: { phone: "9868543657" } });
  const ananya = await prisma.user.findFirst({ where: { name: "Ananya Sen" } });
  const sourav = await prisma.user.findFirst({ where: { name: "Sourav Ganguly" } });
  const rohan = await prisma.user.findFirst({ where: { name: "Rohan Mukherjee" } });
  const pooja = await prisma.user.findFirst({ where: { name: "Pooja Banerjee" } });

  const creatorId = ppr?.id || sourav?.id;

  // 1. Same Batch Group: Class of 2026 Batch Hangout & Music Lounge
  let batchGroup = await prisma.group.findFirst({
    where: { name: "Class of 2026 Hangout & Music Room" },
  });

  if (!batchGroup) {
    batchGroup = await prisma.group.create({
      data: {
        name: "Class of 2026 Hangout & Music Room",
        description: "Official hangout for Class of 2026! Chat about exams, campus placements, and listen to music together.",
        scope: "SAME_BATCH",
        batchYear: 2026,
        institutionId: bwu.id,
        createdById: creatorId,
      },
    });
    console.log("✓ Created batch group: Class of 2026 Hangout & Music Room");
  }

  // 2. University-wide Group: Brainware Developers & Jam Club
  let uniGroup = await prisma.group.findFirst({
    where: { name: "Brainware Tech & Music Jam Society" },
  });

  if (!uniGroup) {
    uniGroup = await prisma.group.create({
      data: {
        name: "Brainware Tech & Music Jam Society",
        description: "A cross-batch community for all students & alumni into coding, hackathons, and late-night music jams.",
        scope: "INSTITUTION",
        institutionId: bwu.id,
        createdById: creatorId,
      },
    });
    console.log("✓ Created university club: Brainware Tech & Music Jam Society");
  }

  // Add members
  const usersToAdd = [ppr, ananya, sourav, rohan, pooja].filter(Boolean);
  for (const u of usersToAdd) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: batchGroup.id, userId: u.id } },
      create: { groupId: batchGroup.id, userId: u.id, role: u.id === creatorId ? "ADMIN" : "MEMBER" },
      update: {},
    });
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: uniGroup.id, userId: u.id } },
      create: { groupId: uniGroup.id, userId: u.id, role: u.id === creatorId ? "ADMIN" : "MEMBER" },
      update: {},
    });
  }

  // Seed sample messages
  const existingMsgs = await prisma.chatMessage.count({ where: { groupId: batchGroup.id } });
  if (existingMsgs === 0 && ananya && sourav) {
    await prisma.chatMessage.createMany({
      data: [
        {
          groupId: batchGroup.id,
          senderId: ananya.id,
          content: "Hey everyone! Welcome to the Class of 2026 Music & Chat Room 🎵",
          type: "TEXT",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
        },
        {
          groupId: batchGroup.id,
          senderId: sourav.id,
          content: "Awesome! We can play songs directly from our phone right in this room while chatting!",
          type: "TEXT",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        },
        {
          groupId: batchGroup.id,
          senderId: ananya.id,
          content: "Playing: Chill Lo-Fi Study Beats ☕🎧",
          type: "MUSIC_SHARE",
          metadata: JSON.stringify({
            title: "Chill Lo-Fi Campus Beats",
            artist: "Alumni Chill Radio",
          }),
          createdAt: new Date(Date.now() - 1000 * 60 * 45),
        },
      ],
    });
    console.log("✓ Seeded sample chat messages in batch group");
  }

  console.log("✨ Groups & Music seeding complete!");
  await prisma.$disconnect();
}

seedGroups().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
