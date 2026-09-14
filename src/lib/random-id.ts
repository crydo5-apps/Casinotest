/** Browser-safe random hex (Web Crypto). Use this in modules imported by the client. */
export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let out = "";
  for (const b of buf) out += b.toString(16).padStart(2, "0");
  return out;
}
