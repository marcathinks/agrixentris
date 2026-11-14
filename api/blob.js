const crypto = require("crypto");
const { handler, fail, gh } = require("./_lib.js");

const MAX_BYTES = 3 * 1024 * 1024;
function kind(buf) {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.toString("latin1", 0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  return null;
}

// Menyimpan satu foto sebagai blob di repo. Foto baru muncul di situs setelah /api/publish.
module.exports = handler("POST", true, async (req, res) => {
  const b64 = req.body && req.body.content;
  if (typeof b64 !== "string" || !b64) throw fail(400, "no_content", "Foto kosong.");
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > MAX_BYTES) throw fail(413, "too_large", "Foto terlalu besar. Maksimal 3 MB setelah dikompres.");
  const ext = kind(buf);
  if (!ext) throw fail(415, "unsupported_type", "Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.");
  const blob = await gh("POST", "/git/blobs", { content: buf.toString("base64"), encoding: "base64" });
  const name = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  res.status(200).json({ sha: blob.sha, path: "uploads/" + name + "." + ext });
});
