import assert from "node:assert/strict";
import test from "node:test";
import { verifyGmailIdentityAlias } from "./gmailIdentity.ts";

const response = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
const verify = (responses) => verifyGmailIdentityAlias({
  accessToken: "server-only",
  owningMailbox: "ahmet@expoviafair.com",
  senderAlias: "viafa@expoviafair.com",
  fetchImpl: async () => responses.shift(),
});

test("mailbox lookup failure is classified safely", async () => assert.equal(await verify([response(403, { error: "private" })]), "GMAIL_MAILBOX_LOOKUP_FAILED"));
test("mailbox mismatch is classified safely", async () => assert.equal(await verify([response(200, { email: "other@expoviafair.com" })]), "GMAIL_MAILBOX_MISMATCH"));
test("alias lookup failure is classified safely", async () => assert.equal(await verify([response(200, { email: "ahmet@expoviafair.com" }), response(500, { error: "private" })]), "GMAIL_ALIAS_LOOKUP_FAILED"));
test("alias not found is distinct", async () => assert.equal(await verify([response(200, { email: "ahmet@expoviafair.com" }), response(404, { error: "not found" })]), "GMAIL_ALIAS_NOT_FOUND"));
test("unaccepted alias is distinct", async () => assert.equal(await verify([response(200, { email: "ahmet@expoviafair.com" }), response(200, { sendAsEmail: "viafa@expoviafair.com", verificationStatus: "pending" })]), "GMAIL_ALIAS_NOT_ACCEPTED"));
test("only the exact accepted alias succeeds", async () => assert.equal(await verify([response(200, { email: "ahmet@expoviafair.com" }), response(200, { sendAsEmail: "viafa@expoviafair.com", verificationStatus: "accepted" })]), "GMAIL_IDENTITY_ALIAS_OK"));
