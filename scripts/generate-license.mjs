import { readFileSync, existsSync } from "node:fs";
import { createSign } from "node:crypto";

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  flags[args[i].replace(/^--/, "")] = args[i + 1];
}

if (!flags.email) {
  console.log(`Usage: node scripts/generate-license.mjs --email client@co.com [--months 1] [--plan pro]`);
  process.exit(1);
}

if (!existsSync("license-private.pem")) {
  console.error("license-private.pem not found. Run: node scripts/generate-keypair.mjs");
  process.exit(1);
}

const months = parseInt(flags.months ?? "1", 10);
const plan = flags.plan ?? "pro";

const now = new Date();
const expiresAt = new Date(now);
expiresAt.setMonth(expiresAt.getMonth() + months);

const payload = {
  plan,
  email: flags.email,
  issuedAt: now.toISOString().split("T")[0],
  expiresAt: expiresAt.toISOString().split("T")[0],
};

const payloadJson = JSON.stringify(payload);
const payloadB64 = Buffer.from(payloadJson).toString("base64url");

const privateKey = readFileSync("license-private.pem", "utf-8");
const sign = createSign("SHA256");
sign.update(payloadB64);
const signature = sign.sign(privateKey, "base64url");

const licenseKey = `aulite_pro_${payloadB64}.${signature}`;

console.log("");
console.log("License generated:");
console.log("");
console.log(`  Plan:       ${plan}`);
console.log(`  Email:      ${flags.email}`);
console.log(`  Issued:     ${payload.issuedAt}`);
console.log(`  Expires:    ${payload.expiresAt}`);
console.log("");
console.log(`  Key:`);
console.log(`  ${licenseKey}`);
console.log("");
console.log("  Client adds to .env:");
console.log(`  AULITE_LICENSE_KEY=${licenseKey}`);
console.log("");
