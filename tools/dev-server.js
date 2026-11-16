// Server pratinjau lokal: node tools/dev-server.js  lalu buka http://localhost:3000
// Meniru situs live (URL tanpa .html, folder /api) dan memakai GitHub tiruan yang menulis ke folder ini,
// sehingga panel admin bisa dicoba tanpa token. Kata sandi lokal: admin-lokal
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), PORT = Number(process.env.PORT || 3000);
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin-lokal";
process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || "lokal";
process.env.GITHUB_REPO = process.env.GITHUB_REPO || "lokal/lokal";
process.env.GITHUB_API_URL = process.env.GITHUB_API_URL || "http://127.0.0.1:" + PORT + "/__gh";

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain" };
const rnd = () => crypto.randomBytes(20).toString("hex");
const gh = { head: rnd(), blobs: {}, trees: {}, commits: {} };

function readBody(req) {
  return new Promise((resolve) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => resolve(Buffer.concat(c).toString("utf8"))); });
}
function send(res, status, obj) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); }

async function mockGithub(req, res, url) {
  const p = url.pathname.replace(/^\/__gh\/repos\/[^/]+\/[^/]+/, "");
  const body = req.method === "GET" ? null : JSON.parse((await readBody(req)) || "{}");
  let m;
  if (req.method === "GET" && /^\/git\/ref\/heads\//.test(p)) return send(res, 200, { object: { sha: gh.head } });
  if (req.method === "GET" && (m = /^\/git\/commits\/(\w+)/.exec(p))) return send(res, 200, { sha: m[1], tree: { sha: "tree-of-" + m[1] } });
  if (req.method === "GET" && (m = /^\/contents\/(.+)/.exec(p))) {
    const f = path.join(ROOT, m[1]);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return send(res, 404, { message: "Not Found" });
    return send(res, 200, { content: fs.readFileSync(f).toString("base64"), sha: rnd() });
  }
  if (req.method === "POST" && p === "/git/blobs") { const sha = rnd(); gh.blobs[sha] = Buffer.from(body.content, "base64"); return send(res, 201, { sha }); }
  if (req.method === "POST" && p === "/git/trees") { const sha = rnd(); gh.trees[sha] = body.tree; return send(res, 201, { sha }); }
  if (req.method === "POST" && p === "/git/commits") {
    if (body.parents[0] !== gh.head) return send(res, 422, { message: "not fast forward" });
    const sha = rnd(); gh.commits[sha] = body.tree; return send(res, 201, { sha });
  }
  if (req.method === "PATCH" && /^\/git\/refs\/heads\//.test(p)) {
    for (const e of gh.trees[gh.commits[body.sha]] || []) {
      const f = path.join(ROOT, e.path);
      if (!f.startsWith(ROOT)) continue;
      if (e.sha === null) { if (fs.existsSync(f)) fs.unlinkSync(f); continue; }
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, e.content != null ? e.content : gh.blobs[e.sha]);
    }
    gh.head = body.sha; return send(res, 200, { object: { sha: gh.head } });
  }
  send(res, 404, { message: "Not Found" });
}

async function api(req, res, name) {
  const file = path.join(ROOT, "api", name + ".js");
  if (name.startsWith("_") || !fs.existsSync(file)) return send(res, 404, { error: "not_found" });
  const raw = await readBody(req);
  try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
  res.status = (s) => { res.statusCode = s; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
  await require(file)(req, res);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/__gh/")) return await mockGithub(req, res, url);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname.slice(5));
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, rel + ".html");
    let status = 200;
    if (!fs.existsSync(file)) { file = path.join(ROOT, "404.html"); status = 404; }
    res.writeHead(status, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end("error"); }
}).listen(PORT, () => console.log("Pratinjau: http://localhost:" + PORT + "  |  admin: /admin (kata sandi: " + process.env.ADMIN_PASSWORD + ")"));
