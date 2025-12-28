export function sanitizeFileName(name: string, ext = "") {
  // Remove characters not allowed in filenames, trim, replace spaces with _
  const base = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 200);
  return base + (ext ? `.${ext.replace(/^\./, "")}` : "");
}
