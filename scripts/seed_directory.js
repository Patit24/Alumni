/* eslint-disable */
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function seedDirectory() {
  const dbPath = path.join(__dirname, "../dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding dummy alumni profiles for Directory testing...");

  // 1. Ensure Institutions exist
  let bwu = await prisma.institution.findFirst({ where: { name: "Brainware University" } });
  if (!bwu) {
    bwu = await prisma.institution.create({
      data: {
        name: "Brainware University",
        slug: "brainware-university",
        type: "COLLEGE",
        city: "Barasat",
      }
    });
  }

  let kgec = await prisma.institution.findFirst({ where: { name: "Kalyani Government Engineering College" } });
  if (!kgec) {
    kgec = await prisma.institution.create({
      data: {
        name: "Kalyani Government Engineering College",
        slug: "kgec-college",
        type: "COLLEGE",
        city: "Kalyani",
      }
    });
  }

  let ju = await prisma.institution.findFirst({ where: { name: "Jadavpur University" } });
  if (!ju) {
    ju = await prisma.institution.create({
      data: {
        name: "Jadavpur University",
        slug: "jadavpur-university",
        type: "COLLEGE",
        city: "Kolkata",
      }
    });
  }

  // Helper to ensure batch
  async function getOrCreateBatch(institutionId, year) {
    let b = await prisma.batch.findUnique({
      where: { institutionId_year: { institutionId, year } }
    });
    if (!b) {
      b = await prisma.batch.create({
        data: { institutionId, year, estimatedSize: 60 }
      });
    }
    return b;
  }

  // Helper to ensure department
  async function getOrCreateDept(institutionId, name) {
    let d = await prisma.department.findUnique({
      where: { institutionId_name: { institutionId, name } }
    });
    if (!d) {
      d = await prisma.department.create({
        data: { institutionId, name }
      });
    }
    return d;
  }

  // Dummy alumni list
  const alumniSeedData = [
    // --- Brainware University: Class of 2026 (Batchmates of Patitpaban Roy) ---
    {
      phone: "+919800000001",
      name: "Ananya Sen",
      verificationStatus: "VERIFIED",
      institutionId: bwu.id,
      year: 2026,
      dept: "MCA",
      role: "Product Designer",
      company: "Swiggy",
      city: "Bengaluru",
      linkedinUrl: "https://linkedin.com/in/ananyasen",
      isOpenToMentor: true,
      mentorTopics: "Portfolio Review, UI/UX Design, Career Switch",
    },
    {
      phone: "+919800000002",
      name: "Sourav Ganguly",
      verificationStatus: "VERIFIED",
      institutionId: bwu.id,
      year: 2026,
      dept: "MCA",
      role: "Software Development Engineer",
      company: "Tata Consultancy Services (TCS)",
      city: "Kolkata",
      linkedinUrl: "https://linkedin.com/in/souravganguly-dev",
      isOpenToMentor: true,
      mentorTopics: "Fullstack Web, Java & Spring Boot, Campus Placements",
    },
    {
      phone: "+919800000003",
      name: "Debabrata Ghosh",
      verificationStatus: "UNVERIFIED",
      institutionId: bwu.id,
      year: 2026,
      dept: "MCA",
      role: "Data Analyst Intern",
      company: "Wipro",
      city: "Kolkata",
      linkedinUrl: "https://linkedin.com/in/debabrata-ghosh",
      isOpenToMentor: false,
    },

    // --- Brainware University: Senior & Junior Batches ---
    {
      phone: "+919800000004",
      name: "Rohan Mukherjee",
      verificationStatus: "VERIFIED",
      institutionId: bwu.id,
      year: 2024,
      dept: "B.Tech CSE",
      role: "SDE-2 (Cloud & Distributed Systems)",
      company: "Microsoft",
      city: "Hyderabad",
      linkedinUrl: "https://linkedin.com/in/rohanmukherjee",
      isOpenToMentor: true,
      mentorTopics: "System Design, Mock Interviews, Microsoft Referrals",
    },
    {
      phone: "+919800000005",
      name: "Pooja Banerjee",
      verificationStatus: "VERIFIED",
      institutionId: bwu.id,
      year: 2023,
      dept: "BCA",
      role: "Frontend Tech Lead",
      company: "Zomato",
      city: "Gurugram",
      linkedinUrl: "https://linkedin.com/in/poojabanerjee",
      isOpenToMentor: true,
      mentorTopics: "React & Next.js, Frontend Architecture, Tech Leadership",
    },
    {
      phone: "+919800000006",
      name: "Vikram Das",
      verificationStatus: "VERIFIED",
      institutionId: bwu.id,
      year: 2025,
      dept: "MCA",
      role: "AI / ML Research Engineer",
      company: "Infosys AI Labs",
      city: "Pune",
      linkedinUrl: "https://linkedin.com/in/vikramdas",
      isOpenToMentor: true,
      mentorTopics: "Machine Learning, Python, NLP",
    },

    // --- Other Institutions (For "All Institutions" Filter Testing) ---
    {
      phone: "+919800000007",
      name: "Sneha Roy",
      verificationStatus: "VERIFIED",
      institutionId: kgec.id,
      year: 2022,
      dept: "Computer Science",
      role: "Senior Consultant",
      company: "Deloitte India",
      city: "Mumbai",
      linkedinUrl: "https://linkedin.com/in/sneharoy-consulting",
      isOpenToMentor: true,
      mentorTopics: "Management Consulting, Corporate Strategy",
    },
    {
      phone: "+919800000008",
      name: "Arjun Mehta",
      verificationStatus: "VERIFIED",
      institutionId: ju.id,
      year: 2024,
      dept: "Information Technology",
      role: "Founder & CEO",
      company: "FinNext",
      city: "Bengaluru",
      linkedinUrl: "https://linkedin.com/in/arjunmehta-founder",
      isOpenToMentor: true,
      mentorTopics: "Startup Pitching, Seed Fundraising, 0 to 1 Product",
    },
  ];

  for (const person of alumniSeedData) {
    const batch = await getOrCreateBatch(person.institutionId, person.year);
    const dept = await getOrCreateDept(person.institutionId, person.dept);

    const existing = await prisma.user.findUnique({
      where: { phone: person.phone }
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          phone: person.phone,
          name: person.name,
          verificationStatus: person.verificationStatus,
          institutionId: person.institutionId,
          batchId: batch.id,
          batchYear: person.year,
          departmentId: dept.id,
          currentRole: person.role,
          currentCompany: person.company,
          city: person.city,
          linkedinUrl: person.linkedinUrl,
          isOpenToMentor: person.isOpenToMentor,
          mentorTopics: person.mentorTopics || null,
        }
      });
      console.log(`✓ Seeded: ${person.name} (${person.role} at ${person.company})`);
    } else {
      console.log(`- Exists: ${person.name}`);
    }
  }

  console.log("✨ Seed completed successfully!");
  await prisma.$disconnect();
}

seedDirectory().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
