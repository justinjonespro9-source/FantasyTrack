import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { STARTING_COINS } from "@/lib/constants";

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  realName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(30),
  password: z.string().min(8).max(128)
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const input = registerSchema.parse(json);

    const normalizedEmail = input.email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: {
        email: normalizedEmail
      },
      select: {
        id: true
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Email already registered." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          displayName: input.displayName,
          realName: input.realName,
          phone: input.phone,
          passwordHash: await bcrypt.hash(input.password, 10)
        },
        select: {
          id: true
        }
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.GRANT,
          amount: STARTING_COINS,
          note: "Welcome bonus"
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid input." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to register." }, { status: 500 });
  }
}
