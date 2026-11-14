/* AgriXentris Nusantara: perilaku situs publik (tanpa dependensi) */
(function () {
  "use strict";

  var WA_DEFAULT = "6289607718976";
  var CAT_ICONS = ["i-sprout", "i-pot", "i-tools"];
  var data = null;
  var cart = loadCart();

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rupiah(n) { return "Rp " + Number(n).toLocaleString("id-ID"); }
  function src(path) { return /^(https?:|blob:|data:|\/)/.test(path) ? path : "/" + path; }
  function isIllus(path) { return String(path).indexOf("assets/img/produk/") === 0; }
  function icon(id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function waNumber() { return ((data && data.settings && data.settings.wa) || WA_DEFAULT).replace(/\D/g, ""); }
  function waLink(msg) { return "https://wa.me/" + waNumber() + "?text=" + encodeURIComponent(msg); }
  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }
  function product(id) { return (data ? data.products : []).filter(function (p) { return p.id === id; })[0]; }
  function catName(id) {
    var c = (data ? data.catalogs : []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "";
  }
  function priceHtml(p) {
    if (!p.price) return '<span class="price">Tanya harga</span>';
    return '<span class="price">' + rupiah(p.price) + (p.unit ? " <small>per " + esc(p.unit) + "</small>" : "") + "</span>";
  }

  /* ---------- keranjang ---------- */
  function loadCart() {
    try { var c = JSON.parse(localStorage.getItem("agx-cart") || "{}"); return c && typeof c === "object" ? c : {}; }
    catch (e) { return {}; }
  }
  function saveCart() { try { localStorage.setItem("agx-cart", JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return Object.keys(cart).reduce(function (n, k) { return n + cart[k]; }, 0); }
  function setQty(id, n) {
    if (n <= 0) delete cart[id]; else cart[id] = Math.min(n, 999);
    saveCart(); renderCart();
  }
  function addToCart(id, n) {
    var p = product(id); if (!p || p.available === false) return;
    setQty(id, (cart[id] || 0) + (n || 1));
    toast(p.name + " masuk keranjang.");
  }
  function renderCart() {
    var badge = $("#cartCount"), n = cartCount();
    if (badge) { badge.textContent = n; badge.hidden = n === 0; }
    var body = $("#cartBody"); if (!body) return;
    var foot = $("#cartFoot");
    if (!data) { body.innerHTML = '<p class="muted" style="padding:20px 0">Memuat keranjang…</p>'; foot.hidden = true; return; }
    var ids = Object.keys(cart).filter(function (id) { return product(id); });
    if (!ids.length) {
      body.innerHTML = '<div class="state" style="margin-top:16px"><b>Keranjang masih kosong</b>Pilih produk dari katalog, lalu pesan lewat WhatsApp.<br><a class="btn btn-forest btn-sm" href="/produk">Lihat katalog</a></div>';
      foot.hidden = true; return;
    }
    var total = 0, unpriced = false;
    body.innerHTML = ids.map(function (id) {
      var p = product(id), q = cart[id], im = p.images && p.images[0];
      if (p.price) total += p.price * q; else unpriced = true;
      return '<div class="citem">' +
        (im ? '<img alt="" src="' + esc(src(im)) + '">' : '<span></span>') +
        "<div><b>" + esc(p.name) + "</b>" + priceHtml(p) +
        '<div style="display:flex;gap:10px;align-items:center;margin-top:6px"><span class="qty"><button type="button" data-q="-1" data-id="' + esc(id) + '" aria-label="Kurangi jumlah ' + esc(p.name) + '">−</button><output>' + q +
        '</output><button type="button" data-q="1" data-id="' + esc(id) + '" aria-label="Tambah jumlah ' + esc(p.name) + '">+</button></span>' +
        '<button type="button" class="rm" data-rm="' + esc(id) + '">Hapus</button></div></div><span></span></div>';
    }).join("");
    foot.hidden = false;
    $("#cartTotal").textContent = rupiah(total) + (unpriced ? " + item tanya harga" : "");
  }
  function openCart() { renderCart(); $("#cartDrawer").showModal(); }

  /* ---------- data pemesan ---------- */
  var CUST_FIELDS = ["nama", "hp", "email", "alamat"];
  function loadCustomer() {
    try { var c = JSON.parse(localStorage.getItem("agx-customer") || "{}"); return c && typeof c === "object" ? c : {}; }
    catch (e) { return {}; }
  }
  var CUST_RULES = {
    nama: function (v) { return v ? "" : "Isi nama lengkap Anda."; },
    hp: function (v) { var d = v.replace(/\D/g, ""); return d.length >= 9 && d.length <= 15 ? "" : "Isi nomor HP aktif, contoh 0812 3456 7890."; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Isi email seperti nama@email.com."; },
    alamat: function (v) { return v ? "" : "Isi alamat pengiriman."; }
  };
  function orderMessage(c) {
    var total = 0, unpriced = false;
    var lines = Object.keys(cart).filter(function (id) { return product(id); }).map(function (id, i) {
      var p = product(id), q = cart[id];
      if (p.price) total += p.price * q; else unpriced = true;
      return (i + 1) + ". " + p.name + " x" + q + (p.price ? " (" + rupiah(p.price * q) + ")" : " (tanya harga)");
    });
    if (!lines.length) return null;
    return "Halo AgriXentris Nusantara, saya ingin memesan:\n" + lines.join("\n") +
      "\n\nTotal: " + rupiah(total) + (unpriced ? " (belum termasuk item tanya harga)" : "") +
      "\n\nNama: " + c.nama + "\nNo. HP: " + c.hp + "\nEmail: " + c.email + "\nAlamat pengiriman: " + c.alamat;
  }
  var custForm = $("#cartFoot");
  if (custForm && custForm.elements && custForm.elements.nama) {
    var custVal = function (k) { return custForm.elements[k].value.replace(/\s+/g, " ").trim(); };
    var custValues = function () { var c = {}; CUST_FIELDS.forEach(function (k) { c[k] = custVal(k); }); return c; };
    // Galat tampil setelah isian ditinggalkan, dan hilang begitu isian disentuh lagi.
    // Tempat galat selalu ada (lihat .ferr di CSS) supaya tombol tidak bergeser saat galat muncul.
    var custErr = function (k, msg) {
      var el = custForm.elements[k], slot = $("#" + el.id + "Err");
      slot.textContent = msg;
      if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    };
    var saved = loadCustomer();
    CUST_FIELDS.forEach(function (k) { if (typeof saved[k] === "string") custForm.elements[k].value = saved[k]; });
    custForm.addEventListener("focusout", function (e) {
      var k = e.target.name; if (!CUST_RULES[k]) return;
      custErr(k, CUST_RULES[k](custVal(k)));
      try { localStorage.setItem("agx-customer", JSON.stringify(custValues())); } catch (e2) {}
    });
    var custClear = function (e) {
      var k = e.target.name; if (!CUST_RULES[k]) return;
      custErr(k, ""); $("#cartErr").textContent = "";
    };
    custForm.addEventListener("focusin", custClear);
    custForm.addEventListener("input", custClear);
    custForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = custValues();
      var bad = CUST_FIELDS.filter(function (k) { return CUST_RULES[k](c[k]); });
      if (bad.length) {
        var first = custForm.elements[bad[0]];
        first.focus(); first.scrollIntoView({ block: "nearest" });
        CUST_FIELDS.forEach(function (k) { custErr(k, CUST_RULES[k](c[k])); });
        $("#cartErr").textContent = bad.length >= 3 ? bad.length + " isian perlu dilengkapi." : "";
        return;
      }
      var msg = orderMessage(c);
      if (!msg) return;
      $("#cartErr").textContent = "";
      try { localStorage.setItem("agx-customer", JSON.stringify(c)); } catch (e2) {}
      window.open(waLink(msg), "_blank", "noopener");
    });
  }

  /* ---------- kartu produk ---------- */
  function card(p) {
    var im = p.images && p.images[0], out = p.available === false;
    return '<article class="pcard"><div class="pimg">' +
      (im ? '<img loading="lazy" alt=""' + (isIllus(im) ? ' class="illus"' : "") + ' src="' + esc(src(im)) + '">' : "") +
      (out ? '<span class="chip out">Stok habis</span>' : p.badge ? '<span class="chip">' + esc(p.badge) + "</span>" : "") +
      (im && isIllus(im) ? '<span class="chip note">Ilustrasi</span>' : "") +
      '</div><div class="pbody"><a class="pname" href="/produk?p=' + encodeURIComponent(p.slug) + '">' + esc(p.name) + "</a>" +
      '<div class="prow">' + priceHtml(p) +
      '<button type="button" class="add-btn" data-add="' + esc(p.id) + '"' + (out ? " disabled" : "") +
      ' aria-label="Tambah ' + esc(p.name) + ' ke keranjang">' + icon("i-cart") + "</button></div></div></article>";
  }
  function stateBox(title, text, withWa) {
    return '<div class="state"><b>' + esc(title) + "</b>" + esc(text) +
      (withWa ? '<br><a class="btn btn-forest btn-sm" target="_blank" rel="noopener" href="' + esc(waLink("Halo AgriXentris Nusantara, saya ingin tahu produk yang tersedia.")) + '">' + icon("i-wa") + "Tanya via WhatsApp</a>" : "") + "</div>";
  }

  /* ---------- beranda ---------- */
  function renderHome() {
    var s = data.settings || {};
    if (s.hero && $("#heroImg")) $("#heroImg").src = src(s.hero);
    var counts = {};
    data.products.forEach(function (p) { counts[p.catalog] = (counts[p.catalog] || 0) + 1; });
    var cats = $("#catsGrid");
    if (cats) cats.innerHTML = data.catalogs.map(function (c, i) {
      return '<a class="cat" href="/produk?k=' + encodeURIComponent(c.id) + '">' + icon(CAT_ICONS[i % 3]) + "<b>" + esc(c.name) + "</b><span>" + (counts[c.id] || 0) + " produk</span></a>";
    }).join("") + '<a class="cat" href="/layanan">' + icon("i-consult") + "<b>Jasa &amp; Konsultasi</b><span>4 lini layanan</span></a>";
    var grid = $("#featuredGrid");
    if (grid) {
      var list = data.products.filter(function (p) { return p.featured; });
      if (!list.length) list = data.products.slice();
      list = list.slice(0, 4);
      grid.innerHTML = list.length ? list.map(card).join("") : "";
      if (!list.length) grid.outerHTML = stateBox("Katalog sedang disiapkan", "Produk akan segera tampil di sini.", true);
    }
  }

  /* ---------- foto latar hero ---------- */
  function initHero() {
    var hero = $(".hero"), slides = $$("#heroBg img"), dots = $$("#heroDots button");
    if (!hero || slides.length < 2) return;
    var cur = 0, timer = null, hold = false;
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function load(im) { var d = im.getAttribute("data-src"); if (d) { im.src = d; im.removeAttribute("data-src"); } }
    function go(n) {
      cur = (n + slides.length) % slides.length;
      load(slides[cur]);
      slides.forEach(function (im, k) { im.classList.toggle("on", k === cur); });
      dots.forEach(function (d, k) { d.setAttribute("aria-current", k === cur); });
    }
    function stop() { clearInterval(timer); timer = null; }
    function start() {
      stop();
      if (still || hold || document.hidden) return;
      timer = setInterval(function () {
        var next = slides[(cur + 1) % slides.length];
        load(next);
        if (next.complete && next.naturalWidth) go(cur + 1); // tunggu foto berikutnya selesai dimuat
      }, 6000);
    }
    dots.forEach(function (d, k) { d.addEventListener("click", function () { go(k); start(); }); });
    hero.addEventListener("mouseenter", function () { hold = true; stop(); });
    hero.addEventListener("mouseleave", function () { hold = false; start(); });
    hero.addEventListener("focusin", function () { hold = true; stop(); });
    hero.addEventListener("focusout", function () { hold = false; start(); });
    document.addEventListener("visibilitychange", start);
    function warm() { load(slides[1]); start(); }
    if (document.readyState === "complete") warm(); else window.addEventListener("load", warm);
  }

  /* ---------- video ---------- */
  function videoEmbed(url) {
    var m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/.exec(url || "");
    if (m) return "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&rel=0";
    m = /drive\.google\.com\/file\/d\/([\w-]{10,})/.exec(url || "");
    if (m) return "https://drive.google.com/file/d/" + m[1] + "/preview";
    return null;
  }
  function renderVideo() {
    var embed = videoEmbed(data.settings && data.settings.video);
    $$(".video-sec").forEach(function (sec) {
      sec.hidden = !embed;
      var btn = $(".play", sec); if (!btn || !embed) return;
      btn.addEventListener("click", function () {
        var f = document.createElement("iframe");
        f.src = embed; f.title = "Video profil AgriXentris Nusantara";
        f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
        btn.parentNode.appendChild(f); btn.remove();
      });
    });
  }

  /* ---------- katalog & detail ---------- */
  var view = { cat: "all", q: "" };
  function params() { return new URLSearchParams(location.search); }
  function renderCatalog() {
    var listEl = $("#catalogList"); if (!listEl) return;
    var counts = { all: data.products.length };
    data.products.forEach(function (p) { counts[p.catalog] = (counts[p.catalog] || 0) + 1; });
    $("#tabs").innerHTML = [{ id: "all", name: "Semua produk" }].concat(data.catalogs).map(function (c) {
      return '<button type="button" class="tab" role="tab" data-cat="' + esc(c.id) + '" aria-selected="' + (view.cat === c.id) + '">' + esc(c.name) + '<span class="n">' + (counts[c.id] || 0) + "</span></button>";
    }).join("");
    var cur = data.catalogs.filter(function (c) { return c.id === view.cat; })[0];
    $("#catDesc").textContent = cur ? (cur.desc || "") : "Semua produk dari " + data.catalogs.length + " katalog.";
    var q = view.q.trim().toLowerCase();
    var list = data.products.filter(function (p) {
      if (view.cat !== "all" && p.catalog !== view.cat) return false;
      if (!q) return true;
      return (p.name + " " + (p.subtitle || "") + " " + (p.desc || "")).toLowerCase().indexOf(q) >= 0;
    });
    if (list.length) listEl.innerHTML = '<div class="pgrid">' + list.map(card).join("") + "</div>";
    else if (q) listEl.innerHTML = stateBox("Tidak ada produk untuk “" + view.q + "”", "Coba kata kunci lain, atau tanyakan langsung ke tim kami.", true);
    else listEl.innerHTML = stateBox(data.products.length ? "Belum ada produk di katalog ini" : "Katalog sedang disiapkan", "Tanyakan ketersediaan produk lewat WhatsApp.", true);
  }
  function syncUrl() {
    var p = new URLSearchParams();
    if (view.cat !== "all") p.set("k", view.cat);
    if (view.q.trim()) p.set("q", view.q.trim());
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }
  function renderDetail(p) {
    var el = $("#detailView"), imgs = p.images || [], out = p.available === false;
    var specs = (p.specs || "").split("\n").map(function (l) {
      var i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null;
    }).filter(Boolean);
    var related = data.products.filter(function (x) { return x.id !== p.id; })
      .sort(function (a, b) { return (b.catalog === p.catalog) - (a.catalog === p.catalog); }).slice(0, 4);
    document.title = p.name + " | AgriXentris Nusantara";
    el.innerHTML =
      '<nav class="crumb" aria-label="Lokasi halaman"><a href="/">Beranda</a><span>/</span><a href="/produk">Produk</a><span>/</span><a href="/produk?k=' + encodeURIComponent(p.catalog) + '">' + esc(catName(p.catalog)) + "</a><span>/</span><span>" + esc(p.name) + "</span></nav>" +
      '<div class="pd"><div><div class="pd-main">' +
      (imgs.length ? '<img id="pdMain" alt="' + esc(p.name) + '"' + (isIllus(imgs[0]) ? ' class="illus"' : "") + ' src="' + esc(src(imgs[0])) + '">' : "") +
      (imgs.length && isIllus(imgs[0]) ? '<span class="chip note">Ilustrasi, foto produk menyusul</span>' : "") + "</div>" +
      (imgs.length > 1 ? '<div class="pd-thumbs">' + imgs.map(function (im, i) {
        return '<button type="button" data-img="' + esc(im) + '" aria-label="Foto ' + (i + 1) + '" aria-current="' + (i === 0) + '"><img alt="" src="' + esc(src(im)) + '"></button>';
      }).join("") + "</div>" : "") +
      '</div><div><span class="cat-tag">' + esc(catName(p.catalog)) + "</span><h1>" + esc(p.name) + "</h1>" +
      (p.subtitle ? '<p class="muted" style="margin-top:8px">' + esc(p.subtitle) + "</p>" : "") +
      '<div style="margin-top:14px">' + priceHtml(p).replace('class="price"', 'class="price" style="font-size:1.6rem"') + "</div>" +
      (p.desc ? '<p class="desc">' + esc(p.desc) + "</p>" : "") +
      (specs.length ? '<dl class="specs">' + specs.map(function (s) { return "<dt>" + esc(s[0]) + "</dt><dd>" + esc(s[1]) + "</dd>"; }).join("") + "</dl>" : "") +
      (out ? '<p style="margin-top:16px;font-weight:600">Stok sedang habis. Tanyakan jadwal restok lewat WhatsApp.</p>' : "") +
      '<div class="buy">' +
      (out ? "" : '<span class="qty"><button type="button" id="qMinus" aria-label="Kurangi jumlah">−</button><output id="qVal">1</output><button type="button" id="qPlus" aria-label="Tambah jumlah">+</button></span>' +
        '<button type="button" class="btn btn-forest" id="pdAdd">' + icon("i-cart") + "Tambah ke keranjang</button>") +
      (out ? '<a class="btn btn-line" target="_blank" rel="noopener" href="' + esc(waLink("Halo AgriXentris Nusantara, kapan " + p.name + " tersedia lagi?")) + '">' + icon("i-wa") + "Tanya stok via WhatsApp</a>"
        : '<button type="button" class="btn btn-line" id="pdOrder">' + icon("i-wa") + "Pesan via WhatsApp</button>") + "</div></div></div>" +
      (related.length ? '<div class="sec-head" style="margin-top:56px"><h2 class="sec-title">Produk lainnya</h2><a class="link-more" href="/produk">Lihat semua produk' + icon("i-arrow") + '</a></div><div class="pgrid">' + related.map(card).join("") + "</div>" : "");
    var q = 1;
    el.addEventListener("click", function (e) {
      var th = e.target.closest(".pd-thumbs button");
      if (th) {
        var m = $("#pdMain"), im = th.getAttribute("data-img");
        m.src = src(im); m.className = isIllus(im) ? "illus" : "";
        $$(".pd-thumbs button", el).forEach(function (b) { b.setAttribute("aria-current", b === th); });
      }
      if (e.target.closest("#qMinus")) { q = Math.max(1, q - 1); $("#qVal").textContent = q; }
      if (e.target.closest("#qPlus")) { q = Math.min(999, q + 1); $("#qVal").textContent = q; }
      if (e.target.closest("#pdAdd")) addToCart(p.id, q);
      if (e.target.closest("#pdOrder")) { if (!cart[p.id]) setQty(p.id, q); openCart(); }
    });
  }
  function renderProduk() {
    var pr = params(), slug = pr.get("p");
    if (slug) {
      var p = data.products.filter(function (x) { return x.slug === slug; })[0];
      $("#catalogView").hidden = true; $("#detailView").hidden = false;
      if (p) renderDetail(p);
      else $("#detailView").innerHTML = '<div class="state"><b>Produk tidak ditemukan</b>Produk ini mungkin sudah tidak tersedia.<br><a class="btn btn-forest btn-sm" href="/produk">Kembali ke katalog</a></div>';
      return;
    }
    var k = pr.get("k");
    view.cat = data.catalogs.some(function (c) { return c.id === k; }) ? k : "all";
    view.q = pr.get("q") || "";
    var input = $("#catalogSearch"); input.value = view.q;
    input.addEventListener("input", function () { view.q = input.value; renderCatalog(); syncUrl(); });
    $("#tabs").addEventListener("click", function (e) {
      var t = e.target.closest("[data-cat]"); if (!t) return;
      view.cat = t.getAttribute("data-cat"); renderCatalog(); syncUrl();
    });
    renderCatalog();
  }

  /* ---------- galeri ---------- */
  function renderGallery() {
    var g = $("#galleryGrid"); if (!g) return;
    var list = data.gallery || [];
    g.innerHTML = list.length ? list.map(function (it, i) {
      var alt = it.caption || "Foto kegiatan AgriXentris Nusantara";
      return '<figure><button type="button" class="gbtn" data-g="' + i + '" aria-label="Perbesar foto: ' + esc(alt) + '"><img loading="lazy" alt="' + esc(alt) + '" src="' + esc(src(it.image)) + '"></button>' +
        (it.caption ? "<figcaption>" + esc(it.caption) + "</figcaption>" : "") + "</figure>";
    }).join("") : "";
    $("#gallerySec").hidden = !list.length;
  }
  var lb = null, lbIdx = 0;
  function showLightbox(i) {
    var list = data.gallery, it;
    lbIdx = (i + list.length) % list.length; it = list[lbIdx];
    var im = $("img", lb);
    im.src = src(it.image); im.alt = it.caption || "Foto kegiatan AgriXentris Nusantara";
    $(".lb-cap", lb).textContent = it.caption || "";
    $(".lb-count", lb).textContent = (lbIdx + 1) + " / " + list.length;
  }
  function openLightbox(i) {
    if (!data || !(data.gallery || []).length) return;
    if (!lb) {
      lb = document.createElement("dialog");
      lb.className = "lightbox on-dark"; lb.setAttribute("aria-label", "Foto galeri");
      lb.innerHTML = '<button type="button" class="lb-btn lb-x" data-lb="x" aria-label="Tutup">' + icon("i-x") + "</button>" +
        '<button type="button" class="lb-btn lb-prev" data-lb="-1" aria-label="Foto sebelumnya">' + icon("i-arrow") + "</button>" +
        '<figure><img alt=""><figcaption><span class="lb-cap" aria-live="polite"></span><span class="lb-count"></span></figcaption></figure>' +
        '<button type="button" class="lb-btn lb-next" data-lb="1" aria-label="Foto berikutnya">' + icon("i-arrow") + "</button>";
      document.body.appendChild(lb);
      lb.addEventListener("click", function (e) {
        var b = e.target.closest("[data-lb]");
        if (!b) { if (!e.target.closest("figure")) lb.close(); return; }
        if (b.getAttribute("data-lb") === "x") lb.close(); else showLightbox(lbIdx + Number(b.getAttribute("data-lb")));
      });
      lb.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") showLightbox(lbIdx - 1);
        if (e.key === "ArrowRight") showLightbox(lbIdx + 1);
      });
    }
    showLightbox(i); lb.showModal();
  }

  /* ---------- umum ---------- */
  function refreshWa() {
    $$(".js-wa").forEach(function (a) { a.href = waLink(a.getAttribute("data-msg") || "Halo AgriXentris Nusantara, saya ingin bertanya."); });
  }
  function fail() {
    ["#featuredGrid", "#catalogList", "#detailView"].forEach(function (s) {
      var el = $(s);
      if (el) el.innerHTML = '<div class="state"><b>Katalog gagal dimuat</b>Periksa koneksi lalu muat ulang halaman, atau hubungi kami lewat WhatsApp.<br><button type="button" class="btn btn-forest btn-sm" onclick="location.reload()">Muat ulang</button></div>';
    });
    renderCart();
  }

  document.addEventListener("click", function (e) {
    var add = e.target.closest("[data-add]");
    if (add) { e.preventDefault(); addToCart(add.getAttribute("data-add"), 1); return; }
    var qb = e.target.closest("[data-q]");
    if (qb) { var id = qb.getAttribute("data-id"); setQty(id, (cart[id] || 0) + Number(qb.getAttribute("data-q"))); return; }
    var gb = e.target.closest("[data-g]");
    if (gb) { openLightbox(Number(gb.getAttribute("data-g"))); return; }
    var rm = e.target.closest("[data-rm]");
    if (rm) { setQty(rm.getAttribute("data-rm"), 0); return; }
    if (e.target.closest("#cartBtn")) { openCart(); return; }
    if (e.target.closest("#cartClose")) { $("#cartDrawer").close(); return; }
    if (e.target.closest("#menuBtn")) {
      var open = $("#nav").classList.toggle("open");
      $("#menuBtn").setAttribute("aria-expanded", open); return;
    }
    if (e.target.closest("#searchBtn")) {
      var bar = $("#searchbar"); bar.hidden = !bar.hidden;
      $("#searchBtn").setAttribute("aria-expanded", !bar.hidden);
      if (!bar.hidden) $("input", bar).focus();
      return;
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var nav = $("#nav"), bar = $("#searchbar");
    if (nav && nav.classList.contains("open")) { nav.classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false"); $("#menuBtn").focus(); }
    else if (bar && !bar.hidden) { bar.hidden = true; $("#searchBtn").setAttribute("aria-expanded", "false"); $("#searchBtn").focus(); }
  });
  var drawer = $("#cartDrawer");
  if (drawer) drawer.addEventListener("click", function (e) { if (e.target === drawer) drawer.close(); });
  document.addEventListener("error", function (e) {
    var im = e.target;
    if (im && im.tagName === "IMG" && im.closest(".pimg, .pd-main, .gallery, .citem")) im.style.visibility = "hidden";
  }, true);

  var form = $("#contactForm");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = form.elements.nama.value.trim(), need = form.elements.kebutuhan.value, text = form.elements.pesan.value.trim();
    var err = $("#formErr");
    if (!name || !text) { err.textContent = "Isi nama dan pesan terlebih dahulu."; (name ? form.elements.pesan : form.elements.nama).focus(); return; }
    err.textContent = "";
    window.open(waLink("Halo AgriXentris Nusantara.\nNama: " + name + "\nKebutuhan: " + need + "\n\n" + text), "_blank", "noopener");
    $("#formOk").textContent = "WhatsApp terbuka di tab baru. Tekan kirim di sana untuk mengirim pesan Anda.";
  });

  var yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();
  initHero();
  renderCart();

  fetch("/data/site.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (d) {
      data = d;
      data.products = data.products || []; data.catalogs = data.catalogs || []; data.settings = data.settings || {};
      refreshWa(); renderCart(); renderVideo(); renderGallery();
      var page = document.body.getAttribute("data-page");
      if (page === "home") renderHome();
      if (page === "produk") renderProduk();
      document.dispatchEvent(new CustomEvent("agx:data", { detail: data }));
    })
    .catch(fail);
})();
