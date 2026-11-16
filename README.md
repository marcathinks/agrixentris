# Website AgriXentris Nusantara

Situs perusahaan dan katalog produk CV AgriXentris Nusantara. Situs statis (HTML, CSS, JavaScript tanpa proses build) dengan panel admin yang menyimpan perubahan langsung ke repo ini.

## Isi repo

| Bagian | Lokasi |
| --- | --- |
| Halaman | `index.html`, `produk.html`, `tentang.html`, `layanan.html`, `proyek.html`, `kontak.html`, `admin.html` |
| Tampilan dan perilaku | `assets/css/`, `assets/js/` |
| Data produk, katalog, galeri, pengaturan | `data/site.json` |
| Foto yang diunggah lewat admin | `uploads/` |
| API panel admin | `api/` (dijalankan oleh `worker/index.js`) |
| Server pratinjau lokal | `tools/dev-server.js` |

Header dan footer ditulis di setiap file HTML. Jika mengubah menu, ubah di semua halaman.

## Deploy ke Cloudflare Workers

Situs tayang di https://agrixentrisnusantara.com (domain dikelola di Rumahweb, nameserver diarahkan ke Cloudflare).

Situs berjalan di Cloudflare Workers paket gratis, yang boleh dipakai untuk situs komersial. Halaman, gambar, dan data disajikan langsung oleh Cloudflare tanpa batas. Hanya panel admin (`/api/*`) yang menjalankan kode di `worker/index.js`, dengan jatah 100.000 permintaan per hari.

Konfigurasi ada di `wrangler.jsonc`. File yang tidak ikut tampil di situs didaftarkan di `.assetsignore`, dan header HTTP untuk halaman serta gambar ada di `_headers`.

1. Di dash.cloudflare.com buka **Workers & Pages**, pilih **Create application**, lalu **GitHub**, dan pilih repo ini.
2. Nama proyek harus `agrixentris`, sama dengan `name` di `wrangler.jsonc`. Build command dikosongkan, deploy command biarkan `npx wrangler deploy`. Klik **Deploy**.
3. Setiap push ke branch `main`, termasuk setiap kali admin menerbitkan perubahan, membuat Cloudflare men-deploy ulang otomatis.

`GITHUB_REPO` dan `GITHUB_BRANCH` sudah diatur di `wrangler.jsonc`.

## Mengaktifkan panel admin

1. Di GitHub buka **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories**, pilih repo ini.
   - Permissions → Repository permissions → **Contents: Read and write**.
2. Di Cloudflare buka Worker `agrixentris` → **Settings → Variables and Secrets**, tambahkan dua variabel bertipe **Secret**:

| Nama | Isi |
| --- | --- |
| `ADMIN_PASSWORD` | Kata sandi panel admin. Buat yang panjang dan tidak dipakai di tempat lain. |
| `GITHUB_TOKEN` | Token dari langkah 1. |

3. Buka `https://domain-anda/admin` dan masuk dengan `ADMIN_PASSWORD`.

Cara kerja: setiap kali admin menekan **Terbitkan perubahan**, panel membuat satu commit berisi `data/site.json` dan foto baru. Cloudflare lalu menerbitkan ulang situs secara otomatis, biasanya sekitar 1 menit.

## Mengelola konten

- **Produk**: nama, katalog, harga, satuan, deskripsi, spesifikasi, sampai 4 foto, stok, label, dan tanda Produk Unggulan.
- **Katalog**: nama dan deskripsi tiga katalog.
- **Galeri**: foto kegiatan untuk halaman Proyek.
- **Pengaturan**: nomor WhatsApp, foto utama beranda, link video profil (YouTube atau Google Drive).

Foto dikompres otomatis di browser. Format HEIC belum didukung, ubah dulu ke JPG.

## Pratinjau di komputer

```
node tools/dev-server.js
```

Buka `http://localhost:3000`. Panel admin lokal ada di `/admin` dengan kata sandi `admin-lokal`, dan perubahan ditulis ke folder ini, bukan ke GitHub.

Untuk menguji persis seperti di Cloudflare, jalankan `npx wrangler dev` lalu buka `http://localhost:8787`. Kata sandi dan token untuk pengujian ini diisi di file `.dev.vars` (jangan di-commit).

## Catatan

- Gambar produk di `assets/img/produk/` adalah ilustrasi sementara. Ganti dengan foto asli lewat panel admin.
- Foto lahan dan greenhouse di `assets/img/` diambil dari company profile. Pastikan perusahaan berhak memakainya, atau ganti dengan foto kegiatan sendiri.
