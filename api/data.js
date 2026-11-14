const { handler, fail, gh, headSha, BRANCH, DATA_PATH } = require("./_lib.js");

// Mengambil data situs terbaru langsung dari repo, beserta commit terakhirnya.
module.exports = handler("GET", true, async (req, res) => {
  const head = await headSha();
  const file = await gh("GET", "/contents/" + DATA_PATH + "?ref=" + head);
  let data;
  try { data = JSON.parse(Buffer.from(file.content, "base64").toString("utf8")); }
  catch (e) { throw fail(500, "bad_data", "File data/site.json di repo tidak bisa dibaca."); }
  res.status(200).json({ data, head, branch: BRANCH });
});
