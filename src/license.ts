import { createVerify } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./utils/logger.js";

export type Plan = "free" | "pro";

export interface Entitlements {
  plan: Plan;
  llmJudge: boolean;
  reports: boolean;
  dashboardPages: string[];
}

interface LicensePayload {
  plan: string;
  email: string;
  issuedAt: string;
  expiresAt: string;
}

const FREE: Entitlements = {
  plan: "free",
  llmJudge: false,
  reports: false,
  dashboardPages: ["overview", "requests", "settings"],
};

const PRO: Entitlements = {
  plan: "pro",
  llmJudge: true,
  reports: true,
  dashboardPages: ["overview", "requests", "compliance", "reports", "settings"],
};

let resolved: Entitlements | null = null;

function loadPublicKey(): string | null {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(__dirname, "license-public.pem"),
    resolve(__dirname, "../src/license-public.pem"),
    resolve(process.cwd(), "src/license-public.pem"),
  ];
  const path = candidates.find(existsSync);
  if (!path) return null;
  return readFileSync(path, "utf-8");
}

function verifyLicenseKey(key: string): LicensePayload | null {
  const prefix = "aulite_pro_";
  if (!key.startsWith(prefix)) return null;

  const raw = key.slice(prefix.length);
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payloadB64 = raw.slice(0, dotIndex);
  const signature = raw.slice(dotIndex + 1);

  const publicKey = loadPublicKey();
  if (!publicKey) {
    logger.warn("License public key not found, cannot verify license");
    return null;
  }

  try {
    const verify = createVerify("SHA256");
    verify.update(payloadB64);
    const valid = verify.verify(publicKey, signature, "base64url");
    if (!valid) return null;

    const payload: LicensePayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    if (new Date(payload.expiresAt) < new Date()) {
      logger.warn("License expired", { expiresAt: payload.expiresAt, email: payload.email });
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function resolveEntitlements(licenseKey?: string): Entitlements {
  if (resolved) return resolved;

  if (licenseKey) {
    const payload = verifyLicenseKey(licenseKey);
    if (payload) {
      logger.info("License activated", { plan: payload.plan, email: payload.email, expiresAt: payload.expiresAt });
      resolved = PRO;
      return resolved;
    }

    if (licenseKey.startsWith("aulite_pro_")) {
      logger.warn("Invalid or expired license key");
    }
  }

  resolved = FREE;
  return resolved;
}

export function getEntitlements(): Entitlements {
  return resolved ?? FREE;
}

export function resetLicense(): void {
  resolved = null;
}

export function requirePro(feature: string): { allowed: false; error: string } | { allowed: true } {
  const ent = getEntitlements();
  if (ent.plan === "pro") return { allowed: true };
  return {
    allowed: false,
    error: `"${feature}" requires Aulite Pro. Set AULITE_LICENSE_KEY in your config.`,
  };
}
