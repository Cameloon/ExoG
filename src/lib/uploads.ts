// Client-side image validation for direct-to-storage uploads (ward images).
// Verifies MAGIC BYTES of the actual file content — the browser-reported
// file.type and filename are both attacker-controlled. Mirrors the sniffing
// in the kyc-upload edge function; the storage RLS policy additionally
// restricts the extension.

const MAX_BYTES = 10 * 1024 * 1024;

export type SniffedImage = { ext: string; mime: string };

const sniff = (b: Uint8Array): SniffedImage | null => {
  const s = (a: number[]) => a.every((v, i) => b[i] === v);
  if (s([0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (s([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  if (s([0x47, 0x49, 0x46, 0x38])) return { ext: "gif", mime: "image/gif" };
  // RIFF....WEBP
  if (s([0x52, 0x49, 0x46, 0x46]) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { ext: "webp", mime: "image/webp" };
  // ftyp box: bytes[4..8]=="ftyp", bytes[8..12]=="avif"|"avis"
  if (b.length > 12 && String.fromCharCode(b[4], b[5], b[6], b[7]) === "ftyp") {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "avif" || brand === "avis") return { ext: "avif", mime: "image/avif" };
  }
  return null;
};

/**
 * Returns the verified image type for a File, or null if the content is not
 * a known-safe raster image (svg/html/js are rejected) or exceeds 10 MB.
 */
export async function sniffImage(file: File): Promise<SniffedImage | null> {
  if (file.size === 0 || file.size > MAX_BYTES) return null;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniff(head);
}
