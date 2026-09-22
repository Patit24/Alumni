import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfileIndexPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  redirect(`/profile/${user.id}`);
}
