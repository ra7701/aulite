import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";

if (existsSync("license-private.pem")) {
  console.error("license-private.pem already exists. Delete it first if you want a new keypair.");
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

writeFileSync("license-private.pem", privateKey);
writeFileSync("src/license-public.pem", publicKey);

console.log("Generated RSA keypair:");
console.log("  Private key: license-private.pem (NEVER commit this)");
console.log("  Public key:  src/license-public.pem (ships with the product)");
