import bcrypt from "bcryptjs";
import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const displayNameEnv = process.env.ADMIN_DISPLAY_NAME?.trim();
  const realNameEnv = process.env.ADMIN_REAL_NAME?.trim();
  const phoneEnv = process.env.ADMIN_PHONE?.trim();
  const startingGrantRaw = process.env.ADMIN_WALLET_GRANT?.trim();

  if (!email) {
    console.error(
      "ADMIN_EMAIL is required. Example:\n" +
        'ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="strong-password" npm run prisma:bootstrap-admin'
    );
    return;
  }

  const displayName = displayNameEnv || "Admin";
  const realName = realNameEnv || displayName;
  const phone = phoneEnv || "000-000-0000";

  const startingGrant =
    startingGrantRaw && !Number.isNaN(Number(startingGrantRaw))
      ? Number(startingGrantRaw)
      : 0;

  console.log(`Bootstrapping admin user for email: ${email}`);

  // Find or create the admin user
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    if (!password) {
      console.error(
        "Admin user does not exist and ADMIN_PASSWORD was not provided. Cannot create admin without a password."
      );
      return;
    }

    console.log("Admin user not found. Creating new admin user.");
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName,
        realName,
        phone,
        isAdmin: true,
      },
    });
  } else {
    console.log("User already exists. Ensuring admin flag is set and password updated if provided.");
    const updateData: { isAdmin: boolean; passwordHash?: string } = {
      isAdmin: true,
    };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (!user.isAdmin || password) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }
  }

  // Optionally grant starting coins once, idempotently
  if (startingGrant > 0) {
    const note = "Bootstrap admin grant";
    const existingGrantCount = await prisma.transaction.count({
      where: {
        userId: user.id,
        type: TransactionType.GRANT,
        note,
      },
    });

    if (existingGrantCount === 0) {
      console.log(
        `Granting starting wallet amount of ${startingGrant} coins to admin.`
      );
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.GRANT,
          amount: startingGrant,
          note,
        },
      });
    } else {
      console.log(
        "Bootstrap grant already exists for this admin user. Skipping grant."
      );
    }
  } else {
    console.log("No starting grant configured. Skipping wallet grant.");
  }

  console.log("Bootstrap admin complete.");
}

main()
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

