import { generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const projectRef = "qpyqqkkkparobyucnqgb";
const privatePath = resolve(".tmp", "gmail-oauth-capture-private.pem");
const command = process.argv[2];
function setSecret(assignment) {
  if (process.platform === "win32") {
    return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", `${process.env.ProgramFiles}\\nodejs\\npx.ps1`, "supabase", "secrets", "set", assignment, "--project-ref", projectRef], { stdio: "inherit" });
  }
  return spawnSync("npx", ["supabase", "secrets", "set", assignment, "--project-ref", projectRef], { stdio: "inherit" });
}

if (command === "prepare") {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
  writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  const publicJwk = publicKey.export({ format: "jwk" });
  const encoded = Buffer.from(JSON.stringify(publicJwk)).toString("base64url");
  const result = setSecret(`GMAIL_OAUTH_CAPTURE_PUBLIC_KEY=${encoded}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log("One-time OAuth capture key prepared. Private key remains only in .tmp.");
} else if (command === "store") {
  const capturePath = process.argv[3];
  if (!capturePath) throw new Error("Pass the downloaded viawa-gmail-oauth-capture.bin path.");
  const refreshToken = privateDecrypt({ key: readFileSync(privatePath), oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING }, readFileSync(resolve(capturePath))).toString("utf8");
  const result = setSecret(`GMAIL_OAUTH_REFRESH_TOKEN=${refreshToken}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log("Refresh token stored as the production Edge secret; its value was not printed.");
} else {
  console.error("Usage: node scripts/gmail-oauth-capture.mjs prepare|store <capture-file>");
  process.exit(2);
}
