// Domain constants & string-union types (Postgres-ready: these replace Prisma enums).
// Every value persisted in a "String" column that represents a closed set is
// declared here so the DB stays enum-free while TypeScript enforces the set.

// "viewer" = View Only staff account (item #3): sees the same VLM-scoped
// screens as a VLM (bookings, dashboard, venue management) but every
// create/update/delete action is blocked server-side — see requireRole calls
// in src/app/vlm/**/actions.ts, which intentionally omit "viewer".
export const ROLES = ["supplier", "vlm", "admin", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const BOOKING_TYPES = ["delivery", "collection"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_STATUSES = [
  "PendingValidation",
  "Confirmed",
  "Cancelled",
  "Expired",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Statuses that still occupy capacity (own SlotHold rows).
export const ACTIVE_STATUSES: BookingStatus[] = ["PendingValidation", "Confirmed"];

export const DEPARTMENTS = ["LOG", "FNB", "MKT", "OTHER"] as const;
export type Department = (typeof DEPARTMENTS)[number];

// Email is the only supported OTP/notification channel — SMS was removed
// (approved architecture uses email only; see AGENTS.md non-negotiables).
export const OTP_CHANNELS = ["email"] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export const USER_STATUSES = ["active", "locked", "deactivated"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const MASTER_DATA_CATEGORIES = [
  "vehicleType",
  "merchandiseType",
  "packagingType",
  "loadUnit",
] as const;
export type MasterDataCategory = (typeof MASTER_DATA_CATEGORIES)[number];

export const AUDIT_ACTIONS = [
  "created",
  "amended",
  "statusChanged",
  "cancelled",
  "reinstated",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Business rules (spec §5, §9, §12).
export const MAX_BOOKING_MINUTES = 120; // ≤ 2 h cumulative
export const AUTO_CONFIRM_THRESHOLD_HOURS = 48; // >48h → auto-confirm
export const EXPIRY_GRACE_HOURS = 1; // Confirmed → Expired 1h after window
export const OTP_VALIDITY_MINUTES = 10;
export const SESSION_IDLE_MINUTES = 30;
export const MAX_FAILED_ATTEMPTS = 5;
export const SUPPLIER_MIN_PASSWORD = 8;
export const STAFF_MIN_PASSWORD = 12; // VLM & Admin
export const DEFAULT_SLOT_MINUTES = 30;

export const SESSION_COOKIE = "mds_session";
export const LANG_COOKIE = "mds_lang";

// Rate limiting (spec §19): login, OTP issuance/verification, booking submission.
// Fixed-window counters keyed per identifier (email/user/IP).
export const RATE_LIMITS = {
  login: { max: 10, windowMs: 15 * 60_000 }, // per email+IP / 15 min
  otp: { max: 6, windowMs: 10 * 60_000 }, // issuance + verification / 10 min
  booking: { max: 20, windowMs: 60_000 }, // submissions per user / 1 min
} as const;
