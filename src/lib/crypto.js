/**
 * Primitivas sobre Web Crypto, disponible tanto en Workers como en Node para
 * las pruebas. Ed25519 produce exactamente los mismos bytes que `crypto.sign`
 * de Node, así que la aplicación de escritorio sigue verificando las licencias
 * con su clave pública actual.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(text) {
  const normalized = String(text).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function utf8ToBase64url(text) {
  return bytesToBase64url(encoder.encode(text));
}

export function base64urlToUtf8(text) {
  return decoder.decode(base64urlToBytes(text));
}

export function bytesToHex(bytes) {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToHex(new Uint8Array(digest));
}

export async function hmacSha256Hex(secret, text) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return bytesToHex(new Uint8Array(signature));
}

export function randomHex(byteLength) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** Convierte un bloque PEM en su DER. Lanza si el bloque no es del tipo esperado. */
export function pemToDer(pem, label) {
  const match = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(String(pem));
  if (!match || match[1] !== label) throw new Error(`PEM inválido: se esperaba ${label}.`);
  const binary = atob(match[2].replace(/\s+/g, ""));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function importEd25519PrivateKey(pem) {
  return crypto.subtle.importKey("pkcs8", pemToDer(pem, "PRIVATE KEY"), { name: "Ed25519" }, false, ["sign"]);
}

export function importEd25519PublicKey(pem) {
  return crypto.subtle.importKey("spki", pemToDer(pem, "PUBLIC KEY"), { name: "Ed25519" }, false, ["verify"]);
}

export async function ed25519Sign(key, bytes) {
  return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, bytes));
}

export function ed25519Verify(key, signature, bytes) {
  return crypto.subtle.verify({ name: "Ed25519" }, key, signature, bytes);
}

export { encoder as utf8Encoder };
