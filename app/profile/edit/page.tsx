import { redirect } from "next/navigation";
import ProfileEditForm from "@/components/profile/profile-edit-form";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      email: true,
      phone: true,
    },
  });

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 sm:p-5">
        <ProfileEditForm
          initialDisplayName={user.displayName}
          initialEmail={user.email}
          initialPhone={user.phone}
        />
      </section>
    </div>
  );
}

