import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { encryptRefreshTokenForAdmin } from "./gmailOAuthCapture.ts";

test("refresh-token capture is decryptable only by the one-time private key", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const encodedPublicJwk = Buffer.from(JSON.stringify(publicKey.export({ format: "jwk" }))).toString("base64url");
  const encrypted = await encryptRefreshTokenForAdmin("test-refresh-token", encodedPublicJwk);
  const decrypted = privateDecrypt({ key: privateKey, oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING }, encrypted).toString("utf8");
  assert.equal(decrypted, "test-refresh-token");
  assert.equal(new TextDecoder().decode(encrypted).includes("test-refresh-token"), false);
});
