// Cloudflare Workers: menyajikan situs statis dan menjalankan API panel admin.
// Halaman, gambar, dan data disajikan langsung oleh Cloudflare dari file di repo.
// Hanya permintaan ke /api/* yang menjalankan kode ini (lihat run_worker_first di wrangler.jsonc).
// Fungsi API-nya sama dengan yang dipakai Vercel dan tools/dev-server.js (folder api/).
import process from "node:process";
import login from "../api/login.js";
import data from "../api/data.js";
import blob from "../api/blob.js";
import publish from "../api/publish.js";

const ROUTES = { login, data, blob, publish };
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};
// Batas ukuran isi permintaan. Foto dikompres di browser lalu dikirim sebagai base64 (maks. 3 MB).
const MAX_BODY = 5 * 1024 * 1024;

function json(status, obj, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS, ...extra },
  });
}

async function readBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; }
}

// Menjalankan fungsi bergaya Vercel (req, res) dengan Request/Response milik Workers.
async function runHandler(fn, request, body) {
  const out = { status: 200, headers: {}, body: null };
  const req = { method: request.method, headers: Object.fromEntries(request.headers), body };
  const res = {
    status(s) { out.status = s; return res; },
    setHeader(k, v) { out.headers[k] = v; return res; },
    json(o) { out.body = o; return res; },
  };
  await fn(req, res);
  return json(out.status, out.body == null ? {} : out.body, out.headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    // Variabel dan kunci rahasia Cloudflare diteruskan ke kode API yang membaca process.env.
    for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;

    const name = url.pathname.slice(5).replace(/\/+$/, "");
    const fn = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : null;
    if (!fn) return json(404, { error: "not_found" });

    const body = await readBody(request);
    if (body === null) return json(413, { error: "too_large", message: "Data terlalu besar." });
    try {
      return await runHandler(fn, request, body);
    } catch (e) {
      console.error(e);
      return json(500, { error: "server_error", message: "Terjadi kesalahan di server." });
    }
  },
};
