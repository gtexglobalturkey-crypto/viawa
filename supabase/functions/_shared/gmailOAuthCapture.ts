function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encryptRefreshTokenForAdmin(refreshToken: string, encodedPublicJwk: string): Promise<Uint8Array> {
  const jwk = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPublicJwk))) as JsonWebKey;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  return new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, new TextEncoder().encode(refreshToken)));
}
