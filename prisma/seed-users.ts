import bcrypt from "bcryptjs";
import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(params: {
  email: string;
  password: string;
  displayName: string;
  realName: string;
  phone: string;
  isAdmin?: boolean;
}) {
  const { email, password, displayName, realName, phone, isAdmin = false } = params;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      realName,
      phone,
      isAdmin,
      passwordHash,
    },
    create: {
      email,
      passwordHash,
      displayName,
      realName,
      phone,
      isAdmin,
    },
  });

  return user;
}

async function ensureSeedGrant(userId: string, adminId: string) {
  const existingGrant = await prisma.transaction.findFirst({
    where: {
      userId,
      type: TransactionType.GRANT,
      note: "Seed starting balance",
    },
  });

  if (existingGrant) return;

  await prisma.transaction.create({
    data: {
      userId,
      type: TransactionType.GRANT,
      amount: 10000,
      note: "Seed starting balance",
      createdByAdminId: adminId,
    },
  });
}

async function main() {
  // Admin
  const admin = await upsertUser({
    email: "admin@fantasytrack.local",
    password: "admin123",
    displayName: "Commissioner",
    realName: "Admin User",
    phone: "555-000-0000",
    isAdmin: true,
  });

  // Non-admin test users
  const alice = await upsertUser({
    email: "alice@fantasytrack.local",
    password: "alice123",
    displayName: "AliceSkates",
    realName: "Alice Demo",
    phone: "555-111-2222",
  });

  const bob = await upsertUser({
    email: "bob@fantasytrack.local",
    password: "bob123",
    displayName: "BobPlays",
    realName: "Bob Demo",
    phone: "555-333-4444",
  });

  const charlie = await upsertUser({
    email: "charlie@fantasytrack.local",
    password: "charlie123",
    displayName: "CharlieTracks",
    realName: "Charlie Demo",
    phone: "555-444-5555",
  });

  const dave = await upsertUser({
    email: "dave@fantasytrack.local",
    password: "dave123",
    displayName: "DaveTracks",
    realName: "Dave Demo",
    phone: "555-555-6666",
  });

  const erin = await upsertUser({
    email: "erin@fantasytrack.local",
    password: "erin123",
    displayName: "ErinTracks",
    realName: "Erin Demo",
    phone: "555-666-7777",
  });

  const frank = await upsertUser({
    email: "frank@fantasytrack.local",
    password: "frank123",
    displayName: "FrankTracks",
    realName: "Frank Demo",
    phone: "555-777-8888",
  });

  const gina = await upsertUser({
    email: "gina@fantasytrack.local",
    password: "gina123",
    displayName: "GinaTracks",
    realName: "Gina Demo",
    phone: "555-888-9999",
  });

  // Ensure single seed grant per user (idempotent)
  for (const user of [alice, bob, charlie, dave, erin, frank, gina]) {
    await ensureSeedGrant(user.id, admin.id);
  }

  console.log("Seed-users complete (non-destructive).");
  console.log("Admin login: admin@fantasytrack.local / admin123");
  console.log("User login: alice@fantasytrack.local / alice123");
  console.log("User login: bob@fantasytrack.local / bob123");
  console.log("User login: charlie@fantasytrack.local / charlie123");
  console.log("User login: dave@fantasytrack.local / dave123");
  console.log("User login: erin@fantasytrack.local / erin123");
  console.log("User login: frank@fantasytrack.local / frank123");
  console.log("User login: gina@fantasytrack.local / gina123");
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

