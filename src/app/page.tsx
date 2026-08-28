import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

// Post-login routing per role (spec §4).
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "supplier") redirect("/supplier");
  if (user.role === "vlm" || user.role === "viewer") redirect("/vlm");
  redirect("/admin");
}
