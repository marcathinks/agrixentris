// Fungsi bersama untuk API admin. Dipakai oleh Cloudflare Workers (worker/index.js) dan tools/dev-server.js.
const crypto = require("crypto");

// Dibaca saat dipakai, bukan saat file dimuat, karena Cloudflare mengisi variabel per permintaan.
const apiUrl = () => process.env.GITHUB_API_URL || "https://api.github.com";
const branch = () => process.env.GITHUB_BRANCH || "main";
const DATA_PATH = "data/site.json";
const SESSION_HOURS = 12;

function missingEnv() {
  return ["ADMIN_PASSWORD", "GITHUB_TOKEN", "GITHUB_REPO"].filter((k) => !process.env[k]);
}
function secret() {
  return crypto.createHash("sha256").update("agx-session:" + process.env.ADMIN_PASSWORD + ":" + process.env.GITHUB_TOKEN).digest();
}
function sign(exp) {
  return crypto.createHmac("sha256", secret()).update(String(exp)).digest("base64url");
}
function makeToken() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return exp + "." + sign(exp);
}
function safeEqual(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function checkPassword(pw) {
  return typeof pw === "string" && pw.length > 0 && safeEqual(pw, process.env.ADMIN_PASSWORD);
}
function validToken(req) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const i = t.indexOf(".");
  if (i < 1) return false;
  const exp = Number(t.slice(0, i));
  if (!exp || exp < Date.now()) return false;
  return safeEqual(t.slice(i + 1), sign(exp));
}

// Pembungkus endpoint: cek metode, konfigurasi, dan sesi admin.
function handler(method, needAuth, fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== method) return res.status(405).json({ error: "method_not_allowed" });
    const miss = missingEnv();
    if (miss.length) return res.status(503).json({ error: "not_configured", missing: miss });
    if (needAuth && !validToken(req)) return res.status(401).json({ error: "unauthorized" });
    try {
      await fn(req, res);
    } catch (e) {
      const status = e.status || 500;
      res.status(status).json({ error: e.code || "server_error", message: e.publicMessage || "Terjadi kesalahan di server." });
    }
  };
}
function fail(status, code, publicMessage) {
  const e = new Error(code); e.status = status; e.code = code; e.publicMessage = publicMessage; return e;
}

async function gh(method, path, body) {
  const r = await fetch(apiUrl() + "/repos/" + process.env.GITHUB_REPO + path, {
    method,
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "agrixentris-admin",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) throw fail(502, "github_auth", "Token GitHub ditolak. Periksa GITHUB_TOKEN dan izin Contents: Read and write.");
    if (r.status === 404) throw fail(502, "github_not_found", "Repo atau branch tidak ditemukan. Periksa GITHUB_REPO dan GITHUB_BRANCH.");
    const e = fail(502, "github_error", "GitHub menolak permintaan (" + r.status + ").");
    e.ghStatus = r.status; throw e;
  }
  return json;
}
async function headSha() {
  const ref = await gh("GET", "/git/ref/heads/" + branch());
  return ref.object.sha;
}

module.exports = { handler, fail, gh, headSha, makeToken, checkPassword, branch, DATA_PATH };
