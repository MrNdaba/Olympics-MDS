/* MDS seed — venues (§7), compound/gate routing (§8), operating hours (§10),
   master data, demo users, and a few demo bookings. All times are Dakar (UTC). */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const DAY_MS = 86_400_000;
const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const at = (day: Date, hm: string) => {
  const [h, mn] = hm.split(":").map(Number);
  return new Date(day.getTime() + (h * 60 + mn) * 60_000);
};

// ── Venues (spec §7) ──────────────────────────────────────────────────────────
const VENUES: { name: string; code: string; city: string }[] = [
  { name: "Tour de l'Œuf Complex", code: "CTO", city: "Dakar" },
  { name: "Iba Mar Diop Sports Complex", code: "CID", city: "Dakar" },
  { name: "Corniche Ouest", code: "COR", city: "Dakar" },
  { name: "Dakar Expo Center", code: "DEX", city: "Diamniadio" },
  { name: "Stade Abdoulaye Wade", code: "SAW", city: "Diamniadio" },
  { name: "Equestrian Centre", code: "CED", city: "Diamniadio" },
  { name: "Dakar Arena", code: "DAR", city: "Diamniadio" },
  { name: "Saly Beach West", code: "SBW", city: "Saly" },
  { name: "Youth Olympic Village", code: "YOV", city: "Diamniadio" },
  { name: "Main Logistic Hub", code: "MLH", city: "Diamniadio" },
];

// ── Routing (spec §8): [department, compound, gate] per site ──────────────────
const ROUTING: Record<string, [string, string, string][]> = {
  SBW: [
    ["LOG", "Logistics Compound", "BCT"],
    ["LOG", "Logistics Compound", "WP"],
    ["FNB", "FNB Compound", "WP"],
    ["MKT", "MKT002", "WP"],
    ["MKT", "MKT001", "WP"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  CTO: [
    ["LOG", "Logistics Compound", "VSA 2"],
    ["FNB", "FNB Compound", "VSA 2"],
    ["MKT", "MKT002", "VSA 2"],
    ["MKT", "MKT001", "VSA 2"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  CID: [
    ["LOG", "Logistics Compound", "VSA 1"],
    ["FNB", "FNB Compound", "VSA 1"],
    ["MKT", "MKT002", "VSA 1"],
    ["MKT", "MKT001", "VSA 1"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  DEX: [
    ["LOG", "Logistics Compound", "VSA 1"],
    ["FNB", "FNB Compound", "VSA 2"],
    ["MKT", "MKT002", "VSA 1"],
    ["MKT", "MKT001", "VSA 1"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  SAW: [
    ["LOG", "Logistics Compound", "VSA 2"],
    ["FNB", "FNB Compound", "VSA 2"],
    ["MKT", "MKT002", "VSA 2"],
    ["MKT", "MKT001", "VSA 2"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  CED: [
    ["LOG", "Logistics Compound", "VSA 2"],
    ["LOG", "Logistics Compound", "VSA 3"],
    ["FNB", "FNB Compound", "VSA 2"],
    ["FNB", "FNB Compound", "VSA 3"],
    ["MKT", "MKT002", "VSA 2"],
    ["MKT", "MKT001", "VSA 2"],
    ["MKT", "MKT002", "VSA 3"],
    ["MKT", "MKT001", "VSA 3"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  DAR: [
    ["LOG", "Logistics Compound", "VSA 2"],
    ["FNB", "FNB Compound", "VSA 2"],
    ["MKT", "MKT002", "VSA 2"],
    ["MKT", "MKT001", "VSA 2"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  YOV: [
    ["LOG", "Logistics Compound", "VSA 1"],
    ["FNB", "FNB Compound Workforce", "VSA 2"],
    ["FNB", "FNB Compound Athlete Dining", "VSA 2"],
    ["MKT", "MKT002", "VSA 2"],
    ["MKT", "MKT001", "VSA 2"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  COR: [
    ["LOG", "Logistics Compound", "OTHER"],
    ["FNB", "FNB Compound", "OTHER"],
    ["MKT", "MKT002", "OTHER"],
    ["MKT", "MKT001", "OTHER"],
    ["OTHER", "OTHER", "OTHER"],
  ],
  // MLH is absent from §8; give it a minimal LOG route + reserve.
  MLH: [
    ["LOG", "Logistics Compound", "OTHER"],
    ["OTHER", "OTHER", "OTHER"],
  ],
};

// ── Game-period hours (spec §10). Column order matches SITES_ORDER. ────────────
const SITES_ORDER = ["CTO", "SAW", "CID", "DAR", "DEX", "COR", "CED", "SBW", "YOV"];
const C = "Closed";
const GAME_HOURS: [number, string[]][] = [
  [28, [C, C, C, C, C, C, C, C, "08:00-18:00"]],
  [29, [C, C, C, C, "10:00-19:00", C, "08:30-11:30", "08:00-17:00", "08:00-18:00"]],
  [30, ["10:00-17:45", C, C, "08:00-20:00", "09:00-19:00", C, "08:30-11:30", "08:00-17:00", "09:00-17:00"]],
  [31, ["08:30-14:15", C, C, "09:00-15:00", "09:00-15:00", C, "08:30-11:30", "07:30-15:10", "09:00-13:00"]],
];
// Oct days 28–31 above; Nov days 1–13 below (month = 11).
const GAME_HOURS_NOV: [number, string[]][] = [
  [1, ["10:30-17:45", C, "10:00-19:30", "09:00-18:55", "09:30-19:30", C, "08:30-10:30", "07:30-16:50", "08:00-18:00"]],
  [2, ["10:30-17:45", C, "10:00-19:30", "09:00-18:55", "09:30-19:00", C, "08:30-10:30", "07:30-17:00", "08:00-18:00"]],
  [3, ["10:30-17:45", C, "09:40-19:30", "09:00-18:55", "09:30-19:15", C, "08:00-10:30", "07:30-17:00", "08:00-18:00"]],
  [4, ["10:30-17:20", "09:00-18:00", "10:00-19:30", "09:00-18:45", "10:00-18:00", C, "08:30-10:30", "08:00-16:30", "08:00-18:00"]],
  [5, ["10:30-17:20", "09:00-18:00", "10:00-19:30", "14:00-18:45", "08:00-19:20", C, "08:00-11:00", "09:00-19:00", "08:00-18:00"]],
  [6, ["10:00-17:40", "09:30-12:00", C, C, "08:00-17:00", C, "08:00-12:00", "09:00-19:00", "08:00-18:00"]],
  [7, ["10:00-17:40", "09:00-17:45", C, "10:00-19:30", "08:00-19:30", "09:00-11:00", C, "09:00-17:50", "08:00-18:00"]],
  [8, ["11:30-16:40", "10:00-16:30", "11:00-18:00", "10:00-17:00", "08:00-19:30", "09:00-13:30", C, "09:00-17:50", "08:00-18:00"]],
  [9, ["11:30-16:40", "10:00-16:30", "10:00-18:00", "11:00-17:00", "08:30-19:30", C, C, "09:30-17:30", "08:00-18:00"]],
  [10, ["11:00-16:00", "09:00-17:30", "10:00-19:00", C, "09:00-20:00", "09:00-12:20", C, "10:00-17:00", "08:00-18:00"]],
  [11, ["11:00-16:00", C, "11:00-19:00", "11:00-17:00", "09:00-19:30", C, C, "10:00-17:10", "08:00-18:00"]],
  [12, ["11:00-17:30", C, "11:00-18:15", "11:00-17:00", "09:00-19:30", C, C, "10:00-17:20", "08:00-18:00"]],
  [13, ["10:00-12:45", C, C, C, "09:00-13:00", C, C, "09:30-14:06", "08:00-18:00"]],
];

const MASTER_DATA: Record<string, string[]> = {
  vehicleType: ["Van — 3.5 t", "Truck 7.5 t", "Heavy truck 19 t", "Semi-trailer", "Refrigerated truck"],
  merchandiseType: ["Catering (F&B)", "Sports equipment", "Marketing / POS", "Furniture", "Technical equipment", "Cleaning products"],
  packagingType: ["Pallet", "Box", "Roll cage / container", "Bulk", "Crate"],
  loadUnit: ["kg", "m³", "units", "pallets"],
};

async function reset() {
  // Idempotent seed: clear in FK-safe order.
  await prisma.slotHold.deleteMany();
  await prisma.bookingAuditEntry.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.notificationOutbox.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.session.deleteMany();
  await prisma.compoundGate.deleteMany();
  await prisma.gate.deleteMany();
  await prisma.compound.deleteMany();
  await prisma.operatingDay.deleteMany();
  await prisma.venueAssignment.deleteMany();
  await prisma.masterData.deleteMany();
  await prisma.referenceSequence.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await reset();

  // Venues + routing.
  const venueByCode: Record<string, string> = {};
  for (const v of VENUES) {
    const venue = await prisma.venue.create({
      data: { name: v.name, siteCode: v.code, city: v.city, status: "active" },
    });
    venueByCode[v.code] = venue.id;

    const routes = ROUTING[v.code] ?? [];
    const compoundIds = new Map<string, string>(); // dept|label -> id
    const gateIds = new Map<string, string>(); // label -> id
    for (const [dept, compoundLabel, gateLabel] of routes) {
      const cKey = `${dept}|${compoundLabel}`;
      let compoundId = compoundIds.get(cKey);
      if (!compoundId) {
        const compound = await prisma.compound.create({
          data: { venueId: venue.id, department: dept, label: compoundLabel },
        });
        compoundId = compound.id;
        compoundIds.set(cKey, compoundId);
      }
      let gateId = gateIds.get(gateLabel);
      if (!gateId) {
        const gate = await prisma.gate.create({
          data: { venueId: venue.id, label: gateLabel },
        });
        gateId = gate.id;
        gateIds.set(gateLabel, gateId);
      }
      await prisma.compoundGate.create({ data: { compoundId, gateId } });
    }
  }

  // Operating hours: bump-in 08:00–18:00 for 01 Jul → 27 Oct 2026.
  const bumpStart = utcDay(2026, 7, 1);
  const bumpEnd = utcDay(2026, 10, 27);
  for (let t = bumpStart.getTime(); t <= bumpEnd.getTime(); t += DAY_MS) {
    const date = new Date(t);
    for (const code of Object.keys(venueByCode)) {
      await prisma.operatingDay.create({
        data: { venueId: venueByCode[code], date, openTime: "08:00", closeTime: "18:00", active: true },
      });
    }
  }

  // Game period (competition venues from the matrix; blank = closed = no record).
  const applyGameRow = (day: Date, values: string[]) => {
    return Promise.all(
      SITES_ORDER.map((code, i) => {
        const val = values[i];
        if (val === C) return null;
        const [open, close] = val.split("-");
        return prisma.operatingDay.create({
          data: { venueId: venueByCode[code], date: day, openTime: open, closeTime: close, active: true },
        });
      }).filter(Boolean) as Promise<unknown>[],
    );
  };
  for (const [d, values] of GAME_HOURS) await applyGameRow(utcDay(2026, 10, d), values);
  for (const [d, values] of GAME_HOURS_NOV) await applyGameRow(utcDay(2026, 11, d), values);
  // MLH 08:00–18:00 daily across the game period.
  for (let t = utcDay(2026, 10, 28).getTime(); t <= utcDay(2026, 11, 13).getTime(); t += DAY_MS) {
    await prisma.operatingDay.create({
      data: { venueId: venueByCode["MLH"], date: new Date(t), openTime: "08:00", closeTime: "18:00", active: true },
    });
  }

  // Master data.
  for (const [category, labels] of Object.entries(MASTER_DATA)) {
    for (const label of labels) {
      await prisma.masterData.create({ data: { category, label } });
    }
  }

  // Users (accounts created by Admin; demo password satisfies staff 12-char rule).
  const passwordHash = await bcrypt.hash("Password1234!", 12);
  const admin = await prisma.user.create({
    data: { email: "admin@mds.dev", name: "Admin COJOJ", role: "admin", passwordHash, mustChangePassword: false },
  });
  const vlm = await prisma.user.create({
    data: {
      email: "vlm.dar@mds.dev",
      name: "VLM Dakar Arena",
      role: "vlm",
      passwordHash,
      mustChangePassword: false,
      venueAssignments: { create: [{ venueId: venueByCode["DAR"] }] },
    },
  });
  const supplier = await prisma.user.create({
    data: { email: "supplier@mds.dev", name: "Fournisseur A", role: "supplier", passwordHash, mustChangePassword: false },
  });

  // Demo bookings at Dakar Arena (bump-in period → 08:00–18:00 slots).
  const darId = venueByCode["DAR"];
  const logCompound = await prisma.compound.findFirst({ where: { venueId: darId, department: "LOG" } });
  const vsa2 = await prisma.gate.findFirst({ where: { venueId: darId, label: "VSA 2" } });

  const demo = [
    { type: "delivery", status: "Confirmed", day: utcDay(2026, 7, 20), from: "09:00", to: "10:00", merch: "Catering (F&B)" },
    { type: "collection", status: "Confirmed", day: utcDay(2026, 7, 21), from: "13:00", to: "13:30", merch: "Sports equipment" },
    { type: "delivery", status: "PendingValidation", day: utcDay(2026, 7, 16), from: "10:00", to: "11:30", merch: "Marketing / POS" },
  ];
  let refN = 0;
  for (const b of demo) {
    refN += 1;
    const slotStart = at(b.day, b.from);
    const slotEnd = at(b.day, b.to);
    const booking = await prisma.booking.create({
      data: {
        reference: `OLY-DAR-${String(refN).padStart(6, "0")}`,
        refNumber: refN,
        siteCode: "DAR",
        type: b.type,
        status: b.status,
        supplierName: "Fournisseur A",
        transporterName: "Transporteur B",
        transporterContact: "+221 77 000 00 00",
        vehicleType: "Van — 3.5 t",
        merchandiseType: b.merch,
        venueId: darId,
        compoundId: logCompound!.id,
        gateId: vsa2!.id,
        serviceDate: b.day,
        slotStart,
        slotEnd,
        createdById: supplier.id,
        auditEntries: { create: [{ userId: supplier.id, action: "created", newStatus: b.status }] },
      },
    });
    for (let t = slotStart.getTime(); t < slotEnd.getTime(); t += 30 * 60_000) {
      await prisma.slotHold.create({
        data: { venueId: darId, slotStart: new Date(t), bookingId: booking.id },
      });
    }
  }
  await prisma.referenceSequence.create({ data: { id: 1, value: refN } });

  console.log(
    `Seeded ${VENUES.length} venues, master data, users (admin@/vlm.dar@/supplier@mds.dev · Password1234!), and ${demo.length} demo bookings.`,
  );
  void admin;
  void vlm;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
