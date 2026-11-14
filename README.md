# Website AgriXentris Nusantara

Situs perusahaan dan katalog produk CV AgriXentris Nusantara. Situs statis (HTML, CSS, JavaScript tanpa proses build) dengan panel admin yang menyimpan perubahan langsung ke repo ini.

## Isi repo

| Bagian | Lokasi |
| --- | --- |
| Halaman | `index.html`, `produk.html`, `tentang.html`, `layanan.html`, `proyek.html`, `kontak.html`, `admin.html` |
| Tampilan dan perilaku | `assets/css/`, `assets/js/` |
| Data produk, katalog, galeri, pengaturan | `data/site.json` |
| Foto yang diunggah lewat admin | `uploads/` |
| API panel admin (fungsi Vercel) | `api/` |
| Server pratinjau lokal | `tools/dev-server.js` |

Header dan footer ditulis di setiap file HTML. Jika mengubah menu, ubah di semua halaman.

## Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Di vercel.com pilih **Add New → Project**, lalu **Import** repo ini.
3. Framework Preset: **Other**. Kosongkan Build Command dan Output Directory. Klik **Deploy**.

Situs publik langsung jalan. Panel admin perlu tiga variabel di langkah berikut.

## Mengaktifkan panel admin

1. Di GitHub buka **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories**, pilih repo ini.
   - Permissions → Repository permissions → **Contents: Read and write**.
2. Di Vercel buka proyek → **Settings → Environment Variables**, tambahkan:

| Nama | Isi |
| --- | --- |
| `ADMIN_PASSWORD` | Kata sandi panel admin. Buat yang panjang dan tidak dipakai di tempat lain. |
| `GITHUB_TOKEN` | Token dari langkah 1. |
| `GITHUB_REPO` | `pemilik/nama-repo`, contoh `agrixentris/agrixentris-web`. |
| `GITHUB_BRANCH` | Opsional. Bawaan `main`. |

3. Buka **Deployments**, pilih deployment terbaru, klik **Redeploy**.
4. Buka `https://domain-anda/admin` dan masuk dengan `ADMIN_PASSWORD`.

Cara kerja: setiap kali admin menekan **Terbitkan perubahan**, panel membuat satu commit berisi `data/site.json` dan foto baru. Vercel lalu menerbitkan ulang situs secara otomatis, biasanya sekitar 1 menit.

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

## Catatan

- Gambar produk di `assets/img/produk/` adalah ilustrasi sementara. Ganti dengan foto asli lewat panel admin.
- Foto lahan dan greenhouse di `assets/img/` diambil dari company profile. Pastikan perusahaan berhak memakainya, atau ganti dengan foto kegiatan sendiri.
- Paket Hobby Vercel hanya untuk penggunaan nonkomersial. Untuk situs perusahaan, cek ketentuan paket Vercel.
