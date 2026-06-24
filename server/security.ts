import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";

const scrypt = promisify(scryptCallback);

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltText, expectedText] = String(stored || "").split("$");
  if (algorithm !== "scrypt" || !saltText || !expectedText) return false;
  const expected = Buffer.from(expectedText, "base64url");
  const derived = (await scrypt(password, Buffer.from(saltText, "base64url"), expected.length)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function encryptionKey() {
  return createHash("sha256").update(config.encryptionKey).digest();
}

export function encryptField(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptField(value: string) {
  const [version, ivText, tagText, encryptedText] = String(value || "").split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) return "";
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function safeInitials(name: string) {
  return String(name || "Resident")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function isWorkEmail(email: string) {
  const domain = String(email || "").trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  const personalDomains = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com",
    "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
    "pm.me", "mail.com", "gmx.com", "gmx.co.uk", "zoho.com", "yandex.com"
  ]);
  return !personalDomains.has(domain);
}

export function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function publicId(prefix: string) {
  return `${prefix}_${randomBytes(5).toString("hex")}`;
}
