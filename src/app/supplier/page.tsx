import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { getActiveVenues } from "@/lib/venues";
import { MASTER_DATA_CATEGORIES } from "@/lib/constants";
import { dayIso } from "@/lib/time";
import { TopBar, type NavItem } from "@/components/TopBar";
import { BookingForm } from "@/components/BookingForm";
import { supplierNav } from "@/lib/nav";

async function masterList(category: string): Promise<string[]> {
  const rows = await prisma.masterData.findMany({
    where: { category, active: true },
    orderBy: { label: "asc" },
  });
  return rows.map((r) => r.label);
}

export default async function SupplierPage() {
  const user = await requireRole("supplier");
  const { lang, t } = await getTranslations();

  const [venues, vehicleTypes, merchTypes, packTypes] = await Promise.all([
    getActiveVenues(),
    masterList(MASTER_DATA_CATEGORIES[0]),
    masterList(MASTER_DATA_CATEGORIES[1]),
    masterList(MASTER_DATA_CATEGORIES[2]),
  ]);

  const nav: NavItem[] = supplierNav("new", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1320, margin: "0 auto" }}>
        <BookingForm
          t={t}
          lang={lang}
          venues={venues}
          supplierName={user.name}
          vehicleTypes={vehicleTypes}
          merchTypes={merchTypes}
          packTypes={packTypes}
          defaultDate={dayIso(new Date())}
        />
      </main>
    </div>
  );
}
