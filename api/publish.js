const { handler, fail, gh, headSha, branch, DATA_PATH } = require("./_lib.js");

const UPLOAD_RE = /^uploads\/[a-f0-9]{16}\.(webp|jpg|png)$/;
const SHA_RE = /^[a-f0-9]{40}$/;

function checkData(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  if (!Array.isArray(d.products) || !Array.isArray(d.catalogs) || typeof d.settings !== "object" || !d.settings) return false;
  if (d.gallery && !Array.isArray(d.gallery)) return false;
  return d.products.length <= 500 && d.catalogs.length <= 20;
}

// Menyimpan data situs dan foto baru dalam satu commit. Vercel lalu menerbitkan ulang situs.
module.exports = handler("POST", true, async (req, res) => {
  const body = req.body || {};
  if (!checkData(body.data)) throw fail(400, "bad_data", "Data situs tidak lengkap.");
  const json = JSON.stringify(body.data, null, 2) + "\n";
  if (json.length > 900000) throw fail(413, "too_large", "Data situs terlalu besar.");
  const files = Array.isArray(body.files) ? body.files : [];
  const remove = Array.isArray(body.remove) ? body.remove : [];
  if (files.length > 100 || remove.length > 200) throw fail(400, "too_many", "Terlalu banyak file dalam satu kali simpan.");
  for (const f of files) if (!f || !UPLOAD_RE.test(f.path) || !SHA_RE.test(f.sha)) throw fail(400, "bad_file", "Daftar foto tidak valid.");
  for (const p of remove) if (!UPLOAD_RE.test(p)) throw fail(400, "bad_file", "Daftar foto tidak valid.");

  const head = await headSha();
  if (body.base && body.base !== head) throw fail(409, "conflict", "Data di situs sudah berubah sejak Anda membuka panel. Muat ulang panel lalu ulangi perubahan.");
  const commit = await gh("GET", "/git/commits/" + head);

  const tree = [{ path: DATA_PATH, mode: "100644", type: "blob", content: json }];
  for (const f of files) tree.push({ path: f.path, mode: "100644", type: "blob", sha: f.sha });
  const added = new Set(files.map((f) => f.path));
  for (const p of remove) {
    if (added.has(p)) continue;
    // Hanya hapus file yang memang ada, agar pembuatan tree tidak gagal.
    try { await gh("GET", "/contents/" + p + "?ref=" + head); tree.push({ path: p, mode: "100644", type: "blob", sha: null }); }
    catch (e) { if (e.code !== "github_not_found") throw e; }
  }
  const newTree = await gh("POST", "/git/trees", { base_tree: commit.tree.sha, tree });
  const newCommit = await gh("POST", "/git/commits", {
    message: String(body.message || "Perbarui konten situs lewat panel admin").slice(0, 120),
    tree: newTree.sha,
    parents: [head],
  });
  try {
    await gh("PATCH", "/git/refs/heads/" + branch(), { sha: newCommit.sha, force: false });
  } catch (e) {
    if (e.ghStatus === 422) throw fail(409, "conflict", "Data di situs berubah saat menyimpan. Muat ulang panel lalu ulangi perubahan.");
    throw e;
  }
  res.status(200).json({ head: newCommit.sha });
});
