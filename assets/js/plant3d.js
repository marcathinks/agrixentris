/* Tanaman cabai hias 3D: model prosedural, digambar di canvas 2D dengan proyeksi perspektif.
   Tanpa pustaka luar. Putar dengan seret atau tombol panah; warna buah mengikuti varietas. */
(function () {
  "use strict";

  var VARIETIES = [
    { id: "triwarsana", slug: "benih-cabai-ornamental-triwarsana-ipb", name: "Triwarsana IPB",
      colors: ["#5B2A86", "#D7322C", "#F08A1C", "#F2C21B", "#F1E2B3"],
      text: "Buah beraneka warna (ungu, merah, oranye, kuning, krem) saat matang. Cocok untuk tanaman hias pot, dekorasi taman, dan koleksi." },
    { id: "nazla", slug: "benih-cabai-ornamental-nazla-ipb", name: "Nazla IPB",
      colors: ["#5B2A86", "#6E3A9E", "#4A2170"],
      text: "Buah berwarna ungu mengkilap saat matang. Cocok untuk tanaman hias pot, penghias taman, dan dekorasi." },
    { id: "ayesha", slug: "benih-cabai-ornamental-ayesha-ipb", name: "Ayesha IPB",
      colors: ["#F2C21B", "#F08A1C", "#D7322C"],
      text: "Buah beraneka warna (kuning, oranye, dan merah) saat matang. Cocok untuk tanaman hias pot, dekorasi taman, dan koleksi." }
  ];

  var canvas = document.getElementById("plantCanvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----- util ----- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rgb(c, k) { k = k == null ? 1 : k; return "rgb(" + Math.round(Math.min(255, c[0] * k)) + "," + Math.round(Math.min(255, c[1] * k)) + "," + Math.round(Math.min(255, c[2] * k)) + ")"; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function bez(p0, p1, p2, t) { var u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2]]; }

  /* ----- model: batang, daun, buah (satuan: tinggi tanaman sekitar 1) ----- */
  var R = rng(20261114), stems = [], leaves = [], fruits = [];
  var LEAF_COLORS = [hex("#2F7D3B"), hex("#3C9447"), hex("#27693A"), hex("#4AA352")];
  function leafAt(p, dir, len, ci) {
    var d = norm(dir), side = norm(cross(d, [0, 1, 0])), up = norm(cross(side, d));
    var pts = [], steps = [[0, 0], [0.25, 0.3], [0.55, 0.36], [0.82, 0.22], [1, 0], [0.82, -0.22], [0.55, -0.36], [0.25, -0.3]];
    steps.forEach(function (s) {
      var droop = -0.22 * s[0] * s[0], cup = 0.1 * Math.abs(s[1]);
      pts.push(add(p, add(add(mul(d, s[0] * len), mul(side, s[1] * len)), mul(up, (droop + cup) * len))));
    });
    leaves.push({ pts: pts, base: p, tip: add(p, add(mul(d, len), mul(up, -0.22 * len))), n: up, c: LEAF_COLORS[ci % 4] });
  }
  var top = [0, 0.2, 0];
  stems.push([[0, 0, 0], [0.012, 0.1, 0.008], top]);
  var BR = 11;
  for (var i = 0; i < BR; i++) {
    var az = (i / BR) * Math.PI * 2 + (R() - 0.5) * 0.5;
    var inner = i % 3 === 2;
    var reach = inner ? 0.16 + R() * 0.1 : 0.44 + R() * 0.18;
    var h = inner ? 0.95 + R() * 0.12 : 0.58 + R() * 0.3;
    var end = [Math.cos(az) * reach, h, Math.sin(az) * reach];
    var mid = [Math.cos(az) * reach * 0.3, 0.2 + (h - 0.2) * 0.6, Math.sin(az) * reach * 0.3];
    var pts = []; for (var s = 0; s <= 7; s++) pts.push(bez(top, mid, end, s / 7));
    stems.push(pts);
    var out = [Math.cos(az), 0, Math.sin(az)];
    [0.34, 0.5, 0.66, 0.82, 0.96].forEach(function (t, j) {
      var p = bez(top, mid, end, t), sgn = (j + i) % 2 ? 1 : -1, a = az + sgn * (0.7 + R() * 0.7);
      leafAt(p, [Math.cos(a), 0.25 + R() * 0.3, Math.sin(a)], 0.2 + R() * 0.08, i + j);
    });
    leafAt(end, [out[0], 0.5, out[2]], 0.2, i);
    [0.8, 0.98].forEach(function (t, j) {
      if (j === 0 && inner) return;
      var p = bez(top, mid, end, t);
      fruits.push({ base: p, dir: norm([out[0] * 0.28 + (R() - 0.5) * 0.3, 1, out[2] * 0.28 + (R() - 0.5) * 0.3]), len: 0.16 + R() * 0.05, i: fruits.length });
    });
  }

  /* ----- keadaan ----- */
  var variety = 0, cur = [], from = [], to = [], tStart = 0;
  function palette(v) { return fruits.map(function (f) { return hex(VARIETIES[v].colors[f.i % VARIETIES[v].colors.length]); }); }
  cur = palette(0); from = cur; to = cur;
  var theta = 0.6, vel = 0, auto = reduce ? 0 : 0.35, playing = !reduce, dragging = false, lastX = 0;
  var grow = reduce ? 1 : 0, visible = false, raf = 0, last = 0, W = 0, H = 0, dpr = 1;

  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    draw();
  }

  /* ----- proyeksi ----- */
  var TILT = 0.2, CT = Math.cos(TILT), ST = Math.sin(TILT), F = 3.4;
  function project(p, cs, sn, S, cx, baseY) {
    var x = p[0] * cs + p[2] * sn, z = -p[0] * sn + p[2] * cs, y = p[1];
    var y2 = y * CT - z * ST, z2 = y * ST + z * CT, k = F / (F + z2);
    return [cx + x * k * S, baseY - y2 * k * S, z2, k];
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var S = Math.min(H * 0.5, W * 0.6), cx = W / 2, baseY = H * 0.665;
    var potW = S * 0.27, potH = S * 0.36, ry = potW * ST * 1.05, g = easeOut(grow);

    // bayangan dan pot
    ctx.fillStyle = "rgba(11,58,32,.14)";
    ctx.beginPath(); ctx.ellipse(cx, baseY + potH + ry * 0.4, potW * 1.25, ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    var grad = ctx.createLinearGradient(cx - potW, 0, cx + potW, 0);
    grad.addColorStop(0, "#073A1F"); grad.addColorStop(0.38, "#17743E"); grad.addColorStop(0.62, "#0F5A30"); grad.addColorStop(1, "#052B17");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - potW, baseY); ctx.lineTo(cx - potW * 0.72, baseY + potH);
    ctx.ellipse(cx, baseY + potH, potW * 0.72, ry * 0.72, 0, Math.PI, 0, true);
    ctx.lineTo(cx + potW, baseY); ctx.closePath(); ctx.fill();
    // bibir pot
    var rimH = S * 0.055;
    ctx.beginPath();
    ctx.moveTo(cx - potW * 1.08, baseY - rimH); ctx.lineTo(cx - potW * 1.08, baseY);
    ctx.ellipse(cx, baseY, potW * 1.08, ry * 1.08, 0, Math.PI, 0, true);
    ctx.lineTo(cx + potW * 1.08, baseY - rimH); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1E8A4A";
    ctx.beginPath(); ctx.ellipse(cx, baseY - rimH, potW * 1.08, ry * 1.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3A2A1D";
    ctx.beginPath(); ctx.ellipse(cx, baseY - rimH, potW * 0.95, ry * 0.95, 0, 0, Math.PI * 2); ctx.fill();

    // tanaman
    var cs = Math.cos(theta), sn = Math.sin(theta), oy = baseY - rimH, prims = [];
    function P(p) { return project([p[0] * g, p[1] * g, p[2] * g], cs, sn, S, cx, oy); }
    stems.forEach(function (st, si) {
      for (var j = 0; j < st.length - 1; j++) {
        var a = P(st[j]), b = P(st[j + 1]);
        prims.push({ z: (a[2] + b[2]) / 2, t: 0, a: a, b: b, w: (si === 0 ? 0.03 : 0.014 * (1 - j / 12)) * S * a[3] });
      }
    });
    var lx = 0.45, ly = 0.8, lz = -0.4;
    leaves.forEach(function (lf) {
      var pp = lf.pts.map(P), zc = 0; pp.forEach(function (q) { zc += q[2]; });
      var n = lf.n, nx = n[0] * cs + n[2] * sn, nz = -n[0] * sn + n[2] * cs;
      var lit = 0.62 + 0.42 * Math.abs(nx * lx + n[1] * ly + nz * lz);
      prims.push({ z: zc / pp.length, t: 1, pp: pp, a: P(lf.base), b: P(lf.tip), col: rgb(lf.c, lit), dark: rgb(lf.c, lit * 0.72) });
    });
    fruits.forEach(function (f, i) {
      var a = P(f.base), b = P(add(f.base, mul(f.dir, f.len)));
      prims.push({ z: (a[2] + b[2]) / 2 - 0.1, t: 2, a: a, b: b, c: cur[i], r: f.len * 0.2 * S * a[3] * g });
    });
    prims.sort(function (p, q) { return q.z - p.z; });
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    prims.forEach(function (p) {
      if (p.t === 0) {
        ctx.strokeStyle = "#2A6B38"; ctx.lineWidth = Math.max(1, p.w);
        ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]); ctx.stroke();
      } else if (p.t === 1) {
        ctx.fillStyle = p.col; ctx.beginPath();
        var q = p.pp; ctx.moveTo(q[0][0], q[0][1]);
        for (var k = 1; k < q.length; k++) {
          var c = q[k], nx2 = q[(k + 1) % q.length];
          ctx.quadraticCurveTo(c[0], c[1], (c[0] + nx2[0]) / 2, (c[1] + nx2[1]) / 2);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = p.dark; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]); ctx.stroke();
      } else {
        var dx = p.b[0] - p.a[0], dy = p.b[1] - p.a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy * p.r, py = ux * p.r;
        ctx.fillStyle = rgb(p.c);
        ctx.beginPath();
        ctx.moveTo(p.a[0] + px, p.a[1] + py);
        ctx.bezierCurveTo(p.a[0] + px + dx * 0.6, p.a[1] + py + dy * 0.6, p.b[0] + px * 0.3, p.b[1] + py * 0.3, p.b[0], p.b[1]);
        ctx.bezierCurveTo(p.b[0] - px * 0.3, p.b[1] - py * 0.3, p.a[0] - px + dx * 0.6, p.a[1] - py + dy * 0.6, p.a[0] - px, p.a[1] - py);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = Math.max(1, p.r * 0.32);
        ctx.beginPath(); ctx.moveTo(p.a[0] - px * 0.4 + dx * 0.15, p.a[1] - py * 0.4 + dy * 0.15);
        ctx.lineTo(p.a[0] - px * 0.25 + dx * 0.62, p.a[1] - py * 0.25 + dy * 0.62); ctx.stroke();
        ctx.fillStyle = "#27693A";
        ctx.beginPath(); ctx.ellipse(p.a[0], p.a[1], p.r * 1.15, p.r * 0.55, Math.atan2(uy, ux) + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* ----- loop ----- */
  function frame(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    var busy = false;
    if (grow < 1) { grow = Math.min(1, grow + dt / 1.1); busy = true; }
    if (tStart) {
      var t = Math.min(1, (now - tStart) / 500);
      cur = from.map(function (c, i) { return mix(c, to[i], t); });
      if (t >= 1) tStart = 0; else busy = true;
    }
    if (!dragging) {
      var target = playing ? auto : 0;
      vel += (target - vel) * Math.min(1, dt * 6);
      if (Math.abs(vel) > 0.002) { theta += vel * dt; busy = true; }
    }
    draw();
    if (visible && (busy || playing || dragging)) schedule();
  }
  function schedule() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  /* ----- interaksi ----- */
  canvas.addEventListener("pointerdown", function (e) { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture(e.pointerId); schedule(); });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX; lastX = e.clientX; theta += dx * 0.012; vel = dx * 0.6; schedule();
  });
  function endDrag() { dragging = false; schedule(); }
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { theta -= 0.25; e.preventDefault(); draw(); }
    if (e.key === "ArrowRight") { theta += 0.25; e.preventDefault(); draw(); }
  });
  var toggle = document.getElementById("plantToggle");
  function syncToggle() {
    if (!toggle) return;
    toggle.setAttribute("aria-pressed", playing);
    toggle.textContent = playing ? "Jeda putaran" : "Putar otomatis";
  }
  if (toggle) toggle.addEventListener("click", function () { playing = !playing; if (playing && !auto) auto = 0.35; syncToggle(); schedule(); });
  syncToggle();

  var tabs = document.getElementById("varTabs"), nameEl = document.getElementById("varName"), textEl = document.getElementById("varText"),
      swEl = document.getElementById("varSwatches"), linkEl = document.getElementById("varLink"), priceEl = document.getElementById("varPrice");
  var products = [];
  function showVariety(v, animate) {
    variety = v; var V = VARIETIES[v];
    from = cur; to = palette(v);
    if (animate && !reduce) { tStart = performance.now(); schedule(); } else { cur = to; tStart = 0; draw(); }
    if (tabs) Array.prototype.forEach.call(tabs.children, function (b, i) { b.setAttribute("aria-selected", i === v); });
    if (nameEl) nameEl.textContent = V.name;
    if (textEl) textEl.textContent = V.text;
    if (swEl) swEl.innerHTML = V.colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("");
    var p = products.filter(function (x) { return x.slug === V.slug; })[0];
    if (linkEl) { linkEl.hidden = !p; if (p) linkEl.href = "/produk?p=" + encodeURIComponent(p.slug); }
    if (priceEl) priceEl.textContent = p && p.price ? "Rp " + Number(p.price).toLocaleString("id-ID") + (p.unit ? " / " + p.unit : "") + ", isi 25 benih" : "";
    canvas.setAttribute("aria-label", "Model 3D tanaman cabai hias " + V.name + " dalam pot. Seret atau tekan panah kiri dan kanan untuk memutar.");
  }
  if (tabs) {
    tabs.innerHTML = VARIETIES.map(function (V, i) { return '<button type="button" class="tab" role="tab" data-v="' + i + '">' + V.name + "</button>"; }).join("");
    tabs.addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (b) showVariety(Number(b.getAttribute("data-v")), true); });
  }
  document.addEventListener("agx:data", function (e) { products = e.detail.products || []; showVariety(variety, false); });
  showVariety(0, false);

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) schedule(); }, { threshold: 0.15 }).observe(canvas);
  } else { visible = true; }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) schedule(); });
  resize(); schedule();
})();
