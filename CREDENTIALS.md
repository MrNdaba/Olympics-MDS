# Sign-in roles & credentials — MDS (Dakar 2026 YOG)

Accounts are **only created by an Administrator** — there is no self-registration (spec §4/§5).
Running `npx prisma db seed` provisions one demo account per role.

All demo accounts share the same password (satisfies the 12-character staff policy):

```
Password1234!
```

## Demo accounts

| Role | Email | Password | Assigned venue(s) |
| --- | --- | --- | --- |
| **Administrator** | `admin@mds.dev` | `Password1234!` | All (cross-venue) |
| **VLM** (Venue Logistics Manager) | `vlm.dar@mds.dev` | `Password1234!` | Dakar Arena (DAR) |
| **View Only** | `viewer.dar@mds.dev` | `Password1234!` | Dakar Arena (DAR) |
| **Supplier / Transporter** | `supplier@mds.dev` | `Password1234!` | — |

## Access per role

- **Administrator** — manages users, venues and master data; has cross-venue VLM rights.
  - Landing: `/admin/users`, `/admin/master-data`, `/admin/venues` (plus `/vlm/dashboard`, `/vlm`).
- **VLM** — validates and monitors bookings **only for assigned venue(s)**. Server-side venue
  scoping is enforced on every query and mutation.
  - Landing: `/vlm` (bookings), `/vlm/dashboard` (venue load).
- **View Only** — same screens as a VLM (bookings, dashboard, venue management), same venue
  scoping, but strictly read-only: validate/reject/amend/cancel/reinstate and every venue-management
  edit are hidden client-side and rejected server-side (the underlying actions require the `vlm` or
  `admin` role explicitly).
  - Landing: `/vlm` (bookings, read-only).
- **Supplier / Transporter** — creates, amends and cancels their own delivery/collection bookings.
  - Landing: `/supplier` (new booking + my bookings).

## Sign-in flow

Two steps: email + password, then a one-time code (OTP — 6 digits, 10-min validity). In
non-production environments the OTP is surfaced at the sign-in prompt and no real messages are
sent (D2/D7).

French is the default language; every screen is available in EN via the language switcher.

> **Security note:** these credentials are for local/demo use only. Never commit real credentials,
> and never reuse the seed password in production.
