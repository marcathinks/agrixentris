/* Panel admin AgriXentris Nusantara.
   Perubahan disimpan sebagai draf di halaman ini, lalu diterbitkan ke repo GitHub lewat /api/publish. */
(function () {
  "use strict";

  var DEFAULT_HERO = "assets/img/hero-greenhouse-dalam-2400.webp";
  var token = null, head = null, published = "", draft = null;
  var pending = {};   // path foto baru -> sha blob di GitHub
  var previews = {};  // path foto baru -> URL pratinjau lokal
  var tab = "produk", editing = null, busy = false, lastError = "";

  try { token = sessionStorage.getItem("agx-admin-token"); } catch (e) {}

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rupiah(n) { return "Rp " + Number(n).toLocaleString("id-ID"); }
  function imgSrc(p) { return previews[p] || "/" + p; }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 4200);
  }
  function show(id) {
    ["loginView", "setupView", "appView"].forEach(function (v) { $("#" + v).hidden = v !== id; });
  }
  function dirty() { return draft && JSON.stringify(draft) !== published; }
  function catName(id) {
    var c = draft.catalogs.filter(function (x) { return x.id === id; })[0]; return c ? c.name : "";
  }

  /* ---------- API ---------- */
  function api(path, body) {
    var opt = { method: body ? "POST" : "GET", headers: {} };
    if (token) opt.headers.Authorization = "Bearer " + token;
    if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return j;
        var e = new Error(j.message || "Permintaan gagal."); e.code = j.error || "http_" + r.status; e.missing = j.missing; throw e;
      });
    }, function () { var e = new Error("Tidak bisa terhubung ke server. Periksa koneksi internet."); e.code = "network"; throw e; });
  }
  function handleAuthError(e) {
    if (e.code === "not_configured") { $("#missingVars").textContent = (e.missing || []).join(", "); show("setupView"); return true; }
    if (e.code === "unauthorized") { logout("Sesi berakhir. Silakan masuk lagi."); return true; }
    return false;
  }
  function logout(msg) {
    token = null; try { sessionStorage.removeItem("agx-admin-token"); } catch (e) {}
    show("loginView"); $("#loginMsg").textContent = msg || ""; $("#pw").value = ""; $("#pw").focus();
  }

  /* ---------- masuk ---------- */
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Memeriksa…"; $("#loginMsg").textContent = "";
    api("/api/login", { password: $("#pw").value }).then(function (j) {
      token = j.token; try { sessionStorage.setItem("agx-admin-token", token); } catch (err) {}
      return load();
    }).catch(function (err) {
      if (!handleAuthError(err)) $("#loginMsg").textContent = err.message;
    }).then(function () { btn.disabled = false; btn.textContent = "Masuk"; });
  });
  $("#logoutBtn").addEventListener("click", function () {
    if (dirty() && !confirm("Ada perubahan yang belum diterbitkan. Keluar dan buang perubahan?")) return;
    draft = null; logout("");
  });

  function normalize(d) {
    d.settings = d.settings || {}; d.catalogs = d.catalogs || []; d.products = d.products || []; d.gallery = d.gallery || [];
    return d;
  }
  function load() {
    return api("/api/data").then(function (j) {
      head = j.head;
      published = JSON.stringify(normalize(j.data)); draft = JSON.parse(published);
      pending = {}; editing = null; lastError = "";
      show("appView"); render();
    });
  }

  /* ---------- menggabungkan perubahan dengan data terbaru ----------
     Bila data di situs berubah sejak panel dibuka (misalnya ada pembaruan situs atau admin lain
     menerbitkan), perubahan admin di panel ini diterapkan ulang di atas data terbaru,
     per produk, katalog, foto galeri, dan pengaturan. Untuk item yang sama, versi admin yang dipakai. */
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function mergeList(base, mine, latest, key) {
    var bmap = {}, mmap = {}, lmap = {};
    base.forEach(function (x) { bmap[key(x)] = x; });
    mine.forEach(function (x) { mmap[key(x)] = x; });
    latest.forEach(function (x) { lmap[key(x)] = x; });
    var out = latest.filter(function (x) { var k = key(x); return !(bmap[k] && !mmap[k]); }) // yang dihapus admin ikut dihapus
      .map(function (x) { var k = key(x); return bmap[k] && mmap[k] && !same(bmap[k], mmap[k]) ? mmap[k] : x; });
    var reordered = !same(base.map(key).filter(function (k) { return mmap[k]; }), mine.map(key).filter(function (k) { return bmap[k]; }));
    if (reordered) {
      var extra = out.filter(function (x) { return !mmap[key(x)]; });
      out = mine.filter(function (x) { var k = key(x); return lmap[k] || !bmap[k] || !same(bmap[k], x); })
        .map(function (x) { var k = key(x); return bmap[k] && same(bmap[k], x) && lmap[k] ? lmap[k] : x; }).concat(extra);
      return out;
    }
    mine.forEach(function (x, i) { // item baru (atau yang diubah admin tapi sudah terhapus di situs) disisipkan di posisi yang sama
      var k = key(x);
      if ((!bmap[k] || !lmap[k]) && !out.some(function (y) { return key(y) === k; })) out.splice(Math.min(i, out.length), 0, x);
    });
    return out;
  }
  function rebase(base, mine, latest) {
    var out = JSON.parse(JSON.stringify(latest));
    Object.keys(Object.assign({}, base.settings, mine.settings)).forEach(function (k) {
      if (!same(base.settings[k], mine.settings[k])) {
        if (mine.settings[k] === undefined) delete out.settings[k]; else out.settings[k] = mine.settings[k];
      }
    });
    out.catalogs = mergeList(base.catalogs, mine.catalogs, latest.catalogs, function (c) { return c.id; });
    out.products = mergeList(base.products, mine.products, latest.products, function (x) { return x.id; });
    out.gallery = mergeList(base.gallery, mine.gallery, latest.gallery, function (g) { return g.image; });
    return out;
  }

  /* ---------- foto ---------- */
  function shrink(file, maxSide) {
    if (!window.createImageBitmap) return Promise.reject(new Error("Browser ini tidak bisa memproses foto. Gunakan Chrome atau Edge terbaru."));
    return createImageBitmap(file).then(function (bmp) {
      var max = maxSide || 1600, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res, rej) {
        c.toBlob(function (b) { b ? res(b) : rej(new Error("Foto gagal diproses.")); }, "image/webp", 0.84);
      });
    }, function () {
      throw new Error("Foto " + file.name + " tidak bisa dibaca. Format HEIC belum didukung, ubah dulu ke JPG atau PNG.");
    });
  }
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(",")[1]); };
      fr.onerror = function () { rej(new Error("Foto gagal dibaca.")); };
      fr.readAsDataURL(blob);
    });
  }
  function upload(file, maxSide) {
    return shrink(file, maxSide).then(function (blob) {
      return toBase64(blob).then(function (b64) { return api("/api/blob", { content: b64 }); }).then(function (j) {
        pending[j.path] = j.sha; previews[j.path] = URL.createObjectURL(blob); return j.path;
      });
    });
  }
  function uploadMany(files, each, maxSide) {
    return files.reduce(function (pr, f) { return pr.then(function () { return upload(f, maxSide).then(each); }); }, Promise.resolve())
      .catch(function (e) { if (!handleAuthError(e)) toast(e.message); });
  }
  function usedPaths(d) {
    var out = {};
    d.products.forEach(function (p) { (p.images || []).forEach(function (i) { out[i] = 1; }); });
    (d.gallery || []).forEach(function (g) { out[g.image] = 1; });
    if (d.settings.hero) out[d.settings.hero] = 1;
    return out;
  }

  /* ---------- tampilan ---------- */
  function render() {
    Array.prototype.forEach.call($("#aTabs").children, function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === tab); });
    var el = $("#panel");
    if (tab === "produk") el.innerHTML = editing ? productForm(editing) : productList();
    else if (tab === "katalog") el.innerHTML = catalogForm();
    else if (tab === "galeri") el.innerHTML = galleryForm();
    else el.innerHTML = settingsForm();
    status();
  }
  function status() {
    var d = dirty(), st = $("#status");
    st.textContent = busy ? "Menerbitkan…" : d && lastError ? "Belum terbit: " + lastError : d ? "Ada perubahan yang belum diterbitkan." : "Semua perubahan sudah terbit.";
    st.className = "st" + (d ? " dirty" : "") + (d && lastError && !busy ? " err" : "");
    $("#publishBtn").disabled = !d || busy;
    $("#discardBtn").hidden = !d || busy;
  }
  function productList() {
    var ps = draft.products;
    return '<div class="a-head"><h2>' + ps.length + ' produk</h2><button type="button" class="btn btn-forest btn-sm" data-act="add">Tambah produk</button></div>' +
      (ps.length ? '<ul class="a-list">' + ps.map(function (p, i) {
        var im = p.images && p.images[0];
        return '<li><span class="th">' + (im ? '<img alt="" src="' + esc(imgSrc(im)) + '">' : "") + "</span><div><b>" + esc(p.name) + "</b><small>" +
          esc(catName(p.catalog)) + (p.price ? " · " + rupiah(p.price) : " · tanya harga") + (p.featured ? " · unggulan" : "") + (p.available === false ? " · stok habis" : "") + "</small></div>" +
          '<div class="acts"><button type="button" class="btn-x" data-act="up" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Naikkan urutan ' + esc(p.name) + '">Naik</button>' +
          '<button type="button" class="btn-x" data-act="edit" data-i="' + i + '" aria-label="Ubah ' + esc(p.name) + '">Ubah</button>' +
          '<button type="button" class="btn-x danger" data-act="del" data-i="' + i + '" aria-label="Hapus ' + esc(p.name) + '">Hapus</button></div></li>';
      }).join("") + "</ul>" : '<p class="muted">Belum ada produk. Tekan Tambah produk untuk mulai.</p>');
  }
  function productForm(p) {
    var imgs = p.images || [];
    return '<div class="a-head"><h2>' + (p._idx == null ? "Produk baru" : "Ubah produk") + '</h2><button type="button" class="btn-x" data-act="back">Kembali ke daftar</button></div><div class="fg">' +
      '<div><label>Foto produk</label><div class="imgs" style="margin-top:6px">' + imgs.map(function (im, i) {
        return '<div class="im"><img alt="" src="' + esc(imgSrc(im)) + '">' + (i === 0 ? "<span>Utama</span>" : "") + '<button type="button" data-act="rmimg" data-i="' + i + '" aria-label="Hapus foto ' + (i + 1) + '">Hapus</button></div>';
      }).join("") + (imgs.length < 4 ? '<label class="upl">Tambah foto<input type="file" accept="image/jpeg,image/png,image/webp" multiple id="imgInput" aria-label="Tambah foto produk"></label>' : "") +
      '</div><p class="hint" style="margin-top:6px">Maksimal 4 foto. Foto pertama jadi sampul. Format JPG, PNG, atau WebP.</p></div>' +
      '<label>Nama produk<input class="field" id="f-name" type="text" value="' + esc(p.name) + '"></label>' +
      '<label>Katalog<select class="field" id="f-cat">' + draft.catalogs.map(function (c) { return '<option value="' + esc(c.id) + '"' + (p.catalog === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select></label>" +
      '<label>Keterangan singkat<input class="field" id="f-sub" type="text" value="' + esc(p.subtitle) + '"></label>' +
      '<div class="two"><label>Harga (Rp)<input class="field" id="f-price" type="number" min="0" step="500" value="' + esc(p.price || "") + '"><span class="hint">Kosongkan untuk “Tanya harga”.</span></label>' +
      '<label>Satuan<input class="field" id="f-unit" type="text" value="' + esc(p.unit) + '"><span class="hint">Contoh: pcs, paket, pot.</span></label></div>' +
      '<label>Deskripsi<textarea class="field" id="f-desc">' + esc(p.desc) + "</textarea></label>" +
      '<label>Spesifikasi atau isi paket<textarea class="field" id="f-specs">' + esc(p.specs) + '</textarea><span class="hint">Satu baris per butir, format “Nama: nilai”. Contoh: Isi: 25 benih</span></label>' +
      '<label>Label di foto (opsional)<input class="field" id="f-badge" type="text" maxlength="16" value="' + esc(p.badge) + '"><span class="hint">Contoh: Baru, Promo. Isi hanya jika memang berlaku.</span></label>' +
      '<label class="check"><input type="checkbox" id="f-avail"' + (p.available === false ? "" : " checked") + "> Stok tersedia</label>" +
      '<label class="check"><input type="checkbox" id="f-feat"' + (p.featured ? " checked" : "") + "> Tampilkan di Produk Unggulan beranda</label>" +
      '<p class="msg err" id="formMsg" role="alert"></p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-forest" data-act="save">Simpan produk</button><button type="button" class="btn btn-line" data-act="back">Batal</button></div></div>';
  }
  function catalogForm() {
    return '<div class="a-head"><h2>Tiga katalog</h2></div><p class="muted">Nama dan deskripsi tampil di beranda dan halaman Produk.</p><div class="fg">' +
      draft.catalogs.map(function (c, i) {
        return '<div class="two"><label>Nama katalog ' + (i + 1) + '<input class="field" type="text" data-cn="' + i + '" value="' + esc(c.name) + '"></label>' +
          '<label>Deskripsi<input class="field" type="text" data-cd="' + i + '" value="' + esc(c.desc) + '"></label></div>';
      }).join("") + "</div>";
  }
  function galleryForm() {
    var g = draft.gallery;
    return '<div class="a-head"><h2>Galeri kegiatan</h2><label class="btn btn-forest btn-sm" style="position:relative">Tambah foto<input type="file" accept="image/jpeg,image/png,image/webp" multiple id="galInput" aria-label="Tambah foto galeri" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div>' +
      '<p class="muted">Foto tampil di halaman Proyek. Tulis keterangan singkat: kegiatan apa dan di mana.</p>' +
      (g.length ? "<div>" + g.map(function (it, i) {
        return '<div class="gitem"><img alt="" src="' + esc(imgSrc(it.image)) + '"><label class="sr" for="g-' + i + '">Keterangan foto ' + (i + 1) + '</label><input class="field" id="g-' + i + '" type="text" data-gc="' + i + '" placeholder="Keterangan foto" value="' + esc(it.caption) + '">' +
          '<div class="acts"><button type="button" class="btn-x" data-act="gup" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + '>Naik</button><button type="button" class="btn-x danger" data-act="gdel" data-i="' + i + '">Hapus</button></div></div>';
      }).join("") + "</div>" : '<p class="muted" style="margin-top:12px">Belum ada foto.</p>');
  }
  function settingsForm() {
    var s = draft.settings, hero = s.hero || DEFAULT_HERO;
    return '<div class="a-head"><h2>Pengaturan situs</h2></div><div class="fg">' +
      '<label>Nomor WhatsApp<input class="field" id="s-wa" type="tel" inputmode="numeric" value="' + esc(s.wa) + '"><span class="hint">Format internasional tanpa tanda plus. Contoh: 6289607718976</span></label>' +
      '<div><label>Foto utama beranda</label><div class="imgs" style="margin-top:6px"><div class="im" style="width:208px"><img alt="" src="' + esc(imgSrc(hero)) + '"></div>' +
      '<label class="upl">Ganti foto<input type="file" accept="image/jpeg,image/png,image/webp" id="heroInput" aria-label="Ganti foto utama"></label></div>' +
      (hero !== DEFAULT_HERO ? '<button type="button" class="btn-x" data-act="heroreset" style="margin-top:8px">Kembali ke foto bawaan</button>' : "") +
      '<p class="hint" style="margin-top:6px">Gunakan foto mendatar yang lebar, misalnya greenhouse atau lahan.</p></div>' +
      '<label>Link video profil<input class="field" id="s-video" type="url" placeholder="https://youtu.be/…" value="' + esc(s.video) + '"><span class="hint" id="videoHint"></span></label></div>';
  }
  function videoHint() {
    var h = $("#videoHint"); if (!h) return;
    var v = (draft.settings.video || "").trim();
    if (!v) h.textContent = "Tempel link YouTube atau Google Drive. Jika kosong, bagian video tidak ditampilkan.";
    else if (/(youtu\.be\/|youtube\.com\/(watch\?v=|embed\/|shorts\/))[\w-]{6,}/.test(v)) h.textContent = "Link YouTube dikenali. Video tampil di Beranda dan Tentang Kami.";
    else if (/drive\.google\.com\/file\/d\/[\w-]{10,}/.test(v)) h.textContent = "Link Google Drive dikenali. Pastikan aksesnya “Siapa saja yang memiliki link” sebagai Pelihat, bukan Editor.";
    else h.textContent = "Link belum dikenali. Gunakan link YouTube atau link file Google Drive.";
  }

  function readProduct() {
    var p = editing;
    p.name = $("#f-name").value.trim(); p.catalog = $("#f-cat").value; p.subtitle = $("#f-sub").value.trim();
    var pr = parseInt($("#f-price").value, 10); p.price = isNaN(pr) || pr <= 0 ? null : pr;
    p.unit = $("#f-unit").value.trim(); p.desc = $("#f-desc").value.trim(); p.specs = $("#f-specs").value.trim();
    p.badge = $("#f-badge").value.trim(); p.available = $("#f-avail").checked; p.featured = $("#f-feat").checked;
  }
  function slugify(name, selfId) {
    var base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produk", s = base, n = 2;
    while (draft.products.some(function (x) { return x.slug === s && x.id !== selfId; })) s = base + "-" + n++;
    return s;
  }

  $("#aTabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.getAttribute("data-tab"); editing = null; render(); if (tab === "pengaturan") videoHint();
  });
  $("#panel").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act"), i = Number(b.getAttribute("data-i"));
    if (act === "add") editing = { id: "p-" + Date.now().toString(36), slug: "", name: "", catalog: draft.catalogs[0] ? draft.catalogs[0].id : "", subtitle: "", price: null, unit: "", desc: "", specs: "", images: [], available: true, featured: false, badge: "" };
    else if (act === "edit") { editing = JSON.parse(JSON.stringify(draft.products[i])); editing._idx = i; }
    else if (act === "up") draft.products.splice(i - 1, 0, draft.products.splice(i, 1)[0]);
    else if (act === "del") { if (!confirm("Hapus " + draft.products[i].name + " dari katalog?")) return; draft.products.splice(i, 1); }
    else if (act === "back") editing = null;
    else if (act === "rmimg") { readProduct(); editing.images.splice(i, 1); }
    else if (act === "save") {
      readProduct();
      if (!editing.name) { $("#formMsg").textContent = "Isi nama produk terlebih dahulu."; $("#f-name").focus(); return; }
      var idx = editing._idx, clean = JSON.parse(JSON.stringify(editing)); delete clean._idx;
      clean.slug = slugify(clean.name, clean.id);
      if (idx == null) draft.products.push(clean); else draft.products[idx] = clean;
      editing = null; toast("Produk disimpan sebagai draf. Tekan Terbitkan perubahan agar tampil di situs.");
    }
    else if (act === "gup") draft.gallery.splice(i - 1, 0, draft.gallery.splice(i, 1)[0]);
    else if (act === "gdel") draft.gallery.splice(i, 1);
    else if (act === "heroreset") draft.settings.hero = DEFAULT_HERO;
    render(); if (tab === "pengaturan") videoHint();
  });
  $("#panel").addEventListener("change", function (e) {
    var t = e.target, files = t.files ? Array.prototype.slice.call(t.files) : [];
    if (!files.length) return;
    if (t.id === "imgInput") {
      readProduct(); var ed = editing; files = files.slice(0, 4 - ed.images.length);
      t.parentNode.firstChild.textContent = "Mengunggah…"; t.disabled = true;
      uploadMany(files, function (p) { ed.images.push(p); }).then(function () { if (editing === ed) render(); });
    } else if (t.id === "galInput") {
      t.parentNode.firstChild.textContent = "Mengunggah…"; t.disabled = true;
      uploadMany(files, function (p) { draft.gallery.push({ image: p, caption: "" }); }).then(render);
    } else if (t.id === "heroInput") {
      t.parentNode.firstChild.textContent = "Mengunggah…"; t.disabled = true;
      // Foto utama beranda tampil selebar layar, jadi disimpan lebih besar (2400 px).
      uploadMany(files.slice(0, 1), function (p) { draft.settings.hero = p; }, 2400).then(function () { render(); videoHint(); });
    }
  });
  $("#panel").addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-cn")) draft.catalogs[Number(t.getAttribute("data-cn"))].name = t.value;
    else if (t.hasAttribute("data-cd")) draft.catalogs[Number(t.getAttribute("data-cd"))].desc = t.value;
    else if (t.hasAttribute("data-gc")) draft.gallery[Number(t.getAttribute("data-gc"))].caption = t.value;
    else if (t.id === "s-wa") draft.settings.wa = t.value.replace(/\D/g, "");
    else if (t.id === "s-video") { draft.settings.video = t.value.trim(); videoHint(); }
    else return;
    status();
  });

  $("#discardBtn").addEventListener("click", function () {
    if (!confirm("Batalkan semua perubahan yang belum diterbitkan?")) return;
    draft = JSON.parse(published); editing = null; render(); if (tab === "pengaturan") videoHint();
  });
  function publish(merged) {
    var used = usedPaths(draft), before = usedPaths(JSON.parse(published));
    var files = Object.keys(pending).filter(function (p) { return used[p]; }).map(function (p) { return { path: p, sha: pending[p] }; });
    var remove = Object.keys(before).filter(function (p) { return !used[p] && p.indexOf("uploads/") === 0; });
    return api("/api/publish", { data: draft, files: files, remove: remove, base: head }).then(function (j) {
      head = j.head; published = JSON.stringify(draft); lastError = "";
      files.forEach(function (f) { delete pending[f.path]; });
      toast(merged ? "Data di situs sempat berubah. Perubahan Anda sudah digabung dengan versi terbaru dan diterbitkan. Situs diperbarui dalam sekitar 1 menit."
        : "Perubahan tersimpan. Situs diperbarui otomatis dalam sekitar 1 menit.");
    }, function (e) {
      if (e.code !== "conflict" || merged) throw e;
      // Data di situs berubah sejak panel dibuka: ambil yang terbaru, terapkan ulang perubahan admin, lalu coba sekali lagi.
      return api("/api/data").then(function (j) {
        var latest = normalize(j.data);
        draft = rebase(JSON.parse(published), draft, latest);
        published = JSON.stringify(latest); head = j.head;
        render();
        return publish(true);
      });
    });
  }
  $("#publishBtn").addEventListener("click", function () {
    if (editing) { toast("Simpan atau batalkan produk yang sedang diubah terlebih dahulu."); return; }
    busy = true; lastError = ""; status();
    publish(false).catch(function (e) {
      if (!handleAuthError(e)) { lastError = e.message; toast(e.message); }
    }).then(function () { busy = false; if (draft) status(); });
  });

  // Saat tab panel dibuka lagi dan tidak ada perubahan yang belum terbit, muat data terbaru dari situs.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !token || !draft || busy || editing || dirty()) return;
    api("/api/data").then(function (j) {
      if (j.head === head || busy || editing || dirty()) return;
      head = j.head; published = JSON.stringify(normalize(j.data)); draft = JSON.parse(published);
      render(); if (tab === "pengaturan") videoHint();
      toast("Data terbaru dari situs sudah dimuat.");
    }).catch(function (e) { handleAuthError(e); });
  });
  window.addEventListener("beforeunload", function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- mulai ---------- */
  if (token) load().catch(function (e) { if (!handleAuthError(e)) logout(e.message); });
  else {
    show("loginView");
    // Cek konfigurasi tanpa mengirim kata sandi: login kosong membalas 503 bila variabel belum diisi.
    api("/api/login", { password: "" }).catch(function (e) { if (e.code === "not_configured") handleAuthError(e); });
  }
})();
