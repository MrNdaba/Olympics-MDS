import bcrypt from "bcryptjs";
import { STAFF_MIN_PASSWORD, SUPPLIER_MIN_PASSWORD, type Role } from "./constants";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Password complexity per role (spec §5): 8 chars supplier / 12 chars staff,
 *  each with upper, lower, digit and special. Returns null if valid. */
export function validatePasswordPolicy(password: string, role: Role): string | null {
  const min = role === "supplier" ? SUPPLIER_MIN_PASSWORD : STAFF_MIN_PASSWORD;
  if (password.length < min) return `Minimum ${min} characters.`;
  if (!/[A-Z]/.test(password)) return "Must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Must contain a digit.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Must contain a special character.";
  return null;
}
