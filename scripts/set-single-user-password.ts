import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "drjonesj@yahoo.com";
const PASSWORD = "Track123!";

async function main() {
  const normalizedEmail = EMAIL.toLowerCase().trim();

  console.log(`Setting password for user: ${normalizedEmail}`);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log("User not found.");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`Successfully updated password for user: ${normalizedEmail}`);
}

main()
  .catch(async (err) => {
    console.error("Error setting single user password:", err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

