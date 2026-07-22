# Master Delivery System (MDS) — Build Specification

**Dakar 2026 Youth Olympic Games · Consolidated specification for design & implementation**

| | |
|---|---|
| Derived from | MDS Functional Specification Book v1.4 (Final, 26 Jun 2026) |
| Incorporates | Clarification Register v1.3 ops decisions (29 Jun 2026), RTP_MDS (REQ-01…REQ-17), Secure Development Policy P&P.CYB.032, Game-period operating-hours workbook |
| Intended consumers | Claude Design (screens & flows), Claude Code (implementation) |
| Status | Ready for design handoff |

---

## 1. Purpose

A controlled, auditable, bilingual (FR/EN) web platform for booking **deliveries and collections** at Dakar 2026 venues. Suppliers/transporters book venue time slots; Venue Logistics Managers (VLMs) validate, monitor, and manage venue capacity; Administrators manage users, master data, and venues. Gate operators are **not** system users — they work from printed/exported daily booking lists.

Business goals: reduce venue congestion, prevent overbooking, give operations real-time visibility, and enforce venue-scoped role-based access.

## 2. Scope

**In scope:** supplier/transporter accounts; delivery & collection booking (create, amend, cancel); venue, compound, gate and slot administration; booking validation workflow; role-based access with venue scoping; dashboards; Excel/PDF export of booking lists; bilingual UI (French default, English); email + SMS-capable OTP at login; audit logging.

**Out of scope (baseline):** payments, QR-code validation, tablet gate processing, digital arrival capture, offline check-in, booking deletion (at any role level — bookings are only ever cancelled), advanced analytics beyond operational reporting.

## 3. Resolved decisions

These points were ambiguous or contradictory across source documents. They are **settled as follows** and the rest of this spec is written against them. If any decision is overturned, only the referenced section needs revision.

| # | Decision | Rationale / source |
|---|----------|--------------------|
| D1 | **Booking reference** = `OLY-{SITE}-{NNNNNN}`. The 6-digit numeric part is a single **globally unique sequence** assigned at creation and **never changes**. On venue amendment only the site-code segment updates (e.g. `OLY-CID-001027` → `OLY-DAR-001027`). No new numeric is ever generated for an existing booking. | Register #1 decision ("numeric part globally unique") + worked example in v1.4 §7. The v1.4 phrase "can generate a new numeric number" is superseded. |
| D2 | **OTP at login for all roles.** Default channel is **email**; SMS is supported behind a pluggable OTP-channel interface (see §14.3) so a gateway can be added without code change. Password policy: suppliers ≥ 8 chars, VLM/Admin ≥ 12 chars (both with upper/lower/digit/special); lockout after 5 failed attempts; auto-logout after 30 min inactivity. | Register #8 decision ("2FA at login, email or SMS") supersedes v1.4 §6.1 unlock-only wording; RTP REQ-06/REQ-07. |
| D3 | **Manual status correction** is restricted to canonical transitions **plus one audited exception**: `Cancelled → Confirmed` (reinstatement of a wrongly-cancelled booking), VLM/Admin only, mandatory reason, and the target slot's availability is re-checked before commit. `Expired` is terminal. | v1.4 §6.6 vs §7; Register #5 (Admin = VLM rights). |
| D4 | **YOV operating hours** are seeded with the bump-in default `08:00–18:00` for all game-period days marked TBC, editable by the YOV VLM. **Blank cells** in the hours workbook mean the venue is **closed** to deliveries/collections that day (no slots generated). | Hours workbook; v1.4 §6.5. |
| D5 | **Geo-IP restriction to Senegal** (RTP REQ-12) is an **infrastructure control with a documented accepted exception** for external supplier/transporter access. The application does not implement geo-blocking; it enforces its own authentication controls regardless of network posture. | RTP REQ-12 ("where possible… justified and explicitly accepted"); suppliers book internationally. |
| D6 | Requirements are split into **application (dev-facing)** requirements (§14) and **infrastructure & operations obligations** (§15). Claude Code implements §14; §15 is delivered by hosting/ops (AGL/COJOJ) and the app only needs to be *compatible* with it (structured logs, health endpoints, backup-friendly storage). | RTP; P&P.CYB.032. |
| D7 | **Notifications (email/SMS) are abstracted behind a provider interface** and stubbed in dev/test (logged to console + persisted to an outbox table). No real messages leave non-production environments (P&P.CYB.032: prod data & channels forbidden in DEV/TEST). | P&P.CYB.032 §3.3. |
| D8 | **Capacity = one vehicle per venue per slot**, venue-wide — not per compound, not per gate. If a vehicle holds the 08:00–08:30 slot at Dakar Arena (any compound), no other vehicle can book any compound at Dakar Arena for that window. | Register #2 decision; v1.4 §6.7.1. |

## 4. Users, roles & permissions

Three authenticated roles. All roles authenticate with email + password + OTP (D2). Accounts are created only by Administrators (no self-registration).

| Capability | Supplier/Transporter | VLM Validator | Administrator |
|---|:-:|:-:|:-:|
| Create delivery/collection booking | ✔ (own) | — | — |
| View bookings | own only | assigned venue(s) | all venues |
| Amend booking (pre-slot) | ✔ (own) | ✔ (assigned venues) | ✔ |
| Cancel booking (pre-slot) | ✔ (own) | ✔ (assigned venues) | ✔ |
| Validate pending bookings | — | ✔ (assigned venues) | ✔ |
| Manual status correction (D3) | — | ✔ (assigned venues) | ✔ |
| Dashboard | own bookings summary | assigned venue(s) | all venues |
| Print/export daily booking list | — | ✔ (assigned venues) | ✔ |
| Maintain venue operating hours, slot durations, booking windows, compounds & gates | — | ✔ (assigned venues) | ✔ |
| Create/activate/deactivate venues | — | — | ✔ |
| User administration (create, update, deactivate, reset credentials) | — | — | ✔ |
| Master data (products, goods types, vehicle types, load units) | — | — | ✔ |
| Delete a booking record | ✖ never | ✖ never | ✖ never |

**Venue scoping is enforced server-side** on every query and mutation: a VLM can never read or act on a venue outside their assignment, regardless of UI state or crafted requests.

**Post-login routing:** Admin → dashboard · Supplier/Transporter → booking workspace · VLM → bookings + dashboard for assigned venue(s). Unauthenticated access to protected routes redirects to login.

## 5. Authentication & account management

1. Admin creates the user profile (role, venue assignments for VLMs) and issues initial credentials; the user must change the password at first login.
2. Login = email + password, then a one-time code (6 digits, 10-minute validity, single use) delivered via the user's configured channel (email default; SMS if configured and gateway available — D2).
3. **Account lockout** after 5 consecutive failed password or OTP attempts. Unlock: via a fresh OTP challenge (self-service) or by an Administrator credential reset.
4. **Session**: server-side session or short-lived tokens; absolute inactivity timeout 30 minutes; logout invalidates the session server-side.
5. **Password rules**: min 8 chars (suppliers) / 12 chars (VLM & Admin); must contain uppercase, lowercase, digit, special character. Passwords stored only as salted adaptive hashes (bcrypt/argon2 class). Password change and contact-details update available to every role under Settings.
6. Deactivated accounts cannot authenticate; deactivation does not touch their historical bookings or audit entries.

## 6. Domain model

Core entities (minimum fields; implementation may extend):

- **User** — id, email (unique), name, role, phone, otpChannel (email|sms), passwordHash, status (active|locked|deactivated), venueAssignments[] (VLM only), createdAt.
- **Venue** — id, name, siteCode (3-letter, unique), city, status (active|inactive), defaultSlotDurationMinutes (default 30).
- **OperatingDay** — venueId, date, openTime, closeTime, active. Absence of a record (or active=false) = closed that day (D4). Maintained by VLM/Admin.
- **Compound (drop-off / collection location)** — venueId, department (LOG|FNB|MKT|OTHER), label (e.g. "Logistics Compound", "MKT001").
- **Gate** — venueId, label (e.g. VSA 1, VSA 2, BCT, WP, OTHER); linked to compounds via the venue routing table (§8).
- **Slot** — venueId, date, startTime, endTime, capacity (fixed 1 — D8), status (available|held|closed). Generated from OperatingDay + slot duration.
- **Booking** — id, reference (D1), type (delivery|collection), status (PendingValidation|Confirmed|Cancelled|Expired), supplier fields, transporter fields, vehicleType, merchandiseType, packagingType?, quantity?, weightKg?, volumeM3?, venueId, compoundId, gateId, serviceDate, slotStart, slotEnd (contiguous slots collapsed to one window), comments?, createdBy, createdAt.
- **BookingAuditEntry** — bookingId, timestamp, userId, action (created|amended|statusChanged|cancelled|reinstated), previousStatus, newStatus, previousVenue/date/slot, newVenue/date/slot, reason (free text; mandatory for cancellations by VLM, corrections, reinstatements).
- **NotificationOutbox** — id, channel (email|sms|inApp), recipient, template, payload, status (queued|sent|failed|stubbed), createdAt (D7).
- **MasterData** — vehicle types, merchandise/goods types, packaging types, load units (admin-maintained drop-down sources).
- **ReferenceSequence** — single global counter backing the numeric part of booking references (D1); increment must be atomic/transaction-safe.

## 7. Venues & site codes

| Site name | Code | Type |
|---|---|---|
| Tour de l'Œuf Complex | CTO | Competition |
| Iba Mar Diop Sports Complex | CID | Competition |
| Corniche Ouest | COR | Competition |
| Dakar Expo Center | DEX | Competition |
| Stade Abdoulaye Wade | SAW | Competition |
| Equestrian Centre | CED | Competition |
| Dakar Arena | DAR | Competition |
| Saly Beach West | SBW | Competition |
| Youth Olympic Village | YOV | Non-competition |
| Main Logistic Hub | MLH | Non-competition |

## 8. Compound & gate routing (seed data)

Booking flow: user selects **venue → drop-off/collection location (compound) → access gate**. Only combinations below are offered. If exactly one gate exists for the selected compound, it is auto-selected. "OTHER" rows are reserved for additional compounds/gates configured later. Department (LOG/FNB/MKT/OTHER) is **derived from the selected compound** — it is not a separate form field (Register #9).

| Venue | Code | City | Dept | Compound | Gate |
|---|---|---|---|---|---|
| Saly Beach West | SBW | Saly | LOG | Logistics Compound | BCT |
| Saly Beach West | SBW | Saly | LOG | Logistics Compound | WP |
| Saly Beach West | SBW | Saly | FNB | FNB Compound | WP |
| Saly Beach West | SBW | Saly | MKT | MKT002 | WP |
| Saly Beach West | SBW | Saly | MKT | MKT001 | WP |
| Saly Beach West | SBW | Saly | OTHER | OTHER | OTHER |
| Tour de l'Œuf Complex | CTO | Dakar | LOG | Logistics Compound | VSA 2 |
| Tour de l'Œuf Complex | CTO | Dakar | FNB | FNB Compound | VSA 2 |
| Tour de l'Œuf Complex | CTO | Dakar | MKT | MKT002 | VSA 2 |
| Tour de l'Œuf Complex | CTO | Dakar | MKT | MKT001 | VSA 2 |
| Tour de l'Œuf Complex | CTO | Dakar | OTHER | OTHER | OTHER |
| Iba Mar Diop Sports Complex | CID | Dakar | LOG | Logistics Compound | VSA 1 |
| Iba Mar Diop Sports Complex | CID | Dakar | FNB | FNB Compound | VSA 1 |
| Iba Mar Diop Sports Complex | CID | Dakar | MKT | MKT002 | VSA 1 |
| Iba Mar Diop Sports Complex | CID | Dakar | MKT | MKT001 | VSA 1 |
| Iba Mar Diop Sports Complex | CID | Dakar | OTHER | OTHER | OTHER |
| Dakar Expo Center | DEX | Diamniadio | LOG | Logistics Compound | VSA 1 |
| Dakar Expo Center | DEX | Diamniadio | FNB | FNB Compound | VSA 2 |
| Dakar Expo Center | DEX | Diamniadio | MKT | MKT002 | VSA 1 |
| Dakar Expo Center | DEX | Diamniadio | MKT | MKT001 | VSA 1 |
| Dakar Expo Center | DEX | Diamniadio | OTHER | OTHER | OTHER |
| Stade Abdoulaye Wade | SAW | Diamniadio | LOG | Logistics Compound | VSA 2 |
| Stade Abdoulaye Wade | SAW | Diamniadio | FNB | FNB Compound | VSA 2 |
| Stade Abdoulaye Wade | SAW | Diamniadio | MKT | MKT002 | VSA 2 |
| Stade Abdoulaye Wade | SAW | Diamniadio | MKT | MKT001 | VSA 2 |
| Stade Abdoulaye Wade | SAW | Diamniadio | OTHER | OTHER | OTHER |
| Equestrian Centre | CED | Diamniadio | LOG | Logistics Compound | VSA 2 |
| Equestrian Centre | CED | Diamniadio | LOG | Logistics Compound | VSA 3 |
| Equestrian Centre | CED | Diamniadio | FNB | FNB Compound | VSA 2 |
| Equestrian Centre | CED | Diamniadio | FNB | FNB Compound | VSA 3 |
| Equestrian Centre | CED | Diamniadio | MKT | MKT002 | VSA 2 |
| Equestrian Centre | CED | Diamniadio | MKT | MKT001 | VSA 2 |
| Equestrian Centre | CED | Diamniadio | MKT | MKT002 | VSA 3 |
| Equestrian Centre | CED | Diamniadio | MKT | MKT001 | VSA 3 |
| Equestrian Centre | CED | Diamniadio | OTHER | OTHER | OTHER |
| Dakar Arena | DAR | Diamniadio | LOG | Logistics Compound | VSA 2 |
| Dakar Arena | DAR | Diamniadio | FNB | FNB Compound | VSA 2 |
| Dakar Arena | DAR | Diamniadio | MKT | MKT002 | VSA 2 |
| Dakar Arena | DAR | Diamniadio | MKT | MKT001 | VSA 2 |
| Dakar Arena | DAR | Diamniadio | OTHER | OTHER | OTHER |
| Youth Olympic Village | YOV | Diamniadio | LOG | Logistics Compound | VSA 1 |
| Youth Olympic Village | YOV | Diamniadio | FNB | FNB Compound Workforce | VSA 2 |
| Youth Olympic Village | YOV | Diamniadio | FNB | FNB Compound Athlete Dining | VSA 2 |
| Youth Olympic Village | YOV | Diamniadio | MKT | MKT002 | VSA 2 |
| Youth Olympic Village | YOV | Diamniadio | MKT | MKT001 | VSA 2 |
| Youth Olympic Village | YOV | Diamniadio | OTHER | OTHER | OTHER |
| Corniche Ouest | COR | Dakar | LOG | Logistics Compound | OTHER |
| Corniche Ouest | COR | Dakar | FNB | FNB Compound | OTHER |
| Corniche Ouest | COR | Dakar | MKT | MKT002 | OTHER |
| Corniche Ouest | COR | Dakar | MKT | MKT001 | OTHER |
| Corniche Ouest | COR | Dakar | OTHER | OTHER | OTHER |

Departments: **LOG** = general logistics deliveries/collections · **FNB** = food & beverage · **MKT** = marketing/sponsor material · **OTHER** = reserve. **VSA** = Vehicle Screening Area.

## 9. Slots & capacity

- Slots are generated per venue from its OperatingDay records and configured slot duration (**default 30 min**, per-venue adjustable by VLM/Admin).
- **Capacity: exactly one vehicle per venue per slot (D8).** A hold on any slot blocks the entire venue for that window regardless of compound or gate.
- A booking occupies **one or more contiguous slots**, cumulative duration **≤ 2 hours**. The UI and all outputs display the merged window (e.g. three 30-min slots from 10:00 → shown as **10:00 to 11:30**), never the individual slots.
- Only genuinely available slots are shown to requestors; slots on closed days, inactive venues, or already held are never offered.
- **Concurrency:** slot reservation must be transaction-safe (row lock / unique constraint on venueId+slot) so simultaneous submissions cannot both win the same slot. This is an explicit acceptance criterion.
- **Bump-in period 01 Jul – 27 Oct 2026:** all venues preset 08:00–18:00 (editable).
- **Game period 28 Oct – 13 Nov 2026:** per-venue hours in §10.
- Suppliers may hold multiple bookings per day at the same or different venues; there is no daily booking count cap — only the 2-hour cap per booking.

## 10. Game-period operating hours (28 Oct – 13 Nov 2026) — seed configuration

Transcribed from the operating-hours workbook with blank cells mapped to **Closed** (D4). All times are Senegal local (GMT/UTC+00:00). VLMs may update after seeding.

| Date | CTO | SAW | CID | DAR | DEX | COR | CED | SBW | YOV |
|---|---|---|---|---|---|---|---|---|---|
| Wed 28 Oct | Closed | Closed | Closed | Closed | Closed | Closed | Closed | Closed | 08:00–18:00* |
| Thu 29 Oct | Closed | Closed | Closed | Closed | 10:00–19:00 | Closed | 08:30–11:30 | 08:00–17:00 | 08:00–18:00* |
| Fri 30 Oct | 10:00–17:45 | Closed | Closed | 08:00–20:00 | 09:00–19:00 | Closed | 08:30–11:30 | 08:00–17:00 | 09:00–17:00 |
| Sat 31 Oct | 08:30–14:15 | Closed | Closed | 09:00–15:00 | 09:00–15:00 | Closed | 08:30–11:30 | 07:30–15:10 | 09:00–13:00 |
| Sun 01 Nov | 10:30–17:45 | Closed | 10:00–19:30 | 09:00–18:55 | 09:30–19:30 | Closed | 08:30–10:30 | 07:30–16:50 | 08:00–18:00* |
| Mon 02 Nov | 10:30–17:45 | Closed | 10:00–19:30 | 09:00–18:55 | 09:30–19:00 | Closed | 08:30–10:30 | 07:30–17:00 | 08:00–18:00* |
| Tue 03 Nov | 10:30–17:45 | Closed | 09:40–19:30 | 09:00–18:55 | 09:30–19:15 | Closed | 08:00–10:30 | 07:30–17:00 | 08:00–18:00* |
| Wed 04 Nov | 10:30–17:20 | 09:00–18:00 | 10:00–19:30 | 09:00–18:45 | 10:00–18:00 | Closed | 08:30–10:30 | 08:00–16:30 | 08:00–18:00* |
| Thu 05 Nov | 10:30–17:20 | 09:00–18:00 | 10:00–19:30 | 14:00–18:45 | 08:00–19:20 | Closed | 08:00–11:00 | 09:00–19:00 | 08:00–18:00* |
| Fri 06 Nov | 10:00–17:40 | 09:30–12:00 | Closed | Closed | 08:00–17:00 | Closed | 08:00–12:00 | 09:00–19:00 | 08:00–18:00* |
| Sat 07 Nov | 10:00–17:40 | 09:00–17:45 | Closed | 10:00–19:30 | 08:00–19:30 | 09:00–11:00 | Closed | 09:00–17:50 | 08:00–18:00* |
| Sun 08 Nov | 11:30–16:40 | 10:00–16:30 | 11:00–18:00 | 10:00–17:00 | 08:00–19:30 | 09:00–13:30 | Closed | 09:00–17:50 | 08:00–18:00* |
| Mon 09 Nov | 11:30–16:40 | 10:00–16:30 | 10:00–18:00 | 11:00–17:00 | 08:30–19:30 | Closed | Closed | 09:30–17:30 | 08:00–18:00* |
| Tue 10 Nov | 11:00–16:00 | 09:00–17:30 | 10:00–19:00 | Closed | 09:00–20:00 | 09:00–12:20 | Closed | 10:00–17:00 | 08:00–18:00* |
| Wed 11 Nov | 11:00–16:00 | Closed | 11:00–19:00 | 11:00–17:00 | 09:00–19:30 | Closed | Closed | 10:00–17:10 | 08:00–18:00* |
| Thu 12 Nov | 11:00–17:30 | Closed | 11:00–18:15 | 11:00–17:00 | 09:00–19:30 | Closed | Closed | 10:00–17:20 | 08:00–18:00* |
| Fri 13 Nov | 10:00–12:45 | Closed | Closed | Closed | 09:00–13:00 | Closed | Closed | 09:30–14:06 | 08:00–18:00* |

\* YOV entries marked TBC in the source workbook are seeded with the bump-in default 08:00–18:00 pending confirmation by the YOV VLM (D4). **MLH** (Main Logistic Hub) is absent from the workbook: seed 08:00–18:00 daily for the full game period, VLM-editable.

## 11. Booking creation

### 11.1 Form fields (delivery & collection share one form; Booking type toggles the labels)

| Field | Required | Notes |
|---|---|---|
| Supplier name | ✔ | Pre-filled from account, read-only |
| Supplier contact number | — | |
| Transporter name | ✔ | |
| Transporter contact number | ✔ | |
| Booking type | ✔ | Delivery or Collection |
| Vehicle type | ✔ | Drop-down (master data) |
| Type of merchandise | ✔ | Drop-down (master data) |
| Packaging type | — | Drop-down (master data) |
| Quantity | — | |
| Weight (kg) | — | |
| Volume (m³) | — | |
| Venue | ✔ | Active venues only |
| Expected delivery/collection date | ✔ | Must be an open OperatingDay |
| Drop-off / collection point (compound) | ✔ | Filtered by venue (§8) |
| Access gate | ✔ | Filtered by compound; auto-selected if single option |
| Slot selection | ✔ | Contiguous slots, ≤ 2 h, displayed as one window |
| Additional comments | — | Free text (fragile, temperature-sensitive, oversized…) |

### 11.2 Submission rules

1. Validate all mandatory fields server-side; reject unavailable slots (they must also never render as selectable).
2. Enforce the 2-hour cumulative cap; block submission with a clear message if exceeded.
3. Reserve the slot(s) atomically (§9 concurrency rule).
4. Assign the booking reference (D1) and show it **immediately** on the confirmation screen.
5. Apply initial status per the 48-hour rule (§12).
6. Send booking notification (§13) with PDF confirmation attached.
7. **Booking type must appear as a labelled column** in every list view, dashboard, and export so gate teams can distinguish drop-off from pick-up at a glance.

## 12. Booking lifecycle

Canonical statuses: **Pending Validation · Confirmed · Cancelled · Expired**.

```
                          created >48h before slot, fields complete, capacity OK
  [created] ─────────────────────────────────────────────────────► Confirmed
      │  created ≤48h before slot                                      │
      ▼                                                                │
  Pending Validation ── VLM validates ────────────────────────────► Confirmed
      │        │                                                       │
      │        └─ VLM rejects (reason) ────────► Cancelled             │
      │                                             ▲                  │
      ├─ slot passes with no VLM action             │                  │
      │  (system reason: "not validated             │                  │
      │   before slot") ────────────────────────────┤                  │
      │                                             │                  │
      └─ supplier cancels pre-slot ─────────────────┤                  │
                                                    │                  │
  Confirmed ── supplier/VLM cancels pre-slot ───────┘                  │
  Confirmed ── slot end + 1h grace, not cancelled ─────────────► Expired
  Cancelled ── VLM/Admin reinstates (D3: audited, reason,
               slot re-checked) ───────────────────────────────► Confirmed
```

Rules:

- **Auto-confirm:** bookings created **more than 48 h** before the slot are auto-confirmed if mandatory fields are complete and capacity holds. Within 48 h → Pending Validation until VLM review.
- **Auto-cancel:** a Pending Validation booking whose slot passes without VLM action moves to Cancelled (reason `not validated before slot`) and **releases its capacity back to the pool**.
- **Expiry:** Confirmed → Expired fires **1 hour after the slot window ends**. It is a deliberate grace window, purely time-based, and **does not indicate arrival or non-arrival** (no digital arrival capture in this baseline). Expired is terminal.
- **Cancellation** (supplier: own bookings; VLM/Admin: venue-scoped) is allowed any time before slot start. Supplier cancellation needs no reason but a free-text reason field is offered and stored. VLM rejection **requires** a reason. Every cancellation releases the held slot(s).
- Every status change writes a BookingAuditEntry (previous status, new status, user or `system`, timestamp, reason).

## 13. Amendment

Eligible: bookings in **Pending Validation** or **Confirmed**, any time **before slot start** (never at/after). Users may change venue, date, slot/duration, and shipment details.

Flow: select booking → **Edit Booking** → current details shown → pick new venue/date → available slots displayed → select → system validates venue active, slot available, duration ≤ 2 h → save + audit entry.

- **Slot swap is atomic:** the old hold is released and the new hold taken in one transaction; on any validation failure the original booking is untouched.
- **Reference:** unchanged, except a venue change swaps the site-code segment only (D1).
- **Status after amendment:** Pending Validation stays Pending Validation. Confirmed stays Confirmed if the new slot is still >48 h away; if it is within 48 h the booking **reverts to Pending Validation** and the VLM is emailed for revalidation.
- Audit entry records original & new venue/date/slot, user, timestamp, previous & new status.
- Amendments are blocked when: target slot full, target venue inactive, duration exceeds cap, or slot start has passed.

## 14. Notifications

| Event | Recipient | Channel |
|---|---|---|
| Booking Confirmed | Supplier/transporter | In-app + email, **PDF confirmation attached** |
| Booking Cancelled (any path) | Supplier/transporter | In-app + email, includes the audit reason — a rejected supplier must know **before dispatching a vehicle** |
| New booking at venue | VLM(s) of that venue | Email |
| Supplier-initiated cancellation | VLM(s) of that venue + supplier | Email |
| Amendment reverting to Pending Validation | VLM(s) of that venue | Email |
| Login OTP | The authenticating user | Email (default) or SMS (D2) |

All outbound messages go through the provider interface (D7): production wires real email/SMS providers; dev/test uses a stub that logs and writes to NotificationOutbox. The confirmation PDF contains: booking reference, venue, date, time window, booking type, supplier/transporter details, and quantity/weight/volume displayed separately.

## 15. Screens (for Claude Design)

Bilingual FR/EN with a persistent language switcher; **French is default**. Primary brand colour: COJOJ Blue `#0078D0` (RGB 0,120,208), aligned to Dakar 2026 brand assets where provided. Responsive: current desktop browsers + mobile devices; must behave inside **Citrix-published browser sessions** (see live-update fallback, §16).

1. **Login** — email + password, then OTP entry step; locked-account recovery via OTP challenge; French default.
2. **Supplier — Booking workspace** (default landing): new booking form (§11) with venue → compound → gate cascading selects and a visual slot picker showing merged windows; "My bookings" list (future, pending, cancelled) with amend/cancel actions; settings (password, contact details, OTP channel).
3. **VLM — Bookings workspace** (default landing): venue-scoped list of all bookings with filters (§17); validate/reject pending items (reason capture on reject); amend/cancel; manual correction incl. reinstatement (D3) with mandatory reason dialog.
4. **VLM — Dashboard**: booking counts by status and type, expected deliveries vs collections, date navigation (past/today/future), venue-load view per slot, **print/export daily booking list**.
5. **VLM — Venue management**: operating hours per day (add/remove operating periods), slot duration, booking-window activate/deactivate, compound & gate maintenance — assigned venues only.
6. **Admin — Dashboard** (default landing): cross-venue version of the VLM dashboard.
7. **Admin — User administration**: create/update/deactivate users, assign roles & venues, reset credentials.
8. **Admin — Master data**: vehicle types, merchandise/goods types, packaging types, load units.
9. **Admin — Venue administration**: create/activate/deactivate venues; full venue-management capabilities across all venues.

## 16. Dashboard behaviour

- Live bookings view updates **without manual refresh**. Where real-time push (WebSocket/SSE) is unreliable — notably Citrix-published sessions — fall back to **automatic polling at a configurable interval**. Implement polling as the guaranteed baseline; push is an enhancement.
- Date-based navigation across historical, current and future operations per site.
- Venue-load visibility per slot to support capacity monitoring and rapid intervention.
- Requestors see a summary of their own bookings by status (pending, confirmed, cancelled, expired).

## 17. Booking management, search & export

- Filters: venue, status, booking type, date, booking reference, supplier name, transporter name. Results in a structured list for monitoring and intervention.
- Export of **filtered** booking data to **Excel and PDF**. Export columns: booking reference, company, date & slot window, venue, supplier/transporter, drop-off/pick-up location (compound), access gate, transporter contact details, vehicle type, merchandise type, **booking type (prominent labelled column)**, status.
- The **daily booking list** (per venue, per date) is the gate operators' working document — printable and exportable, sorted by slot time, booking type clearly visible.
- Terminology: the system uses **"booking type"** everywhere (never "movement type").

## 18. Localization & time

- UI languages: **French (default)** and English for all navigation, labels, messages, statuses, and validation errors. Exports carry the labels required by operating teams in the available languages.
- **All times are Senegal local time, GMT/UTC+00:00, no DST — ever.** Booking dates, slot times, operating hours, dashboards, exports, audit timestamps, notifications, and expiry calculations are computed and displayed in Senegal time regardless of the user's device or country. Recommended: store UTC, render in Africa/Dakar explicitly; never rely on browser locale for business logic.

## 19. Application security requirements (dev-facing)

Binding on the implementation; derived from P&P.CYB.032 and RTP_MDS. The app handles personal data (driver/vehicle registration details) and is externally exposed.

**Authentication & session** — as §5: OTP at login all roles; 8/12-char password policies with complexity; lockout after 5 failures; 30-min inactivity logout; salted adaptive password hashing.

**Authorization** — every control enforced **server-side**; venue scoping on all queries/mutations; deny-by-default routes; no privilege decisions made client-side (client-side checks are UX only).

**Input & output** — validate all inputs server-side; parameterized queries only (no string-built SQL); output encoding against XSS; CSRF protection on all state-changing requests; **rate limiting** on login, OTP issuance/verification, and booking submission endpoints; safe error handling — no stack traces, SQL fragments, or internal paths in user-facing errors.

**Secrets** — no credentials/API keys/secrets in source, tickets, or docs; environment/vault injection only; secret scanning in the repo; rotation supported by config.

**Audit logging (RTP REQ-09)** — log with actor, timestamp, and outcome: logins (success/failure), OTP events, lockouts, booking create/amend/cancel/validate, all status changes (incl. system-driven), manual corrections & reinstatements, admin actions (user/venue/master-data changes), and denied access attempts. Logs must answer *who did what, when*. Emit **structured logs (JSON)** to stdout/file so infra can ship them to the group SIEM (REQ-10) without app changes. Never log passwords, OTP codes, or session tokens.

**Data protection & lifecycle** — collect only the fields specified; personal data is deleted securely post-Games per RTP REQ-17 (provide an admin-triggerable purge routine + export of destruction proof); bookings are never hard-deleted during operations (cancel-only preserves the audit trail).

**Environment separation (P&P.CYB.032)** — DEV ≠ TEST ≠ PROD; production data never in DEV/TEST except masked; notification stubs in non-prod (D7); secure defaults everywhere (debug off, sample data out, least-privilege DB account).

**Pipeline (DevSecOps)** — SAST, SCA (dependency scan), secret scanning in CI; DAST against the test environment; critical findings block promotion to PROD absent a formal, time-limited waiver (GRC + Security). Fix SLAs: Critical 72 h · High 7 d · Medium 30 d · Low 90 d.

**AI-generated code review (RTP REQ-13)** — because the code is Claude-generated, before production: human review of authentication & authorization logic; verify controls are server-side; run secret scanning; strip unused code, debug features, test data, and surplus permissions.

## 20. Infrastructure & operations obligations (not built by the app team)

The application must be *compatible* with these, but they are delivered by hosting/ops (AGL/COJOJ):

| Ref | Obligation |
|---|---|
| REQ-01 | Maintained IS component map: config inventory + flow matrix (source, destination, protocol, port) |
| REQ-02/03 | Version control (satisfied by the repo) and formal change management for all releases: security go/no-go, rollback plan, approved deployment window, evidence retained |
| REQ-04 | Pre-production **pentest**; all CVSS High/Critical findings patched before go-live |
| REQ-05 | Production vulnerability monitoring & patching per COJOJ specifications |
| REQ-08 | All IS components monitored in **Datadog** (app exposes health/readiness endpoints) |
| REQ-10 | Log shipping to the group SIEM with detection use cases (app emits structured logs, §19) |
| REQ-11 | **WAF** in front of the app: SQLi/XSS/bot/anomalous-traffic protection |
| REQ-12 | Geo-IP restriction to Senegal where possible, **with the documented exception for external supplier access (D5)** |
| REQ-14 | Tested backup/restore; target **RPO/RTO ≤ 2 h** |
| REQ-15 | MDS environment physically isolated from the rest of the AGL infrastructure |
| REQ-16 | **24/7 on-call support** during lockdown and Games time |
| REQ-17 | Post-Games secure data deletion + destruction proof to COJOJ; infrastructure decommissioned |
| P&P.CYB.032 | Remote admin access only via trusted VPN + MFA + compliant endpoint; VM access via bastion; no direct PROD access without formal validation; monthly access reviews |

## 21. Non-functional requirements

- Support the agreed peak event-period load: concurrent supplier booking + simultaneous VLM monitoring across venues, with acceptable response times for slot search, booking submission, dashboard refresh, and export generation.
- Availability during defined operational hours per the agreed uptime target.
- Current enterprise-approved desktop browsers and mobile devices; Citrix-published session compatibility.
- Stack-agnostic, with constraints: relational store with transactional slot reservation; server-rendered or SPA acceptable provided all rules are enforced server-side; polling-friendly API design.

## 22. Acceptance criteria

1. Each role completes its core processes end-to-end; all role and venue restrictions enforced (verified by attempting cross-venue/cross-role access — must fail server-side).
2. Suppliers create delivery and collection bookings; contiguous slot selection up to 2 h; over-cap selection blocked with notification.
3. Booking reference generated and displayed immediately; format `OLY-{SITE}-{NNNNNN}`; numeric globally unique and immutable; venue amendment updates site code only (D1).
4. Only active venues and genuinely available slots are selectable, with linked compounds and gates per §8; single-gate compounds auto-select.
5. Lifecycle behaves exactly per §12, including: auto-confirm >48 h; pending ≤48 h; auto-cancel of unvalidated pending bookings at slot time with capacity release; Confirmed → Expired 1 h after window end; Expired terminal.
6. Reinstatement (Cancelled → Confirmed) works only for VLM/Admin, only with a reason, only when the slot is still free; no other non-canonical transition possible (D3).
7. Cancellation preserves the booking (never deleted) with reason in the audit trail; both supplier and VLM notified; slot released.
8. Amendment slot-swap atomically releases the old hold and takes the new one; status rules on amendment behave per §13.
9. Suppliers receive in-app + email notifications on Confirm/Cancel including the audit reason; confirmed bookings include the PDF attachment.
10. Concurrent booking attempts never exceed one vehicle per venue per slot (proven by a concurrency test).
11. Dashboard updates without manual refresh; polling fallback works in a Citrix-like environment.
12. Filtered booking data exports to Excel and PDF with the §17 column set; booking type prominent.
13. Full UI operates in French and English; French default.
14. Unauthorized users cannot reach protected screens or data; all §19 controls demonstrably active (lockout, timeout, rate limits, audit log coverage).

## 23. Key test scenarios

1. Register a delivery at an active venue/slot → booking created, reference shown, format correct.
2. Register a collection → correct booking-type display everywhere (list, dashboard, export).
3. Attempt to book an already-held slot → blocked. Repeat as a **simultaneous two-client race** → exactly one wins.
4. Select slots totalling > 2 h → blocked with warning.
5. Admin login → dashboard, user admin, venue creation reachable. VLM login → only assigned-venue data visible; direct API probe for another venue → 403.
6. Confirmed booking, slot passes uncancelled → auto-Expired exactly 1 h after window end.
7. Pending booking (≤48 h), slot passes with no VLM action → auto-Cancelled, reason `not validated before slot`, capacity released.
8. Supplier cancels Confirmed booking pre-slot → preserved as Cancelled, optional reason captured, notifications to supplier + VLM, slot released.
9. VLM rejects a Pending booking with reason → Cancelled, supplier notified before slot time; distinguishable from supplier cancellation.
10. Amend a Confirmed booking to a slot within 48 h → reverts to Pending Validation, VLM revalidation email sent. Amend to >48 h → stays Confirmed.
11. Amend with venue change → site code in reference updates, numeric unchanged; old slot free, new slot held.
12. Reinstate a wrongly-cancelled booking → Cancelled → Confirmed with reason + audit entry; retry when slot has been taken → blocked.
13. Export filtered bookings → verify Excel and PDF content and columns.
14. Switch FR ↔ EN → labels, statuses, and validation messages translate.
15. 5 failed logins → lockout; OTP recovery unlocks; 30 min idle → session expires.
16. Verify audit log contains every event class in §19 with actor/timestamp/outcome, and no secrets/OTPs logged.

## 24. Rollout checklist

Before launch: configure venues; seed compounds/gates (§8) and operating hours (§10); generate slots for bump-in + game periods; validate role & venue assignments; confirm dashboard visibility; verify FR/EN content; end-to-end test from booking through daily-list export; define ops procedures for exception handling, overdue monitoring, manual intervention, and supplier password-reset support at peak.

## 25. Glossary

**Booking** — a delivery or collection reservation for a specific venue and time window. **Slot** — a scheduled time window of configured duration (default 30 min). **Booking window** — the merged start–end of the contiguous slots in one booking. **Venue** — a physical Olympic delivery location. **Compound / drop-off location** — a department-specific loading/offloading area within a venue (LOG, FNB, MKT001/002, OTHER). **Access gate** — the entry point serving a compound (VSA 1/2/3, BCT, WP, OTHER). **VSA** — Vehicle Screening Area. **VLM** — Venue Logistics Manager: venue-scoped operational validator. **Gate operators** — security staff checking arrivals against the printed booking list; not system users. **Cancelled** — end state from supplier withdrawal, VLM rejection, or system auto-cancel of unvalidated pending bookings; booking preserved, reinstatement possible per D3. **Expired** — system end state 1 h after a Confirmed booking's window passes; says nothing about physical arrival; terminal. **Booking reference** — `OLY-{SITE}-{NNNNNN}`, numeric globally unique and immutable. **LOG/FNB/MKT** — Logistics / Food & Beverage / Marketing departments. Site codes: CTO, CID, COR, DEX, SAW, CED, DAR, SBW, YOV, MLH per §7.
