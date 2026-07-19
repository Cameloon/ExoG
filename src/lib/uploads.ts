// Map a file's MIME type to a safe storage extension. Rejects anything that
// could be rendered/executed in a browser (svg, html, js, etc.). Unknown or
// disallowed types fall back to "bin" so the file is never served as active content.
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

const BLOCKED_EXT = new Set([
  "html", "htm", "js", "mjs", "svg", "xml", "php", "exe", "sh",
  "bat", "cmd", "jsp", "asp", "json", "csv", "txt",
]);

export function safeExtension(file: File): string {
  const fromMime = MIME_EXT[file.type];
  if (fromMime) return fromMime;
  const claimed = (file.name.split(".").pop() ?? "bin").toLowerCase();
  if (BLOCKED_EXT.has(claimed)) return "bin";
  return /^[a-z0-9]{1,10}$/.test(claimed) ? claimed : "bin";
}
