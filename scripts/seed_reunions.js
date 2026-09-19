/* eslint-disable */
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function seedReunions() {
  const dbPath = path.join(__dirname, "../dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log("🎉 Seeding Batch Reunions & Get-Togethers...");

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

  const creatorId = ppr?.id || ananya?.id;

  const reunions = [
    {
      institutionId: bwu.id,
      creatorId: creatorId,
      title: "Class of 2026 Grand Rooftop Reunion & Dinner 🌆",
      description: "Calling all Class of 2026 batchmates! Let's catch up on placements, life after college, relive campus stories, and have an awesome dinner with acoustic live music.",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // in 14 days
      location: "Skyline Rooftop Lounge, Sector V, Salt Lake, Kolkata",
      batchScope: "2026",
    },
    {
      institutionId: bwu.id,
      creatorId: rohan?.id || creatorId,
      title: "Brainware Annual Tech & Alumni Gala 2026 🎓",
      description: "University-wide grand reunion gathering seniors, juniors, founders, and industry leaders across all batches. Networking, keynote sessions, and campus cafeteria nostalgia.",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // in 30 days
      location: "Brainware University Main Auditorium, Barasat Campus",
      batchScope: "ALL",
    },
    {
      institutionId: bwu.id,
      creatorId: pooja?.id || creatorId,
      title: "Bengaluru Alumni Chapter Chai & Code Meetup ☕",
      description: "Quick weekend meetup for Brainware alumni currently working in Bengaluru! Casual coffee, tech banter, and weekend chilling.",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // in 7 days
      location: "Third Wave Coffee, Indiranagar, Bengaluru",
      batchScope: "ALL",
    },
  ];

  for (const r of reunions) {
    const existing = await prisma.event.findFirst({ where: { title: r.title } });
    let event = existing;
    if (!existing) {
      event = await prisma.event.create({ data: r });
      console.log(`✓ Created reunion: ${r.title}`);
    }

    // Add RSVPs
    const attendees = [ppr, ananya, sourav, rohan, pooja].filter(Boolean);
    for (const att of attendees) {
      await prisma.eventRsvp.upsert({
        where: { eventId_userId: { eventId: event.id, userId: att.id } },
        create: { eventId: event.id, userId: att.id, status: "CONFIRMED" },
        update: {},
      });
    }
  }

  console.log("✨ Reunions seeded successfully!");
  await prisma.$disconnect();
}

seedReunions().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
