import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

// Admin has VLM rights across all venues (Register #5). Cross-venue dashboard
// and bookings are served by the venue-scoped VLM routes (admin bypasses scope).
export default async function AdminPage() {
  await requireRole("admin");
  redirect("/vlm/dashboard");
}
