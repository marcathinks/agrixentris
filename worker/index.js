// Cloudflare Workers: menyajikan situs statis dan menjalankan API panel admin.
// Halaman, gambar, dan data disajikan langsung oleh Cloudflare dari file di repo.
// Hanya permintaan ke /api/* yang menjalankan kode ini (lihat run_worker_first di wrangler.jsonc).
// Fungsi API-nya ada di folder api/ dan juga dipakai tools/dev-server.js.
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

// Menjalankan fungsi bergaya (req, res) di folder api/ dengan Request/Response milik Workers.
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

// Penyajian file statis Workers mengabaikan header Range dan selalu mengirim file utuh (200).
// Safari (iPhone, iPad, Mac) hanya mau memutar video bila server bisa mengirim potongan file (206),
// jadi video di assets/video/ disajikan lewat sini.
async function serveVideo(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (!asset.ok) return asset;
  const headers = new Headers(asset.headers);
  headers.set("Accept-Ranges", "bytes");
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  const range = request.headers.get("range");
  const head = request.method === "HEAD";
  if (!range) return new Response(head ? null : asset.body, { status: 200, headers });

  const buf = await asset.arrayBuffer();
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start, end;
  if (m && m[1] !== "") { start = Number(m[1]); end = m[2] !== "" ? Math.min(Number(m[2]), size - 1) : size - 1; }
  else if (m && m[2] !== "") { start = Math.max(size - Number(m[2]), 0); end = size - 1; }
  if (start === undefined || !(start <= end) || start >= size) {
    headers.set("Content-Range", "bytes */" + size); headers.delete("Content-Length");
    return new Response(null, { status: 416, headers });
  }
  headers.set("Content-Range", "bytes " + start + "-" + end + "/" + size);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(head ? null : buf.slice(start, end + 1), { status: 206, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // File verifikasi Google Search Console (googleXXXX.html) harus terbuka langsung tanpa dialihkan.
    // Penyajian bawaan mengalihkan /x.html ke /x, jadi file diambil lewat alamat tanpa .html.
    const gsc = /^\/google[0-9a-f]+\.html$/.exec(url.pathname);
    if (gsc) {
      const r = await env.ASSETS.fetch(new Request(new URL(url.pathname.slice(0, -5), url), request));
      return new Response(r.body, { status: r.status, headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS } });
    }
    if (url.pathname.startsWith("/assets/video/")) return serveVideo(request, env, url);
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
