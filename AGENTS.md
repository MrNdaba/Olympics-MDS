<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MDS — Master Delivery System (Dakar 2026 YOG)

Bilingual (FR default / EN) web platform for booking **deliveries and collections** at Dakar 2026
venues. Suppliers/transporters book venue time slots; Venue Logistics Managers (VLMs) validate and
monitor; Administrators manage users, venues, and master data.

## Stack

- **Next.js 16 (App Router) + TypeScript + React 19** — server-enforced rules via route handlers /
  server actions. This is Next.js 16: read `node_modules/next/dist/docs/` before using framework APIs.
- **Prisma ORM** with **SQLite now, Postgres-ready.** To keep the Postgres migration trivial, the
  schema avoids SQLite-only gaps: **no Prisma `enum`s and no scalar arrays** — use `String` columns
  constrained by TypeScript union types in `src/lib/constants.ts`. Switching to Postgres = change the
  `datasource` provider + `DATABASE_URL`, then re-run migrations.

## Commands

- `npm run dev` — dev server
- `npm run build` / `npm start` — production build & serve
- `npm run lint` — ESLint
- `npx prisma migrate dev` — apply schema changes · `npx prisma db seed` — load seed data
- `npx prisma studio` — inspect the database

## Authoritative sources — read before coding

- **[specification.md](specification.md) is the single source of truth** for all functional rules,
  the domain model, seed data (venues §7, compound/gate routing §8, operating hours §10), security
  requirements (§19), and acceptance criteria (§22). Implement against this document. When code and
  spec disagree, the spec wins.
- **[design_handoff_mds/README.md](design_handoff_mds/README.md)** is the authoritative design intent
  (layout, tokens, copy, behavior) for the 5 core screens. Recreate the designs pixel-faithfully —
  do **not** copy the prototype HTML directly.
- **[design_handoff_mds/MDS Screens.dc.html](design_handoff_mds/MDS%20Screens.dc.html)** is a design
  canvas, not production code. The complete **FR + EN string dictionaries live in the `class Component`
  script at the bottom** — reuse them verbatim as the seed for the app's i18n resource files.
- Screens not yet designed (Admin screens, VLM venue management, dialogs, PDF/OTP/daily list) must be
  designed from the spec plus the established design patterns in the README.

## Non-negotiable rules (common mistakes to avoid)

- **Never hard-delete a booking** — at any role. Bookings are only ever *cancelled* (preserves audit
  trail). See §12, §19.
- **Booking reference** `OLY-{SITE}-{NNNNNN}` (spec D1): the 6-digit numeric is a single globally
  unique sequence, assigned once and **immutable**. A venue amendment updates only the 3-letter site
  segment; never mint a new number for an existing booking.
- **Authorization is always server-side.** Venue scoping is enforced on every query and mutation; a
  VLM must never read or act outside their assigned venue(s). Client-side checks are UX only.
- **Capacity = one vehicle per venue per slot, venue-wide** (D8) — not per compound or gate. Enforce
  with a unique constraint on `venueId + slotStart` for active holds; reserve atomically in a
  transaction (concurrency is an explicit acceptance criterion, §9/§23).
- **Slot rules (§9):** contiguous slots only, cumulative ≤ 2 h, displayed as one merged window
  (e.g. `10:00 → 11:30`) — never as individual slots. Unavailable slots must never render as
  selectable.
- **Time is always Senegal local (GMT/UTC+00:00, no DST)** for every date, slot, dashboard, export,
  audit timestamp, and expiry calc — regardless of the client's locale (§18). Store UTC, render
  `Africa/Dakar`.
- **French is the default language.** Every label, status, message, and validation error must exist
  in FR and EN.
- **Terminology:** use "**booking type**" everywhere (never "movement type"); it must appear as a
  labelled column in every list, dashboard, and export (§11.2, §17).
- **Never log** passwords, OTP codes, or session tokens. Emit structured (JSON) audit logs with
  actor, timestamp, and outcome (§19).
- Notifications and OTP channels go through **provider interfaces** stubbed in dev/test (write to a
  `NotificationOutbox`) — no real messages leave non-production environments (D7).

## Design tokens (quick reference)

Full tokens are in the design README and mirrored as CSS variables in `src/app/globals.css`. Primary
brand: COJOJ Blue `#0078D0` (hover `#0064AE`). Status palette (doubles as flag palette): Confirmed
`#00A651`, Pending `#E08A00`, Cancelled `#E31B23`, Expired `#9AA7B2`. UI font **Archivo**;
numbers/refs/times **IBM Plex Mono**. Logo at
[design_handoff_mds/assets/dakar2026-logo.png](design_handoff_mds/assets/dakar2026-logo.png) — always
on a white surface.
