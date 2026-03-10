import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(3).max(50).optional()
  })
  .refine(
    (data) => data.displayName !== undefined || data.email !== undefined || data.phone !== undefined,
    { message: "At least one field must be provided." }
  );

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = updateSchema.parse(await req.json());

    const data: Record<string, any> = {};
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;

    await prisma.user.update({
      where: {
        id: session.user.id
      },
      data
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}

