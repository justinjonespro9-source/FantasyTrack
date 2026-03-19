import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "Test123!";

async function main() {
  console.log("Fetching all users to reset passwords for local testing...");

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("No users found. Nothing to update.");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  console.log(`Updated password for ${users.length} users:`);
  for (const user of users) {
    console.log(`- ${user.email}`);
  }
}

main()
  .catch(async (err) => {
    console.error("Error setting all user passwords:", err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

