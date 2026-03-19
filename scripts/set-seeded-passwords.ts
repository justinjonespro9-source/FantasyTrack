import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_PASSWORD = "Track123!";

const SEEDED_EMAILS = [
  "admin@fantasytrack.local",
  "alice@fantasytrack.local",
  "bob@fantasytrack.local",
  "charlie@fantasytrack.local",
  "dave@fantasytrack.local",
  "erin@fantasytrack.local",
  "frank@fantasytrack.local",
  "gina@fantasytrack.local",
  "drjonesj@yahoo.com",
] as const;

async function main() {
  console.log("Setting test password for seeded users...");

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const email of SEEDED_EMAILS) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (!user) {
      console.log(`⚠️  User not found, skipping: ${normalizedEmail}`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log(`✅ Updated password for: ${normalizedEmail}`);
  }

  console.log("Done. All existing seeded users above now share the same test password.");
}

main()
  .catch(async (err) => {
    console.error("Error setting seeded passwords:", err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

